import { useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { ActionButton } from '@/components/common/ActionButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import { downloadText } from '@/utils/download';
import { useRecordCommand } from '../../hooks/useRecordCommand';
import { useRepairAction } from '../../hooks/useRepairAction';
import { useRecordContext } from '../../record-context';
import { ActorLine } from '../shared/ActorLine';
import { ConfirmActionButton } from '../shared/ConfirmActionButton';

/** Notice drafted by the system after the third rejection: BQL edits, copies or downloads, then issues it. */
export const UnresolvedNoticeCard = () => {
  const { detail } = useRecordContext();
  const notice = detail.notice;
  const save = useRepairAction('saveUnresolvedNotice');
  const [title, setTitle] = useState(notice?.title ?? '');
  const [body, setBody] = useState(notice?.body ?? '');
  const command = useRecordCommand({ successMessage: 'Đã lưu thông báo.' });
  if (!notice) return null;
  const isDraft = notice.status === 'DRAFT';
  const isEditable = isDraft && save.state.allowed;
  const text = `${title}\n\n${body}`;
  const isDirty = title !== notice.title || body !== notice.body;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Đã sao chép nội dung thông báo.');
    } catch (error) {
      console.error(error);
      toast.error('Trình duyệt không cho sao chép. Hãy chọn và sao chép thủ công.');
    }
  };

  return (
    <Card className="border-crit/40">
      <CardHeader
        title="Thông báo hồ sơ chưa xử lý"
        description="Tờ trình không được duyệt sau 3 lần trình. Hệ thống đã soạn sẵn thông báo kèm lý do; BQL rà soát rồi phát hành."
        actions={isDraft ? <Badge tone="warn">Bản nháp</Badge> : <Badge tone="good">Đã phát hành</Badge>}
      />
      <CardBody className="space-y-4">
        <Field label="Tiêu đề" htmlFor="notice-title" required error={command.fieldErrors.title}>
          <Input id="notice-title" maxLength={LIMITS.NOTICE_TITLE_MAX} placeholder="VD: Bổ sung hồ sơ nghiệm thu" value={title} disabled={!isEditable} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Nội dung" htmlFor="notice-body" required error={command.fieldErrors.body}>
          <Textarea id="notice-body" rows={14} maxLength={LIMITS.NOTICE_BODY_MAX} placeholder="Nhập nội dung cần bổ sung hoặc xử lý..." value={body} disabled={!isEditable} onChange={(event) => setBody(event.target.value)} />
        </Field>
        {notice.issuedAt ? <ActorLine prefix="Phát hành bởi" actorId={notice.issuedBy} at={notice.issuedAt} /> : null}
        <p className="text-xs text-ink-3">Demo không gửi Zalo/email thật: phát hành sẽ khóa nội dung và gửi thông báo trong hệ thống tới các vai trò đã cấu hình.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="ghost" onClick={() => void copy()}>
            <Copy className="h-4 w-4" />
            Sao chép
          </Button>
          <Button variant="ghost" onClick={() => downloadText(`thong-bao-${detail.record.code}.txt`, text)}>
            <Download className="h-4 w-4" />
            Tải .txt
          </Button>
          {isDraft ? (
            <ActionButton
              state={save.state}
              variant="secondary"
              isLoading={command.isPending}
              onClick={() => void command.run('saveUnresolvedNotice', { title, body, noticeVersion: notice.version })}
            >
              Lưu nháp
            </ActionButton>
          ) : null}
          {isDraft ? (
            <ConfirmActionButton
              action="issueUnresolvedNotice"
              dialogTitle="Phát hành thông báo"
              payload={{ title, body, noticeVersion: notice.version }}
              successMessage="Đã phát hành thông báo."
            >
              <p>
                Nội dung sẽ bị khóa sau khi phát hành{isDirty ? ' (bao gồm các thay đổi chưa lưu)' : ''}. Người duyệt của hồ sơ nhận thông báo trong hệ thống.
              </p>
            </ConfirmActionButton>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
};
