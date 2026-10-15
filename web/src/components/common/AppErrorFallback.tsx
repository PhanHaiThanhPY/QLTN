import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Last-resort screen when rendering crashes outside the router's own error page. */
export const AppErrorFallback = () => (
  <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
    <span className="flex size-12 items-center justify-center rounded-full bg-crit-soft text-crit">
      <TriangleAlert className="size-6" aria-hidden />
    </span>
    <div className="max-w-md space-y-1">
      <h1 className="text-lg font-bold text-ink">Đã xảy ra lỗi ngoài ý muốn</h1>
      <p className="text-sm text-ink-2">Ứng dụng gặp sự cố khi hiển thị. Dữ liệu demo vẫn được giữ nguyên; hãy tải lại trang để tiếp tục.</p>
    </div>
    <Button onClick={() => window.location.reload()}>
      <RotateCcw className="size-4" aria-hidden />
      Tải lại trang
    </Button>
  </div>
);
