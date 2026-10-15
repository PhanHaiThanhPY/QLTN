import { useNavigate } from 'react-router';
import { Pencil } from 'lucide-react';
import { ActionButton } from '@/components/common/ActionButton';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';

/** Opens the edit form while the record is DRAFT / NEEDS_RECORD_UPDATE. */
export const EditRecordButton = () => {
  const { detail } = useRecordContext();
  const navigate = useNavigate();
  const { relevant, state } = useRepairAction('saveRecordDraft');
  if (!relevant) return null;
  const label = detail.record.status === 'DRAFT' ? 'Sửa nháp' : 'Bổ sung hồ sơ';
  return (
    <ActionButton state={state} onClick={() => navigate(`/records/${detail.record.id}/edit`)}>
      <Pencil className="h-4 w-4" />
      {label}
    </ActionButton>
  );
};
