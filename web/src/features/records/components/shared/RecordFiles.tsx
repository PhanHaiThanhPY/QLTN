import { AttachmentList } from '@/components/common/AttachmentList';
import { useRecordContext } from '../../record-context';
import { pickAttachments } from '../../record-utils';

interface RecordFilesProps {
  ids: readonly string[];
  emptyText?: string;
}

/** Read-only file list resolved from the record's attachments. */
export const RecordFiles = ({ ids, emptyText = 'Không có tệp.' }: RecordFilesProps) => {
  const { detail } = useRecordContext();
  return <AttachmentList attachments={pickAttachments(detail.attachments, ids)} emptyText={emptyText} />;
};
