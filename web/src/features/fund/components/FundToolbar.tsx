import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { useReferenceData } from '@/hooks/useReferenceData';
import type { FundScope } from '../useFundScope';

/** "Tòa" and "Tháng" of a fund page (ui-brief §2.1). */
export const FundToolbar = ({ scope }: { scope: FundScope }) => {
  const { buildingName } = useReferenceData();
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:w-[32rem]">
      <Field label="Tòa" htmlFor="fund-building">
        <NativeSelect id="fund-building" value={scope.fund?.buildingId ?? ''} onChange={(event) => scope.setBuilding(event.target.value)}>
          {scope.funds.map((fund) => (
            <option key={fund.id} value={fund.buildingId}>
              {buildingName(fund.buildingId)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Tháng" htmlFor="fund-month">
        <Input id="fund-month" type="month" value={scope.month} onChange={(event) => scope.setMonth(event.target.value)} />
      </Field>
    </div>
  );
};
