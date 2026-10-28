import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Raw } from 'typeorm';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { assertVersion, conflictWithReason, notFound } from '../../common/errors';
import { CodeCounterService } from '../../common/services/code-counter.service';
import { FieldErrors } from '../../common/validation/field-errors';
import { AuditService } from '../audit/audit.service';
import { SUBJECT_TYPE } from '../audit/entities/audit-event.entity';
import { assertDepositManage, assertDepositView } from './deposit-access';
import type { BankFieldsDto, ListBanksQueryDto, ReasonDto, UpdateBankDto } from './dto/deposit.dto';
import { DepositBank } from './entities/deposit-bank.entity';

const CODE_PREFIX = 'NH';
const CODE_WIDTH = 3;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+().\s-]{8,20}$/;
const NOT_FOUND = 'Không tìm thấy ngân hàng.';

export interface BankView {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  branch: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  deactivatedAt: Date | null;
  deactivationReason: string | null;
  version: number;
  /** Invitations of the caller's buildings that invited this bank. */
  invitationCount: number;
}

export const bankView = (row: DepositBank, invitationCount = 0): BankView => ({
  id: row.id,
  code: row.code,
  name: row.name,
  shortName: row.shortName,
  branch: row.branch,
  contactName: row.contactName,
  phone: row.phone,
  email: row.email,
  active: row.active,
  deactivatedAt: row.deactivatedAt,
  deactivationReason: row.deactivationReason,
  version: row.version,
  invitationCount,
});

/** The bank catalogue shared by every building (SPEC T-S1 BR-T1-01); every write is audited and version-locked. */
@Injectable()
export class DepositBanksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly codes: CodeCounterService,
  ) {}

  async list(actor: AuthenticatedUser, query: ListBanksQueryDto): Promise<BankView[]> {
    assertDepositView(actor);
    const rows = await this.dataSource
      .getRepository(DepositBank)
      .find({ where: query.includeInactive ? {} : { active: true }, order: { code: 'ASC' } });
    const counts = await this.invitationCounts(actor);
    return rows.map((row) => bankView(row, counts.get(row.id) ?? 0));
  }

  async create(actor: AuthenticatedUser, dto: BankFieldsDto): Promise<BankView> {
    assertDepositManage(actor);
    return this.dataSource.transaction(async (manager) => {
      const values = await this.validate(manager, dto, null);
      const repo = manager.getRepository(DepositBank);
      const saved = await repo.save(
        repo.create({
          ...values,
          code: await this.codes.next(manager, CODE_PREFIX, CODE_WIDTH),
          active: true,
          createdBy: actor.id,
          version: 1,
        }),
      );
      await this.record(manager, actor, saved, 'createDepositBank');
      return bankView(saved);
    });
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateBankDto): Promise<BankView> {
    assertDepositManage(actor);
    return this.dataSource.transaction(async (manager) => {
      const bank = await this.lock(manager, id, dto.version);
      Object.assign(bank, await this.validate(manager, dto, bank));
      bank.version += 1;
      const saved = await manager.getRepository(DepositBank).save(bank);
      await this.record(manager, actor, saved, 'updateDepositBank');
      return bankView(saved);
    });
  }

  /** A stopped bank cannot be invited to a new invitation; it stays on the old ones. */
  async deactivate(actor: AuthenticatedUser, id: string, dto: ReasonDto): Promise<BankView> {
    assertDepositManage(actor);
    return this.dataSource.transaction(async (manager) => {
      const bank = await this.lock(manager, id, dto.version);
      if (!bank.active) throw conflictWithReason('bank_inactive', 'Ngân hàng đã ngừng dùng.');
      new FieldErrors().when(dto.reason.trim().length < 5, 'reason', 'Lý do cần tối thiểu 5 ký tự.').throwIfAny();
      Object.assign(bank, {
        active: false,
        deactivatedAt: new Date(),
        deactivationReason: dto.reason,
        version: bank.version + 1,
      });
      const saved = await manager.getRepository(DepositBank).save(bank);
      await this.record(manager, actor, saved, 'deactivateDepositBank', dto.reason);
      return bankView(saved);
    });
  }

  private async lock(manager: EntityManager, id: string, version: number): Promise<DepositBank> {
    const bank = await manager
      .getRepository(DepositBank)
      .findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!bank) throw notFound(NOT_FOUND);
    assertVersion(bank.version, version);
    return bank;
  }

  /** BR-T1-01 fields; the same name and branch as a bank in use is refused (AC-T1.1). */
  private async validate(
    manager: EntityManager,
    dto: BankFieldsDto,
    current: DepositBank | null,
  ): Promise<Partial<DepositBank>> {
    const errors = new FieldErrors();
    const name = dto.name.trim();
    errors.when(name.length < 2 || name.length > 200, 'name', 'Tên ngân hàng từ 2 đến 200 ký tự.');
    errors.when((dto.shortName ?? '').length > 20, 'shortName', 'Tên viết tắt tối đa 20 ký tự.');
    errors.when((dto.branch ?? '').length > 200, 'branch', 'Chi nhánh tối đa 200 ký tự.');
    errors.when((dto.contactName ?? '').length > 120, 'contactName', 'Người liên hệ tối đa 120 ký tự.');
    errors.when(Boolean(dto.email && !EMAIL.test(dto.email)), 'email', 'Email không đúng định dạng.');
    errors.when(Boolean(dto.phone && !PHONE.test(dto.phone)), 'phone', 'Số điện thoại không đúng định dạng.');
    errors.throwIfAny();
    const branch = dto.branch ?? null;
    const same = await manager.getRepository(DepositBank).exists({
      where: {
        ...(current ? { id: Not(current.id) } : {}),
        active: true,
        name: Raw((alias) => `lower(${alias}) = lower(:name)`, { name }),
        branch: Raw((alias) => `lower(coalesce(${alias}, '')) = lower(:branch)`, { branch: branch ?? '' }),
      },
    });
    errors.when(same, 'branch', 'Đã có ngân hàng cùng tên và chi nhánh đang dùng.').throwIfAny();
    return {
      name,
      shortName: dto.shortName ?? null,
      branch,
      contactName: dto.contactName ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
    };
  }

  private async invitationCounts(actor: AuthenticatedUser): Promise<Map<string, number>> {
    if (actor.buildingIds.length === 0) return new Map();
    const rows = await this.dataSource.query<Array<{ bank_id: string; count: string }>>(
      `SELECT b.bank_id, count(DISTINCT b.invitation_id)::text AS count FROM (
         SELECT jsonb_array_elements_text(i.invitee_ids)::uuid AS bank_id, i.id AS invitation_id
           FROM deposit_invitations i WHERE i.building_id = ANY($1::uuid[])
       ) b GROUP BY b.bank_id`,
      [actor.buildingIds],
    );
    return new Map(rows.map((row) => [row.bank_id, Number(row.count)]));
  }

  private record(
    manager: EntityManager,
    actor: AuthenticatedUser,
    bank: DepositBank,
    action: string,
    reason?: string,
  ): Promise<void> {
    return this.audit.record(manager, {
      subjectType: SUBJECT_TYPE.DEPOSIT_BANK,
      subjectId: bank.id,
      buildingId: null,
      action,
      actorId: actor.id,
      entityVersion: bank.version,
      ...(reason ? { reason } : {}),
    });
  }
}
