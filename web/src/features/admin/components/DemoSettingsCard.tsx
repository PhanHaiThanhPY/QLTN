import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { DemoSettings } from '@/domain/types';
import { toErrorMessage } from '@/domain/errors';
import { updateDemoSettings } from '@/services/admin-service';

const MAX_LATENCY = 5000;

const validateLatency = (raw: string): string | undefined => {
  if (!/^\d+$/.test(raw.trim())) return 'Nhập số nguyên mili giây từ 0 đến 5000.';
  const value = Number(raw);
  if (value < 0 || value > MAX_LATENCY) return 'Độ trễ phải trong khoảng 0–5000 ms.';
  return undefined;
};

/**
 * Latency and "fail next command" switches used to demo loading/error/retry (spec 9).
 * Parent remounts this card (key) when stored settings change.
 */
export const DemoSettingsCard = ({ settings }: { settings: DemoSettings }) => {
  const [latency, setLatency] = useState(String(settings.latencyMs));
  const [failNext, setFailNext] = useState(settings.failNextCommand);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = latency !== String(settings.latencyMs) || failNext !== settings.failNextCommand;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = validateLatency(latency);
    setError(message);
    if (message) return;
    setIsSaving(true);
    try {
      await updateDemoSettings({ latencyMs: Number(latency), failNextCommand: failNext });
      toast.success('Đã lưu cấu hình demo.');
    } catch (saveError) {
      console.error('Save demo settings failed:', saveError);
      toast.error(toErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Cấu hình mô phỏng" description="Dùng để trình diễn trạng thái đang tải, lỗi và thử lại. Mặc định không tạo lỗi ngẫu nhiên." />
      <CardBody>
        <form className="flex max-w-lg flex-col gap-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
          <Field label="Độ trễ mỗi lệnh (ms)" htmlFor="demo-latency" error={error} hint="0–5000 ms. Áp dụng cho các lệnh nghiệp vụ, không áp dụng cho sinh lịch tự động.">
            <Input
              id="demo-latency"
              inputMode="numeric"
              placeholder="VD: 300"
              value={latency}
              aria-invalid={Boolean(error)}
              onChange={(event) => setLatency(event.target.value)}
            />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
              checked={failNext}
              onChange={(event) => setFailNext(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-ink">Thất bại lệnh tiếp theo</span>
              <span className="block text-xs text-ink-2">
                Lệnh ghi kế tiếp (của bất kỳ tài khoản nào) sẽ báo lỗi kết nối mô phỏng và được hủy toàn bộ, không để lại dữ liệu dở dang. Bấm lại thao tác để thử
                lại thành công. Công tắc tự tắt sau khi đã gây lỗi một lần.
              </span>
            </span>
          </label>
          <div>
            <Button type="submit" isLoading={isSaving} disabled={!isDirty}>
              Lưu cấu hình
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
};
