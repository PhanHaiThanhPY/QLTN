import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { isActionRelevant } from '../../record-utils';
import { useRecordContext } from '../../record-context';
import { ReasonActionButton } from '../shared/ReasonActionButton';

/** Technical confirmer decisions while PENDING_CONFIRMATION. */
export const ConfirmationActions = () => {
  const { detail } = useRecordContext();
  if (!isActionRelevant('confirmRepair', detail.record.status)) return null;
  return (
    <Card>
      <CardHeader title="Xác nhận hiện trạng" description="Người xác nhận kỹ thuật được giao kiểm tra hiện trường và kết luận." />
      <CardBody className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <ReasonActionButton
          action="confirmRepair"
          field="note"
          variant="primary"
          dialogTitle="Xác nhận cần sửa"
          dialogDescription="Hồ sơ chuyển sang “Chờ lập tờ trình” để BQL ghi phương án, tên nhà thầu và giá."
          fieldLabel="Kết luận hiện trạng"
          successMessage="Đã xác nhận cần sửa."
        />
        <ReasonActionButton
          action="requestRecordUpdate"
          field="note"
          dialogTitle="Trả bổ sung thông tin"
          dialogDescription="BQL quản lý sẽ bổ sung hồ sơ và gửi lại."
          successMessage="Đã trả hồ sơ để bổ sung."
        />
        <ReasonActionButton
          action="closeNoRepair"
          field="note"
          confirmVariant="danger"
          dialogTitle="Đóng vì không cần sửa"
          dialogDescription="Hồ sơ sẽ đóng và chỉ còn xem được."
          successMessage="Đã đóng hồ sơ vì không cần sửa."
        />
      </CardBody>
    </Card>
  );
};
