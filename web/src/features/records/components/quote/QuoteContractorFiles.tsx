import { Field } from '@/components/ui/field';
import type { Attachment } from '@/domain/types';
import { formatVndString, contractorTotal } from '@/domain/quote-proposal';
import type { QuoteForm } from '../../hooks/useQuoteForm';
import { AttachmentField } from '../shared/AttachmentField';

interface QuoteContractorFilesProps {
  form: QuoteForm;
  recordId: string;
  errors: Record<string, string>;
  disabled: boolean;
  pick: (ids: readonly string[]) => Attachment[];
  remember: (rows: Attachment[]) => void;
}

/** Per contractor: its quotation files (≥ 1 when submitting) and the choice of the one proposed contractor. */
export const QuoteContractorFiles = ({ form, recordId, errors, disabled, pick, remember }: QuoteContractorFilesProps) => {
  const { contractors, items, proposedContractorIndex } = form.values;
  return (
    <Field label="Nhà thầu đề xuất và tệp báo giá" required error={errors.proposedContractorIndex}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {contractors.map((contractor, index) => {
          const ids = contractor.quotationAttachmentIds;
          const isProposed = proposedContractorIndex === index;
          return (
            <div
              key={`files-${index}`}
              className={isProposed ? 'rounded-lg border border-accent bg-accent/5 p-3' : 'rounded-lg border border-line p-3'}
            >
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="radio"
                  name="proposed-contractor"
                  checked={isProposed}
                  disabled={disabled}
                  onChange={() => form.set.proposedContractorIndex(index)}
                />
                {contractor.name || `Nhà thầu ${index + 1}`}
              </label>
              <p className="mb-2 mt-1 text-xs text-ink-3">
                Tổng: {formatVndString(contractorTotal(items, contractor).totalVnd)}
                {isProposed ? ' · Nhà thầu đề xuất' : ''}
              </p>
              <AttachmentField
                label="Báo giá"
                recordId={recordId}
                purpose="QUOTATION"
                items={pick(ids)}
                required
                disabled={disabled}
                error={errors[`contractors.${index}.quotationAttachmentIds`]}
                onAdd={(rows) => {
                  remember(rows);
                  form.table.updateContractor(index, { quotationAttachmentIds: [...ids, ...rows.map((row) => row.id)] });
                }}
                onRemove={(id) =>
                  form.table.updateContractor(index, { quotationAttachmentIds: ids.filter((item) => item !== id) })
                }
              />
            </div>
          );
        })}
      </div>
    </Field>
  );
};
