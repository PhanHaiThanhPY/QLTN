import type { DataSource } from 'typeorm';
import { receivableSchedule, type ContractPeriod } from '../src/domain/exploitation-receivables';

export interface ContractTerms {
  startDate: string;
  endDate: string;
  priceVnd: string;
  period?: ContractPeriod;
  depositVnd?: string;
}

/**
 * An active contract with its schedule, inserted directly (F-S2 covers how one becomes active), for the fund suites.
 * `tag` keeps the codes of one suite apart from another's.
 */
export const insertActiveContract = async (
  dataSource: DataSource,
  buildingId: string,
  tag: string,
  terms: ContractTerms,
): Promise<string> => {
  const [{ id: locationId }] = await dataSource.query<Array<{ id: string }>>(
    'SELECT id FROM locations WHERE building_id = $1 LIMIT 1',
    [buildingId],
  );
  const [{ id: userId }] = await dataSource.query<Array<{ id: string }>>(
    `SELECT u.id FROM users u JOIN user_buildings ub ON ub.user_id = u.id WHERE u.role = 'BQL' AND ub.building_id = $1 LIMIT 1`,
    [buildingId],
  );
  const [{ id: partnerId }] = await dataSource.query<Array<{ id: string }>>(
    `SELECT id FROM exploitation_partners ORDER BY code LIMIT 1`,
  );
  const [{ id: packageId }] = await dataSource.query<Array<{ id: string }>>(
    `INSERT INTO exploitation_packages (code, building_id, location_id, kind, name, status, created_by)
     VALUES ($1, $2, $3, 'RETAIL_SPACE', $4, 'SELECTED', $5) RETURNING id`,
    [`MT-${tag}`, buildingId, locationId, `Gói ${tag}`, userId],
  );
  const [{ id: selectionId }] = await dataSource.query<Array<{ id: string }>>(
    `INSERT INTO exploitation_selections (code, package_id, building_id, kind, partner_id, minutes_attachment_id, basis, status, submitted_at, created_by)
     VALUES ($1, $2, $3, 'PARTNER', $4, gen_random_uuid(), 'Đủ hồ sơ theo biên bản.', 'APPROVED', now(), $5) RETURNING id`,
    [`KQ-${tag}`, packageId, buildingId, partnerId, userId],
  );
  const period = terms.period ?? 'MONTH';
  const [{ id }] = await dataSource.query<Array<{ id: string }>>(
    `INSERT INTO exploitation_contracts (code, package_id, selection_id, partner_id, building_id, location_id, status, start_date, end_date, price_vnd, period, due_days, deposit_vnd, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8, $9, $10, 9, $11, $12) RETURNING id`,
    [
      `HĐ-${tag}`,
      packageId,
      selectionId,
      partnerId,
      buildingId,
      locationId,
      terms.startDate,
      terms.endDate,
      terms.priceVnd,
      period,
      terms.depositVnd ?? null,
      userId,
    ],
  );
  for (const row of receivableSchedule({ ...terms, period, dueDays: 9 }))
    await dataSource.query(
      `INSERT INTO exploitation_receivables (contract_id, building_id, period_no, period_start, period_end, due_date, amount_vnd, revision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
      [id, buildingId, row.periodNo, row.periodStart, row.periodEnd, row.dueDate, row.amountVnd],
    );
  return id;
};
