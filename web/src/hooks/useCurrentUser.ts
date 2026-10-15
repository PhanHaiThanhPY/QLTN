import { useReferenceData } from './useReferenceData';
import type { User } from '@/domain/types';

export const useCurrentUser = (): User | undefined => useReferenceData().data?.viewer;
