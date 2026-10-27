import { LIMITS } from '@/domain/constants';

interface PostReviewToggleProps {
  checked: boolean;
  /** Last allowed submission: a rejection always ends the post-review, so the box is ticked and locked. */
  isFinalAttempt: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * "Không duyệt hậu kiểm" in the BQT rejection of an emergency record (B06-S1 ui-brief §2.5, BR-E-07). Shown only to
 * the BOARD holder; the API refuses the flag from anyone else.
 */
export const PostReviewToggle = ({ checked, isFinalAttempt, onChange }: PostReviewToggleProps) => (
  <div className="space-y-2">
    <label className="flex items-start gap-2 text-sm text-ink">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-[var(--crit)]"
        checked={checked}
        disabled={isFinalAttempt}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>Không duyệt hậu kiểm (kết thúc, không trình lại được)</span>
    </label>
    {isFinalAttempt ? (
      <p className="text-xs text-ink-2">Lần trình cuối ({LIMITS.MAX_SUBMISSION_ATTEMPTS}/{LIMITS.MAX_SUBMISSION_ATTEMPTS}): từ chối sẽ kết thúc hậu kiểm.</p>
    ) : null}
    {checked ? (
      <p role="alert" className="rounded-lg border border-crit/40 bg-crit-soft px-3 py-2 text-sm text-crit">
        Hồ sơ sẽ chuyển sang “Không được duyệt hậu kiểm”. Không có khoản thanh toán nào trong hệ thống cho hồ sơ này.
      </p>
    ) : null}
  </div>
);
