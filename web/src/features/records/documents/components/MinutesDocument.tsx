import { DOTS } from '../print-format';
import type { MinutesPrintModel } from '../minutes-model';
import { SignatureBox } from './SignatureBox';

/** `BIÊN BẢN NGHIỆM THU.docx` filled from one acceptance round (SPEC B7-S1 §3.2, ui-brief §2.4). */
export const MinutesDocument = ({ model }: { model: MinutesPrintModel }) => (
  <>
    <h1 id="d5-title">Biên bản nghiệm thu</h1>
    <p>{model.openingLine}</p>
    <p>Chúng tôi gồm có:</p>
    {model.representatives.map((row) => (
      <p key={row.label}>
        {row.label}: {row.name}
      </p>
    ))}
    <p>Đại diện Cư dân/ CQCN (nếu có): {model.otherMembers}</p>
    <p>Nội dung làm việc:</p>
    <p>Vào thời gian trên, các bên cùng tiến hành có mặt để nghiệm thu công việc/ hạng mục: {model.content}</p>
    <p>
      Đánh giá: <span aria-hidden>{model.outcome === 'PASSED' ? '☒' : '☐'}</span> ĐẠT{' '}
      <span aria-hidden>{model.outcome === 'FAILED' ? '☒' : '☐'}</span> KHÔNG ĐẠT
      <span className="sr-only">{model.outcome ? ` — kết luận: ${model.outcome === 'PASSED' ? 'đạt' : 'không đạt'}` : ' — chưa có kết luận'}</span>
    </p>
    <p>Điểm cần lưu ý:</p>
    {model.notes.length > 0 ? model.notes.map((note) => <p key={note}>- {note}</p>) : <p>{DOTS}</p>}
    <div className="d5-sign-row">
      {model.columns.map((column) => (
        <SignatureBox key={column.label} heading={[column.label]} signature={column.signature} />
      ))}
    </div>
  </>
);
