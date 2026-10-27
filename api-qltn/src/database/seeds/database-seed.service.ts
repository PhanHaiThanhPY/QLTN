import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { vnDate } from '../../common/utils/vn-date';
import { templateValues } from '../../domain/building-config';
import { roleCapabilities } from '../../domain/permissions';
import { hashPassword } from '../../modules/auth/password';
import { BuildingConfig } from '../../modules/buildings/entities/building-config.entity';
import { Building } from '../../modules/buildings/entities/building.entity';
import { Location } from '../../modules/buildings/entities/location.entity';
import { MaintenanceItem } from '../../modules/maintenance/entities/maintenance-item.entity';
import { MaintenancePlan } from '../../modules/maintenance/entities/maintenance-plan.entity';
import { MaintenanceScheduleVersion } from '../../modules/maintenance/entities/maintenance-schedule-version.entity';
import { Department } from '../../modules/organization/entities/department.entity';
import { RoleDefinition } from '../../modules/roles/entities/role-definition.entity';
import { CUSTOM_ROLE_PREFIX, RolesService } from '../../modules/roles/roles.service';
import { User } from '../../modules/users/entities/user.entity';
import { DEMO_ITEMS, DEMO_PLANS, shiftDate } from './demo-items';
import { ensureExploitationContractDemo } from './exploitation-contract-seed';
import { ensureExploitationDemo } from './exploitation-seed';
import { AssembliesService } from '../../modules/exploitation/assemblies.service';
import { ContractsService } from '../../modules/exploitation/contracts.service';
import { SelectionsService } from '../../modules/exploitation/selections.service';
import { FileStorage } from '../../modules/attachments/file-storage';
import {
  DEMO_ASSIGNMENT_RULES,
  DEMO_BUILDING_TEMPLATES,
  DEMO_BUILDINGS,
  DEMO_CUSTOM_ROLE,
  DEMO_DEPARTMENTS,
  DEMO_LOCATIONS,
  DEMO_USERS,
} from './demo-data';

const MIN_DEMO_PASSWORD_LENGTH = 8;

/**
 * Boot-time data. System role rows are always synced with the code matrix. Demo data
 * (SEED_DEMO_DATA=true, never in production) is insert-if-missing keyed by code, so
 * edits made through the app survive restarts.
 */
@Injectable()
export class DatabaseSeedService {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly roles: RolesService,
    private readonly codes: CodeCounterService,
    private readonly storage: FileStorage,
    private readonly selections: SelectionsService,
    private readonly assemblies: AssembliesService,
    private readonly contracts: ContractsService,
  ) {}

  async run(): Promise<void> {
    await this.dataSource.transaction((manager) => this.roles.syncSystemRoles(manager));
    if (!this.config.get<boolean>('seed.demoData', false)) return;
    if (this.config.get<string>('nodeEnv') === 'production') {
      throw new Error('[api-qltn] SEED_DEMO_DATA=true không được dùng ở production.');
    }
    const password = this.config.get<string>('seed.demoPassword');
    if (!password || password.length < MIN_DEMO_PASSWORD_LENGTH) {
      throw new Error(
        `[api-qltn] SEED_DEMO_DATA=true cần SEED_DEMO_PASSWORD dài tối thiểu ${MIN_DEMO_PASSWORD_LENGTH} ký tự.`,
      );
    }
    const passwordHash = await hashPassword(password);
    const created: Record<string, number> = await this.dataSource.transaction((manager) =>
      this.seed(manager, passwordHash),
    );
    // F-S2 runs through its services (their own transactions), so after the rest has committed.
    created.contracts = await ensureExploitationContractDemo({
      dataSource: this.dataSource,
      storage: this.storage,
      codes: this.codes,
      selections: this.selections,
      assemblies: this.assemblies,
      contracts: this.contracts,
      now: new Date(),
    });
    const summary = Object.entries(created)
      .map(([name, count]) => `+${count} ${name}`)
      .join(', ');
    this.logger.log(`Demo seed: ${summary}`);
  }

  private async seed(manager: EntityManager, passwordHash: string) {
    const buildings = await this.ensureBuildings(manager);
    const departments = await this.ensureDepartments(manager, [...buildings.byCode.values()]);
    const locations = await this.ensureLocations(manager, buildings.byCode);
    const configs = await this.ensureConfigs(manager, buildings.byCode, departments.byCode);
    const roles = await this.ensureCustomRole(manager);
    const users = await this.ensureUsers(manager, buildings.byCode, departments.byCode, passwordHash);
    const items = await this.ensureItems(manager, buildings.byCode);
    const plans = await this.ensurePlans(manager, buildings.byCode);
    const firstBuilding = buildings.byCode.get('A');
    const exploitation = firstBuilding
      ? await ensureExploitationDemo(manager, {
          codes: this.codes,
          storage: this.storage,
          building: firstBuilding,
          now: new Date(),
        })
      : 0;
    return {
      buildings: buildings.created,
      departments: departments.created,
      locations,
      configs,
      roles,
      users,
      items,
      plans,
      exploitation,
    };
  }

  private async ensureBuildings(manager: EntityManager) {
    const repo = manager.getRepository(Building);
    const existing = await repo.findBy({ code: In(DEMO_BUILDINGS.map((b) => b.code)) });
    const missing = DEMO_BUILDINGS.filter((b) => !existing.some((e) => e.code === b.code));
    const inserted = await repo.save(missing.map((b) => repo.create({ ...b, isActive: true })));
    const byCode = new Map([...existing, ...inserted].map((b) => [b.code, b]));
    return { byCode, created: inserted.length };
  }

  private async ensureDepartments(manager: EntityManager, allBuildings: Building[]) {
    const repo = manager.getRepository(Department);
    const existing = await repo.findBy({ code: In(DEMO_DEPARTMENTS.map((d) => d.code)) });
    const missing = DEMO_DEPARTMENTS.filter((d) => !existing.some((e) => e.code === d.code));
    const inserted = await repo.save(missing.map((d) => repo.create({ ...d, buildings: allBuildings })));
    const byCode = new Map([...existing, ...inserted].map((d) => [d.code, d]));
    return { byCode, created: inserted.length };
  }

  private async ensureLocations(manager: EntityManager, buildings: Map<string, Building>): Promise<number> {
    const repo = manager.getRepository(Location);
    const ids = [...buildings.values()].map((b) => b.id);
    const existing = await repo.findBy({ buildingId: In(ids) });
    const rows = DEMO_LOCATIONS.flatMap((l) => {
      const building = buildings.get(l.buildingCode);
      if (!building) return [];
      const present = existing.some(
        (e) => e.buildingId === building.id && e.floor === l.floor && e.name.toLowerCase() === l.name.toLowerCase(),
      );
      return present ? [] : [repo.create({ buildingId: building.id, floor: l.floor, name: l.name, isActive: true })];
    });
    await repo.save(rows);
    return rows.length;
  }

  private async ensureConfigs(
    manager: EntityManager,
    buildings: Map<string, Building>,
    departments: Map<string, Department>,
  ): Promise<number> {
    const repo = manager.getRepository(BuildingConfig);
    const existing = await repo.findBy({ buildingId: In([...buildings.values()].map((b) => b.id)) });
    const assignmentRules = DEMO_ASSIGNMENT_RULES.flatMap((rule) => {
      const department = departments.get(rule.departmentCode);
      return department ? [{ departmentId: department.id, role: rule.role, priority: rule.priority }] : [];
    });
    const rows = [...buildings.entries()].flatMap(([code, building]) => {
      if (existing.some((e) => e.buildingId === building.id)) return [];
      const values = templateValues(DEMO_BUILDING_TEMPLATES[code] ?? 'STANDARD');
      if (!values) return [];
      return [
        repo.create({
          buildingId: building.id,
          ...values,
          assignmentRules,
          version: 1,
          updatedBy: null,
        }),
      ];
    });
    await repo.save(rows);
    return rows.length;
  }

  private async ensureCustomRole(manager: EntityManager): Promise<number> {
    const repo = manager.getRepository(RoleDefinition);
    // VT-01 is seeded, so custom roles created in the app continue from VT-02.
    await this.codes.ensureAtLeast(manager, CUSTOM_ROLE_PREFIX, 1);
    if (await repo.existsBy({ code: DEMO_CUSTOM_ROLE.code })) return 0;
    const source = await repo.findOneBy({ isSystem: true, baseRole: DEMO_CUSTOM_ROLE.baseRole });
    await repo.insert(
      repo.create({
        code: DEMO_CUSTOM_ROLE.code,
        name: DEMO_CUSTOM_ROLE.name,
        baseRole: DEMO_CUSTOM_ROLE.baseRole,
        capabilities: roleCapabilities(DEMO_CUSTOM_ROLE.baseRole).filter((c) => !DEMO_CUSTOM_ROLE.removed.includes(c)),
        baseCapabilities: [...roleCapabilities(DEMO_CUSTOM_ROLE.baseRole)],
        isSystem: false,
        sourceRoleId: source?.id ?? null,
      }),
    );
    return 1;
  }

  /** BR-MT-12: demo equipment added by code per building when missing; never touches items already there. */
  private async ensureItems(manager: EntityManager, buildings: Map<string, Building>): Promise<number> {
    const repo = manager.getRepository(MaintenanceItem);
    const buildingIds = [...buildings.values()].map((b) => b.id);
    const [existing, locations, owners] = await Promise.all([
      repo.findBy({ buildingId: In(buildingIds) }),
      manager.getRepository(Location).findBy({ buildingId: In(buildingIds) }),
      manager.getRepository(User).findBy({ code: In([...new Set(DEMO_ITEMS.map((i) => i.ownerCode)), 'ADMIN-DEMO']) }),
    ]);
    const creator = owners.find((u) => u.code === 'ADMIN-DEMO');
    if (!creator) return 0;
    const today = vnDate(new Date());
    const rows = DEMO_ITEMS.flatMap((i) => {
      const building = buildings.get(i.buildingCode);
      const location = locations.find(
        (l) =>
          l.buildingId === building?.id && l.floor === i.floor && l.name.toLowerCase() === i.locationName.toLowerCase(),
      );
      const owner = owners.find((u) => u.code === i.ownerCode);
      if (!building || !location || !owner) return [];
      if (existing.some((e) => e.buildingId === building.id && e.code === i.code)) return [];
      return [
        repo.create({
          buildingId: building.id,
          locationId: location.id,
          code: i.code,
          name: i.name,
          type: i.type,
          ownerUserId: owner.id,
          model: i.equipment?.model ?? null,
          supplier: i.equipment?.supplier ?? null,
          installDate: i.equipment ? shiftDate(today, i.equipment.installMonths) : null,
          warrantyUntil: i.equipment
            ? shiftDate(today, i.equipment.warrantyMonths, i.equipment.warrantyDays ?? 0)
            : null,
          description: null,
          documentIds: [],
          condition: 'UNKNOWN',
          active: true,
          createdBy: creator.id,
          version: 1,
        }),
      ];
    });
    await repo.save(rows);
    return rows.length;
  }

  /**
   * BR-MT2-10: one running plan per demo plan, added when the item has no plan of that name yet. Occurrences come
   * from the generator (its catch-up run at boot, then daily).
   */
  private async ensurePlans(manager: EntityManager, buildings: Map<string, Building>): Promise<number> {
    const buildingIds = [...buildings.values()].map((b) => b.id);
    const [items, users, existing] = await Promise.all([
      manager.getRepository(MaintenanceItem).findBy({ buildingId: In(buildingIds) }),
      manager
        .getRepository(User)
        .findBy({ code: In(['BQL-A', 'BQL-B', 'ADMIN-DEMO', ...DEMO_PLANS.map((p) => p.reviewerCode)]) }),
      manager.getRepository(MaintenancePlan).findBy({ buildingId: In(buildingIds) }),
    ]);
    const userId = (code: string) => users.find((u) => u.code === code)?.id;
    const today = vnDate(new Date());
    let created = 0;
    for (const seed of DEMO_PLANS) {
      const item = items.find(
        (row) => row.code === seed.itemCode && row.buildingId === buildings.get(seed.buildingCode)?.id,
      );
      const name = `Bảo trì định kỳ ${seed.itemCode}`;
      const managerId = item ? item.ownerUserId : undefined;
      const reviewerId = userId(seed.reviewerCode);
      const creator = userId('ADMIN-DEMO');
      if (
        !item ||
        !managerId ||
        !reviewerId ||
        !creator ||
        existing.some((p) => p.itemId === item.id && p.name === name)
      )
        continue;
      const anchor = shiftDate(today, seed.anchorMonths, seed.anchorDays);
      const plan = await manager.getRepository(MaintenancePlan).save(
        manager.getRepository(MaintenancePlan).create({
          code: await this.codes.next(manager, 'KH', 3),
          itemId: item.id,
          buildingId: item.buildingId,
          name,
          status: 'ACTIVE',
          managerUserId: managerId,
          performerUserId: managerId,
          reviewerUserId: reviewerId,
          contractorName: seed.contractor,
          checklist: seed.checklist.map(([label, required]) => ({
            id: randomUUID(),
            label,
            required,
            kind: 'CHECK' as const,
            unit: null,
            min: null,
            max: null,
            photoRequired: false,
          })),
          activeSince: today,
          createdBy: creator,
          version: 1,
        }),
      );
      await manager.getRepository(MaintenanceScheduleVersion).insert({
        planId: plan.id,
        unit: 'MONTH',
        every: seed.everyMonths,
        effectiveFrom: anchor,
        anchorDate: anchor,
        reason: null,
        supersededBy: null,
        supersededAt: null,
        createdBy: creator,
      });
      created += 1;
    }
    return created;
  }

  private async ensureUsers(
    manager: EntityManager,
    buildings: Map<string, Building>,
    departments: Map<string, Department>,
    passwordHash: string,
  ): Promise<number> {
    const repo = manager.getRepository(User);
    const existing = await repo.findBy({ code: In(DEMO_USERS.map((u) => u.code)) });
    const missing = DEMO_USERS.filter((u) => !existing.some((e) => e.code === u.code));
    const rows = missing.map((u) =>
      repo.create({
        code: u.code,
        username: u.code.toLowerCase(),
        passwordHash,
        fullName: u.fullName,
        role: u.role,
        departmentId: departments.get(u.departmentCode)?.id ?? null,
        jobTitle: u.jobTitle,
        isActive: u.active,
        roleDefId: null,
        buildings: u.buildingCodes.flatMap((code) => buildings.get(code) ?? []),
        locations: [],
      }),
    );
    await repo.save(rows);
    return rows.length;
  }
}
