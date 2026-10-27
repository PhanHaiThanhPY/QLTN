import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { LIMITS } from '@/domain/constants';
import type { EmergencyInfo } from '@/domain/types';
import { formatDateTime } from '@/utils/date';

interface LateReasonFieldProps {
  emergency: EmergencyInfo;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/** First submission of an emergency record after its deadline needs a reason (B06-S1 BR-E-05). */
export const LateReasonField = ({ emergency, value, error, disabled = false, onChange }: LateReasonFieldProps) => (
  <Field
    label="Lý do bổ sung trễ"
    htmlFor="quote-late-reason"
    required
    hint={`Hạn bổ sung đã qua lúc ${formatDateTime(emergency.docsDueAt)}. 5–1000 ký tự.`}
    error={error}
  >
    <Textarea id="quote-late-reason" rows={2} maxLength={LIMITS.REASON_MAX} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
  </Field>
);
