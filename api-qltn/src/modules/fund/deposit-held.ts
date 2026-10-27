import type { EntityManager } from 'typeorm';

/**
 * F-S5 BR-F5-10, BR-F5-12: the deposit a contract still holds — received, less offsets, less refunds paid — and the
 * refunds still open (not paid, not refused, not cancelled), which reserve part of it. Read from the exploitation
 * tables by SQL so the fund module stays free of exploitation services.
 */
export const depositPosition = async (
  manager: EntityManager,
  contractId: string,
  exceptVoucherId: string | null = null,
): Promise<{ heldVnd: bigint; reservedVnd: bigint }> => {
  const [row] = await manager.query<
    Array<{ received: string | null; offset: string | null; refunded: string | null; reserved: string | null }>
  >(
    `SELECT
       (SELECT SUM(amount_vnd)::text FROM exploitation_deposits WHERE contract_id = $1 AND status = 'RECORDED') AS received,
       (SELECT SUM(amount_vnd)::text FROM exploitation_deposit_offsets WHERE contract_id = $1 AND status = 'RECORDED') AS offset,
       (SELECT SUM(amount_vnd)::text FROM fund_vouchers WHERE contract_id = $1 AND category = 'DEPOSIT_REFUND' AND status = 'PAID') AS refunded,
       (SELECT SUM(amount_vnd)::text FROM fund_vouchers
         WHERE contract_id = $1 AND category = 'DEPOSIT_REFUND' AND status IN ('DRAFT', 'PENDING', 'NEEDS_CHANGES', 'APPROVED')
           AND ($2::uuid IS NULL OR id <> $2::uuid)) AS reserved`,
    [contractId, exceptVoucherId],
  );
  const amount = (value: string | null | undefined): bigint => BigInt(value ?? '0');
  return {
    heldVnd: amount(row?.received) - amount(row?.offset) - amount(row?.refunded),
    reservedVnd: amount(row?.reserved),
  };
};
