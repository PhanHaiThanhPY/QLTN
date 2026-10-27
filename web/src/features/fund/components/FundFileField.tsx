import { AttachmentList } from '@/components/common/AttachmentList';
import { FileUploader } from '@/components/common/FileUploader';
import type { AttachmentPurpose } from '@/domain/constants';
import type { Attachment } from '@/domain/types';

interface FundFileFieldProps {
  fundId: string;
  purpose: AttachmentPurpose;
  label: string;
  required?: boolean;
  file: Attachment | null;
  onChange: (file: Attachment | null) => void;
  error?: string;
}

/** One document slot of a money document, uploaded on the fund (F-S3: Kế toán only). */
export const FundFileField = ({ fundId, purpose, label, required = false, file, onChange, error }: FundFileFieldProps) => (
  <div className="space-y-1.5">
    <span className="text-sm font-medium text-ink">
      {label} {required ? <span className="text-crit">*</span> : null}
    </span>
    {file ? <AttachmentList attachments={[file]} onRemove={() => onChange(null)} /> : null}
    <FileUploader subjectType="FUND" subjectId={fundId} purpose={purpose} multiple={false} label={`Tải ${label.toLowerCase()}`} onUploaded={(files) => onChange(files[0] ?? null)} />
    {error ? (
      <p className="text-sm text-crit" role="alert">
        {error}
      </p>
    ) : null}
  </div>
);
