import { DialogActionButton } from '../shared/DialogActionButton';
import { useRepairAction } from '../../hooks/useRepairAction';
import { EmergencyDialog } from './EmergencyDialog';

/**
 * "Xử lý khẩn cấp" in api mode (B06-S1 ui-brief §2.1): shown only to the record's manager holding EMERGENCY_START
 * while the record may start one; never as a disabled button.
 */
export const EmergencyStartButton = () => {
  const { state } = useRepairAction('startEmergencyRepair');
  if (!state.allowed) return null;
  return <DialogActionButton action="startEmergencyRepair" variant="danger" renderDialog={(close) => <EmergencyDialog onClose={close} />} />;
};
