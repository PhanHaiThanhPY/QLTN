import { createContext, useContext } from 'react';
import type { User } from '@/domain/types';
import type { RecordDetail } from '@/services/records-service';

export interface RecordContextValue {
  detail: RecordDetail;
  viewer: User;
}

export const RecordContext = createContext<RecordContextValue | null>(null);

/** Detail + viewer shared by every tab of the record detail page. */
export const useRecordContext = (): RecordContextValue => {
  const value = useContext(RecordContext);
  if (!value) throw new Error('useRecordContext must be used inside RecordContext.Provider');
  return value;
};
