/** A form checkbox line: ✓ when present, ☐ when missing (ui-brief §2.5), never hidden. */
export const CheckLine = ({ label, isChecked }: { label: string; isChecked: boolean }) => (
  <p>
    <span aria-hidden>{isChecked ? '✓' : '☐'}</span> {label}
    <span className="sr-only">{isChecked ? ' (có)' : ' (chưa có)'}</span>
  </p>
);
