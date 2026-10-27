import { Notice } from '@/components/common/Notice';
import { Button } from '@/components/ui/button';

/** ui-brief §4 "Xung đột": the typed values stay until the user reloads. */
export const ConflictNotice = ({ onReload }: { onReload: () => void }) => (
  <Notice tone="warning">
    <span className="flex flex-wrap items-center gap-2">
      Lượt vừa được người khác cập nhật. Tải lại để xem bản mới.
      <Button size="sm" variant="secondary" className="min-h-11" onClick={onReload}>
        Tải lại
      </Button>
    </span>
  </Notice>
);
