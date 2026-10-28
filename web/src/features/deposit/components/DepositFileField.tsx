import { AttachmentList } from '@/components/common/AttachmentList';
import { FileUploader } from '@/components/common/FileUploader';
import type { AttachmentPurpose } from '@/domain/constants';
import type { Attachment } from '@/domain/types';

interface DepositFileFieldProps {
  invitationId: string;
  purpose: Extract<AttachmentPurpose, 'DEPOSIT_INVITATION_LETTER' | 'DEPOSIT_OFFER' | 'DEPOSIT_SELECTION_MINUTES'>;
  label: string;
  file: Attachment | null;
  onChange: (file: Attachment | null) => void;
  error?: string;
  required?: boolean;
}

/** One file on the invitation (SPEC T-S1): the letter, an offer or the minutes; replaced by removing it first. */
export const DepositFileField = ({ invitationId, purpose, label, file, onChange, error, required = false }: DepositFileFieldProps) => (
  <div className="space-y-1.5">
    <span className="text-sm font-medium text-ink">
      {label} {required ? <span className="text-crit">*</span> : null}
    </span>
    {file ? <AttachmentList attachments={[file]} onRemove={() => onChange(null)} /> : null}
    {file ? null : (
      <FileUploader
        subjectType="DEPOSIT_INVITATION"
        subjectId={invitationId}
        purpose={purpose}
        multiple={false}
        label={`Tải ${label.toLowerCase()}`}
        onUploaded={(files) => onChange(files[0] ?? null)}
      />
    )}
    {error ? (
      <p className="text-sm text-crit" role="alert">
        {error}
      </p>
    ) : null}
  </div>
);
