import { useState } from 'react';
import {
  QUOTE_LIMITS,
  type BudgetSource,
  type ProposalType,
  type QuoteContractor,
  type QuoteItem,
  type QuoteProposalDraft,
} from '@/domain/quote-proposal';

const EMPTY_ITEM: QuoteItem = { name: '', unit: '', quantity: '' };

const emptyContractor = (itemCount: number): QuoteContractor => ({
  name: '',
  unitPricesVnd: Array.from({ length: itemCount }, () => ''),
  otherCostVnd: '0',
  taxVnd: '',
  quotationAttachmentIds: [],
});

/** D5-TT starts with one item and the 3 contractors DF-03 expects. */
const initialContractors = (draft: QuoteProposalDraft | null, itemCount: number): QuoteContractor[] =>
  draft?.contractors?.length
    ? draft.contractors.map((row) => ({ ...row, unitPricesVnd: [...row.unitPricesVnd] }))
    : Array.from({ length: QUOTE_LIMITS.CONTRACTORS_EXPECTED }, () => emptyContractor(itemCount));

/**
 * Local state of the proposal editor (T04–T06). Starts from the saved draft, or for a resubmission from the last
 * submission's content, so the manager edits instead of retyping.
 */
export const useQuoteForm = (source: QuoteProposalDraft | null) => {
  const startItems = source?.items?.length ? source.items.map((row) => ({ ...row })) : [{ ...EMPTY_ITEM }];
  const [recipient, setRecipient] = useState(source?.recipient ?? '');
  const [preparedByName, setPreparedByName] = useState(source?.preparedByName ?? '');
  const [proposalType, setProposalType] = useState<ProposalType | ''>(source?.proposalType ?? '');
  const [budgetSource, setBudgetSource] = useState<BudgetSource | ''>(source?.budgetSource ?? '');
  const [requestContent, setRequestContent] = useState(source?.requestContent ?? '');
  const [assessment, setAssessment] = useState(source?.assessment ?? '');
  const [desiredApprovalDate, setDesiredApprovalDate] = useState(source?.desiredApprovalDate ?? '');
  const [items, setItems] = useState<QuoteItem[]>(startItems);
  const [contractors, setContractors] = useState<QuoteContractor[]>(() =>
    initialContractors(source, startItems.length),
  );
  const [proposedContractorIndex, setProposedContractorIndex] = useState(source?.proposedContractorIndex ?? 0);
  const [shortfallReason, setShortfallReason] = useState(source?.shortfallReason ?? '');
  const [incidentAttachmentIds, setIncidentAttachmentIds] = useState<string[]>(source?.incidentAttachmentIds ?? []);

  const updateItem = (index: number, patch: Partial<QuoteItem>) =>
    setItems((rows) => rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const addItem = () => {
    setItems((rows) => [...rows, { ...EMPTY_ITEM }]);
    setContractors((rows) => rows.map((row) => ({ ...row, unitPricesVnd: [...row.unitPricesVnd, ''] })));
  };
  const removeItem = (index: number) => {
    setItems((rows) => rows.filter((_, at) => at !== index));
    setContractors((rows) =>
      rows.map((row) => ({ ...row, unitPricesVnd: row.unitPricesVnd.filter((_, at) => at !== index) })),
    );
  };
  const updateContractor = (index: number, patch: Partial<QuoteContractor>) =>
    setContractors((rows) => rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));
  const setUnitPrice = (contractorIndex: number, itemIndex: number, value: string) =>
    setContractors((rows) =>
      rows.map((row, at) =>
        at === contractorIndex
          ? { ...row, unitPricesVnd: row.unitPricesVnd.map((price, line) => (line === itemIndex ? value : price)) }
          : row,
      ),
    );
  const addContractor = () => setContractors((rows) => [...rows, emptyContractor(items.length)]);
  const removeContractor = (index: number) => {
    setContractors((rows) => rows.filter((_, at) => at !== index));
    setProposedContractorIndex((current) => {
      if (current === index) return 0;
      return current > index ? current - 1 : current;
    });
  };

  const payload = {
    recipient: recipient.trim(),
    preparedByName: preparedByName.trim(),
    ...(proposalType ? { proposalType } : {}),
    ...(budgetSource ? { budgetSource } : {}),
    requestContent: requestContent.trim(),
    assessment: assessment.trim(),
    desiredApprovalDate: desiredApprovalDate || '',
    items: items.map((row) => ({ name: row.name.trim(), unit: row.unit.trim(), quantity: row.quantity.trim() })),
    contractors: contractors.map((row) => ({ ...row, name: row.name.trim() })),
    proposedContractorIndex,
    shortfallReason: shortfallReason.trim(),
    incidentAttachmentIds,
  };

  return {
    values: {
      recipient,
      preparedByName,
      proposalType,
      budgetSource,
      requestContent,
      assessment,
      desiredApprovalDate,
      items,
      contractors,
      proposedContractorIndex,
      shortfallReason,
      incidentAttachmentIds,
    },
    set: {
      recipient: setRecipient,
      preparedByName: setPreparedByName,
      proposalType: setProposalType,
      budgetSource: setBudgetSource,
      requestContent: setRequestContent,
      assessment: setAssessment,
      desiredApprovalDate: setDesiredApprovalDate,
      proposedContractorIndex: setProposedContractorIndex,
      shortfallReason: setShortfallReason,
      incidentAttachmentIds: setIncidentAttachmentIds,
    },
    table: { updateItem, addItem, removeItem, updateContractor, setUnitPrice, addContractor, removeContractor },
    payload,
  };
};

export type QuoteForm = ReturnType<typeof useQuoteForm>;
