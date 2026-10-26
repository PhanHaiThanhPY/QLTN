import { dataOf, type Session } from './app-harness';

/** Shared steps that bring a repair record through S1 and S2 for the later slices' e2e suites. */

export interface FlowRecord {
  id: string;
  code: string;
  status: string;
  version: number;
  confirmationUserId: string;
  executingContractorName: string | null;
}

export interface FlowSessions {
  manager: Session;
  /** Confirmer of the record (INTAKE holder): TVKT on AQUA, KT on the default template. */
  confirmer: (record: FlowRecord) => Session;
  /** Holders of the proposal chain, in order. */
  approvers: (record: FlowRecord) => Session[];
  /** Holder of the BQT-role step, who must attach board minutes. */
  board: Session;
}

export const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('repair flow', 'utf8'),
]);
export const PDF = Buffer.from('%PDF-1.4\n% repair flow\n', 'utf8');
export const SIGNATURE = `data:image/png;base64,${PNG.toString('base64')}`;

export const upload = async (session: Session, recordId: string, purpose: string): Promise<string> =>
  dataOf<{ id: string }>(
    await session
      .postMultipart(
        '/api/attachments',
        { subjectType: 'REPAIR_RECORD', subjectId: recordId, purpose },
        ['SITE_PHOTO', 'ACCEPTANCE', 'CONSTRUCTION'].includes(purpose)
          ? { content: PNG, filename: `${purpose.toLowerCase()}.png`, contentType: 'image/png' }
          : { content: PDF, filename: `${purpose.toLowerCase()}.pdf`, contentType: 'application/pdf' },
      )
      .expect(201),
  ).id;

/** Creates, submits and confirms a record in the first location of `buildingId`: PENDING_PROPOSAL. */
export const confirmedRecord = async (
  sessions: FlowSessions,
  buildingId: string,
  title: string,
): Promise<FlowRecord> => {
  const reference = dataOf<{ locations: Array<{ id: string; buildingId: string }> }>(
    await sessions.manager.get('/api/reference'),
  );
  const locationId = (reference.locations.find((row) => row.buildingId === buildingId) as { id: string }).id;
  const draft = dataOf<FlowRecord>(
    await sessions.manager
      .post('/api/records', {
        buildingId,
        locationId,
        title,
        description: 'Ống cấp nước trần hành lang bị rò, cần sửa.',
        noMaintenanceItem: true,
      })
      .expect(201),
  );
  const photo = await upload(sessions.manager, draft.id, 'SITE_PHOTO');
  const pending = dataOf<FlowRecord>(
    await sessions.manager
      .post(`/api/records/${draft.id}/submit`, { version: draft.version, attachmentIds: [photo] })
      .expect(200),
  );
  return dataOf<FlowRecord>(
    await sessions
      .confirmer(pending)
      .post(`/api/records/${pending.id}/confirm-repair`, { version: pending.version, note: 'Đúng hiện trạng.' })
      .expect(200),
  );
};

/** One item, one contractor ("Công ty Thủy Tín", 1 000 000 ₫), approved by the whole chain: READY_FOR_CONSTRUCTION. */
export const readyForConstruction = async (
  sessions: FlowSessions,
  buildingId: string,
  title: string,
): Promise<FlowRecord> => {
  let record = await confirmedRecord(sessions, buildingId, title);
  const incident = await upload(sessions.manager, record.id, 'INCIDENT_MINUTES');
  const quotation = await upload(sessions.manager, record.id, 'QUOTATION');
  record = dataOf<FlowRecord>(
    await sessions.manager
      .post(`/api/records/${record.id}/submit-proposal`, {
        version: record.version,
        proposalType: 'SUA_CHUA',
        budgetSource: 'KINH_PHI_BAO_TRI',
        requestContent: 'Thay đoạn ống cấp nước bị rò.',
        assessment: 'Ống cũ đã mục, thay mới cả đoạn.',
        items: [{ name: 'Ống cấp', unit: 'm', quantity: '2' }],
        contractors: [
          {
            name: 'Công ty Thủy Tín',
            unitPricesVnd: ['500000'],
            otherCostVnd: '0',
            taxVnd: '0',
            quotationAttachmentIds: [quotation],
          },
        ],
        proposedContractorIndex: 0,
        shortfallReason: 'Chỉ một nhà thầu nhận việc gấp.',
        incidentAttachmentIds: [incident],
        signature: SIGNATURE,
      })
      .expect(200),
  );
  for (const approver of sessions.approvers(record)) {
    const evidence =
      approver === sessions.board
        ? {
            boardMinutesAttachmentIds: [await upload(sessions.board, record.id, 'BOARD_MINUTES')],
            signature: SIGNATURE,
          }
        : {};
    record = dataOf<FlowRecord>(
      await approver
        .post(`/api/records/${record.id}/approve-proposal`, { version: record.version, ...evidence })
        .expect(200),
    );
  }
  return record;
};
