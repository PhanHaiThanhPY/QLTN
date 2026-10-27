import { DOTS } from '../print-format';
import {
  CLOSING,
  INCIDENT_BASIS,
  LEGAL_BASIS,
  NOTES_INTRO,
  OTHER_SUPPLIER_NOTE,
  QUOTATION_BASIS,
  type ProposalPrintModel,
} from '../proposal-model';
import { CheckLine } from './CheckLine';
import { QuoteTablePrint } from './QuoteTablePrint';
import { SignatureBox } from './SignatureBox';

/** `Số tờ trình.docx` filled from one submission (SPEC B7-S1 §3.1, ui-brief §2.3). */
export const ProposalDocument = ({ model }: { model: ProposalPrintModel }) => (
  <>
    <p>Số tờ trình: {DOTS}</p>
    <h1 id="d5-title">Tờ trình</h1>
    <dl className="d5-fields">
      {model.fields.map((field) => (
        <div key={field.label} style={{ display: 'contents' }}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
    <p>Nội dung tờ trình: {model.recordTitle}</p>
    <p>
      <span className="d5-heading">Nội dung xin phê duyệt:</span> {model.requestContent}
    </p>
    <p className="d5-heading">Đề xuất và cơ sở xin phê duyệt:</p>
    <p>Cơ sở xin phê duyệt: {LEGAL_BASIS}</p>
    {model.hasIncidentMinutes ? <p>{INCIDENT_BASIS}</p> : null}
    <p>{QUOTATION_BASIS}</p>
    {model.tables.map((table, index) => (
      <QuoteTablePrint key={`table-${index}`} table={table} caption={index === 0 ? 'Báo giá:' : 'Báo giá (tiếp):'} />
    ))}
    <p className="d5-heading">B. Đề xuất &amp; đánh giá:</p>
    <p>- {model.proposalLine}</p>
    <p>- Đánh giá: {model.assessment}</p>
    <p>- {OTHER_SUPPLIER_NOTE}</p>
    <p className="d5-heading">Các vấn đề cần lưu ý và nêu rõ trong tờ trình:</p>
    <p>
      {NOTES_INTRO} {model.desiredDate}
    </p>
    <p>Hồ sơ đính kèm:</p>
    <CheckLine label="Báo giá của nhà thầu" isChecked={model.hasQuotations} />
    <CheckLine label="Biên bản ghi nhận sự việc" isChecked={model.hasIncidentMinutes} />
    <p>
      <span className="d5-heading">Ý kiến của Ban Quản Trị:</span> {model.boardOpinion}
    </p>
    <p>{CLOSING}</p>
    <p>Trân trọng cảm ơn!</p>
    <div className="d5-sign-row">
      <div>
        <p>{model.boardDateLine}</p>
        <SignatureBox heading={['TM. Ban quản trị', `Tòa nhà ${model.buildingName}`]} titleLine={DOTS} signature={model.boardSignature} />
      </div>
      <div>
        <p>{model.managerDateLine}</p>
        <SignatureBox heading={['TM. Ban quản lý', DOTS]} titleLine={DOTS} signature={model.managerSignature} />
      </div>
    </div>
  </>
);
