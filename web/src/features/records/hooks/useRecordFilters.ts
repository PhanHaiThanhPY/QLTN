import { useSearchParams } from 'react-router';
import { REPAIR_STATUS_GROUP_LABEL, REPAIR_STATUS_LABEL } from '@/domain/constants';
import type { RepairStatus, RepairStatusGroup } from '@/domain/constants';
import { RECORD_ITEM_LINK } from '@/domain/record-item-link';
import type { RecordFilters } from '@/services/records-service';

/** URL param names equal the RecordFilters field names (dashboard links rely on them). */
const PARAM = {
  q: 'q',
  buildingId: 'buildingId',
  status: 'status',
  statusGroup: 'statusGroup',
  locationId: 'locationId',
  assigneeId: 'assigneeId',
  maintenanceItemId: 'maintenanceItemId',
  itemLink: 'itemLink',
  dateFrom: 'dateFrom',
  dateTo: 'dateTo',
  overdue: 'overdue',
  open: 'open',
  attention: 'attention',
} as const;

export type RecordFilterField = keyof typeof PARAM;

/** URL value of `itemLink` for records not yet tied to equipment (linked from the equipment report). */
export const ITEM_LINK_UNLINKED_PARAM = 'unlinked';

const isRepairStatus = (value: string): value is RepairStatus => value in REPAIR_STATUS_LABEL;
const isRepairStatusGroup = (value: string): value is RepairStatusGroup => value in REPAIR_STATUS_GROUP_LABEL;

/** Filters + page stored in the URL search params. */
export const useRecordFilters = () => {
  const [params, setParams] = useSearchParams();
  const read = (field: RecordFilterField): string => params.get(PARAM[field]) ?? '';
  const status = read('status');
  const statusGroup = read('statusGroup');
  const page = Math.max(1, Number(params.get('page')) || 1);

  /** overdue=1 → only records whose current step is past due. */
  const overdueOnly = read('overdue') === '1';
  const attention = read('attention');
  const filters: RecordFilters = {
    q: read('q'),
    buildingId: read('buildingId'),
    status: isRepairStatus(status) ? status : '',
    statusGroup: isRepairStatusGroup(statusGroup) ? statusGroup : '',
    locationId: read('locationId'),
    assigneeId: read('assigneeId'),
    maintenanceItemId: read('maintenanceItemId'),
    itemLink: read('itemLink') === ITEM_LINK_UNLINKED_PARAM ? RECORD_ITEM_LINK.UNLINKED : undefined,
    dateFrom: read('dateFrom'),
    dateTo: read('dateTo'),
    overdue: overdueOnly,
    open: read('open') === '1',
    attention: attention === 'needs_update' ? 'needs_update' : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };

  /** Changing a filter resets the page; changing the building clears building-bound filters. */
  const setFilter = (field: RecordFilterField, value: string) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(PARAM[field], field === 'overdue' || field === 'open' ? '1' : value);
        else next.delete(PARAM[field]);
        if (field === 'buildingId') {
          next.delete(PARAM.locationId);
          next.delete(PARAM.maintenanceItemId);
        }
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const setPage = (value: number) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value > 1) next.set('page', String(value));
      else next.delete('page');
      return next;
    });
  };

  const clear = () => setParams(new URLSearchParams(), { replace: true });
  const hasFilters = Object.values(PARAM).some((key) => params.has(key));

  return { filters, overdueOnly, setFilter, setPage, clear, hasFilters };
};
