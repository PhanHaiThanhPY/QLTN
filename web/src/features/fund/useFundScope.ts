import { useSearchParams } from 'react-router';
import { useServiceQuery } from '@/hooks/useServiceQuery';
import { listFunds, type Fund } from '@/services/fund-api';
import { todayVn } from '@/services/runtime';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface FundScope {
  funds: Fund[];
  fund: Fund | undefined;
  month: string;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  setBuilding: (buildingId: string) => void;
  setMonth: (month: string) => void;
}

/** The fund (one per building, never summed: BR-F3-01) and month a fund page shows, kept in the address. */
export const useFundScope = (): FundScope => {
  const [params, setParams] = useSearchParams();
  const query = useServiceQuery(['fund', 'list'], () => listFunds());
  const funds = query.data ?? [];
  const building = params.get('building');
  const monthParam = params.get('month');
  const month = monthParam && MONTH.test(monthParam) ? monthParam : todayVn().slice(0, 7);
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };
  return {
    funds,
    fund: funds.find((row) => row.buildingId === building) ?? funds[0],
    month,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => void query.refetch(),
    setBuilding: (buildingId) => set('building', buildingId),
    setMonth: (value) => (MONTH.test(value) ? set('month', value) : undefined),
  };
};
