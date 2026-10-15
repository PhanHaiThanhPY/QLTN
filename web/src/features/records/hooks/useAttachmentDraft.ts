import { useState } from 'react';
import type { Attachment } from '@/domain/types';

/** Local list of attachments picked for a form; ids are sent in the command payload. */
export const useAttachmentDraft = (initial: Attachment[] = []) => {
  const [items, setItems] = useState<Attachment[]>(initial);
  const add = (rows: Attachment[]) =>
    setItems((previous) => [...previous, ...rows.filter((row) => !previous.some((item) => item.id === row.id))]);
  const remove = (id: string) => setItems((previous) => previous.filter((item) => item.id !== id));
  return { items, ids: items.map((item) => item.id), add, remove };
};
