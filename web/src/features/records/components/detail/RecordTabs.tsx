import { useSearchParams } from 'react-router';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import type { TabItem } from '@/components/ui/tabs';
import { AuditTimeline } from '@/components/common/AuditTimeline';
import { Card, CardBody } from '@/components/ui/card';
import { useRecordContext } from '../../record-context';
import { isRecordTab } from '../../record-utils';
import type { RecordTab } from '../../record-utils';
import { AcceptanceTab } from '../acceptance/AcceptanceTab';
import { ApprovalTab } from '../approval/ApprovalTab';
import { ConstructionTab } from '../construction/ConstructionTab';
import { OverviewTab } from '../overview/OverviewTab';
import { PaymentTab } from '../payment/PaymentTab';
import { IS_API_MODE } from '@/config/data-source';
import { DocumentsTab } from '../../documents/components/DocumentsTab';

const TAB_ITEMS: TabItem[] = [
  { value: 'overview', label: 'Tổng quan' },
  { value: 'approval', label: 'Tờ trình và phê duyệt' },
  { value: 'construction', label: 'Thi công' },
  { value: 'acceptance', label: 'Nghiệm thu' },
  { value: 'payment', label: 'Thanh toán' },
  // B7-S1: D5 documents, api mode only (the demo keeps its "Xem bộ biểu mẫu" button).
  ...(IS_API_MODE ? [{ value: 'documents', label: 'Biểu mẫu' }] : []),
  { value: 'history', label: 'Lịch sử' },
];

/** Business tabs; the active one lives in ?tab= so tasks/notifications open the right section. */
export const RecordTabs = () => {
  const { detail } = useRecordContext();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: RecordTab = isRecordTab(raw) ? raw : 'overview';
  const onChange = (value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('tab', value);
        return next;
      },
      { replace: true },
    );
  return (
    <Tabs value={tab} onValueChange={onChange} items={TAB_ITEMS}>
      <TabPanel value="overview">
        <OverviewTab />
      </TabPanel>
      <TabPanel value="approval">
        <ApprovalTab />
      </TabPanel>
      <TabPanel value="construction">
        <ConstructionTab />
      </TabPanel>
      <TabPanel value="acceptance">
        <AcceptanceTab />
      </TabPanel>
      <TabPanel value="payment">
        <PaymentTab />
      </TabPanel>
      {IS_API_MODE ? (
        <TabPanel value="documents">
          <DocumentsTab />
        </TabPanel>
      ) : null}
      <TabPanel value="history">
        <Card>
          <CardBody>
            <AuditTimeline events={detail.audit} />
          </CardBody>
        </Card>
      </TabPanel>
    </Tabs>
  );
};
