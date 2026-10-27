/**
 * Settlement instalment (SPEC B03–B09 v2 §4.4 as amended by FX-S2 BR-FX2-01/02): settled total minus the advances
 * already transferred. It may be 0 (the advances covered everything); a settled total below the advances would need
 * the contractor to pay money back, which is not supported yet (OD-18), so it is refused.
 */
export type SettlementInstalment = { ok: true; amount: bigint } | { ok: false; reason: 'below_advances' };

export const settlementInstalment = (settlement: bigint, transferredAdvances: bigint): SettlementInstalment =>
  settlement < transferredAdvances
    ? { ok: false, reason: 'below_advances' }
    : { ok: true, amount: settlement - transferredAdvances };
