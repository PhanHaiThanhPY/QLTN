import { useState } from 'react';
import type { Attachment } from '@/domain/types';
import { pickAttachments } from '../record-utils';

/** Files the screen can name: the record's files plus those uploaded since the detail was loaded. */
export const useKnownFiles = (initial: Attachment[]) => {
  const [known, setKnown] = useState<Attachment[]>(initial);
  const remember = (rows: Attachment[]) =>
    setKnown((previous) => [...previous, ...rows.filter((row) => !previous.some((item) => item.id === row.id))]);
  return { pick: (ids: readonly string[]) => pickAttachments(known, ids), remember };
};
