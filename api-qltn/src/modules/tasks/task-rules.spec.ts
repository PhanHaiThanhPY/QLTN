import type { RepairRecord } from '../records/entities/repair-record.entity';
import { compareTasks, type TaskView } from './tasks.service';
import { currentStepDue, tasksOfRecord, type HolderState, type RecordTaskFacts } from './task-rules';

const AT = new Date('2026-11-10T02:00:00.000Z'); // 09:00 on 10/11 in Vietnam
const record = (overrides: Partial<RepairRecord> = {}): RepairRecord =>
  ({
    id: 'rec-1',
    code: 'SC-001',
    status: 'PENDING_CONFIRMATION',
    managerUserId: 'bql',
    confirmationUserId: 'kt',
    approvalStepKeys: ['TECH', 'BOARD'],
    workflowApprovalSteps: [],
    workflowStageApprovalStepKeys: { INTAKE: ['TECH_CONFIRM'], ACCEPTANCE: ['MANAGER', 'BOARD', 'TECH'] },
    approvalAssigneeUserIds: { TECH: 'tvkt', BOARD: 'bqt', TECH_CONFIRM: 'kt' },
    currentApprovalStepKey: null,
    currentSubmissionId: null,
    taskDueDays: {
      CONFIRM_RECORD: 2,
      APPROVE_PROPOSAL: 3,
      REVIEW_ACCEPTANCE: 4,
      APPROVE_PAYMENT: 5,
      REVIEW_MAINTENANCE: 1,
    },
    emergency: null,
    ...overrides,
  }) as unknown as RepairRecord;

const facts = (
  overrides: Partial<RecordTaskFacts> = {},
  states: Record<string, HolderState> = {},
): RecordTaskFacts => ({
  enteredAt: AT,
  proposalStepStartedAt: null,
  round: null,
  instalments: [],
  holderState: (userId) => (userId ? (states[userId] ?? 'OK') : 'INVALID'),
  userName: (userId) => `Tên ${userId ?? '?'}`,
  ...overrides,
});

const summary = (rec: RepairRecord, f: RecordTaskFacts = facts()) =>
  tasksOfRecord(rec, f).map((task) => ({
    kind: task.kind,
    assignee: task.assignee,
    dueAt: task.dueAt?.toISOString() ?? null,
  }));

describe('repair tasks (TK-S1 BR-TK-02)', () => {
  it('gives the confirmer "Xác nhận hồ sơ" due 2 days after entering the status (AC-TK.1, AC-TK.6)', () => {
    expect(summary(record())).toEqual([
      { kind: 'CONFIRM_RECORD', assignee: { userId: 'kt' }, dueAt: '2026-11-12T02:00:00.000Z' },
    ]);
  });

  it.each([
    ['NEEDS_RECORD_UPDATE', 'UPDATE_RECORD'],
    ['PENDING_PROPOSAL', 'PREPARE_PROPOSAL'],
    ['NEEDS_SUBMISSION_UPDATE', 'PREPARE_PROPOSAL'],
    ['REJECTED_RESUBMITTABLE', 'PREPARE_PROPOSAL'],
    ['READY_FOR_CONSTRUCTION', 'START_CONSTRUCTION'],
    ['IN_CONSTRUCTION', 'UPDATE_CONSTRUCTION'],
    ['NEEDS_REPAIR', 'FIX_DEFECT'],
    ['PENDING_PAYMENT_REQUEST', 'PREPARE_PAYMENT_REQUEST'],
    ['NEEDS_PAYMENT_UPDATE', 'PREPARE_PAYMENT_REQUEST'],
  ])('gives the manager the %s task without a deadline (AC-TK.8)', (status, kind) => {
    expect(summary(record({ status }))).toEqual([{ kind, assignee: { userId: 'bql' }, dueAt: null }]);
  });

  it('dates the emergency documents by B06 and drops the date once submitted', () => {
    const emergency = { docsDueAt: '2026-11-11T02:00:00.000Z', docsSubmittedAt: null } as RepairRecord['emergency'];
    expect(summary(record({ status: 'EMERGENCY_IN_PROGRESS', emergency }))[0]).toEqual({
      kind: 'SUBMIT_EMERGENCY_DOCS',
      assignee: { userId: 'bql' },
      dueAt: '2026-11-11T02:00:00.000Z',
    });
  });

  it('gives the current proposal step holder a task dated from the start of that step (AC-TK.2)', () => {
    const rec = record({ status: 'PENDING_BOARD_APPROVAL', currentApprovalStepKey: 'BOARD' });
    const started = new Date('2026-11-11T02:00:00.000Z');
    expect(summary(rec, facts({ proposalStepStartedAt: started }))).toEqual([
      { kind: 'APPROVE_PROPOSAL', assignee: { userId: 'bqt' }, dueAt: '2026-11-14T02:00:00.000Z' },
    ]);
  });

  it('gives each acceptance member who has not decided one task, a person once (AC-TK.3)', () => {
    const rec = record({ status: 'PENDING_ACCEPTANCE' });
    const round = { startedAt: AT, memberStepKeys: ['MANAGER', 'BOARD', 'TECH'], decidedStepKeys: ['MANAGER'] };
    expect(summary(rec, facts({ round })).map((task) => task.assignee)).toEqual([
      { userId: 'bqt' },
      { userId: 'tvkt' },
    ]);
    expect(summary(rec, facts({ round }))[0].dueAt).toBe('2026-11-14T02:00:00.000Z');
  });

  it('turns instalments into approval for the step holder and transfer for every PAYMENT_CONFIRM holder (AC-TK.4)', () => {
    const rec = record({ status: 'IN_CONSTRUCTION' });
    const instalments = [
      {
        id: 'p1',
        kind: 'TAM_UNG' as const,
        status: 'PENDING_APPROVAL' as const,
        currentStepKey: 'BOARD',
        stepStartedAt: AT,
      },
      {
        id: 'p2',
        kind: 'QUYET_TOAN' as const,
        status: 'PENDING_TRANSFER' as const,
        currentStepKey: null,
        stepStartedAt: AT,
      },
    ];
    expect(summary(rec, facts({ instalments }))).toEqual([
      { kind: 'UPDATE_CONSTRUCTION', assignee: { userId: 'bql' }, dueAt: null },
      { kind: 'APPROVE_ADVANCE', assignee: { userId: 'bqt' }, dueAt: '2026-11-15T02:00:00.000Z' },
      { kind: 'RECORD_PAYMENT', assignee: { capability: 'PAYMENT_CONFIRM' }, dueAt: null },
    ]);
  });

  it('gives the BOARD holder the post-review closing', () => {
    expect(summary(record({ status: 'POST_REVIEW_REJECTED' }))).toEqual([
      { kind: 'CLOSE_POST_REVIEW', assignee: { userId: 'bqt' }, dueAt: null },
    ]);
  });

  it('has no task on a final record', () => {
    expect(summary(record({ status: 'COMPLETED' }))).toEqual([]);
    expect(summary(record({ status: 'UNRESOLVED' }))).toEqual([]);
  });
});

describe('reassignment (TK-S1 BR-TK-03)', () => {
  it('takes the task from a locked holder and gives the manager one line naming the step and person (AC-TK.5)', () => {
    const rec = record({ status: 'PENDING_BOARD_APPROVAL', currentApprovalStepKey: 'BOARD' });
    const tasks = tasksOfRecord(rec, facts({}, { bqt: 'LOCKED' }));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      kind: 'REASSIGN_REQUIRED',
      assignee: { userId: 'bql' },
      detail: 'Bước BQT duyệt · Tên bqt (đã khóa)',
    });
  });

  it('lists every blocked member in one task, and sends it to the admins when the manager is blocked too', () => {
    const rec = record({ status: 'PENDING_ACCEPTANCE' });
    const round = { startedAt: AT, memberStepKeys: ['MANAGER', 'BOARD', 'TECH'], decidedStepKeys: [] };
    const tasks = tasksOfRecord(rec, facts({ round }, { bql: 'INVALID', bqt: 'LOCKED' }));
    const reassign = tasks.filter((task) => task.kind === 'REASSIGN_REQUIRED');
    expect(reassign).toHaveLength(1);
    expect(reassign[0].assignee).toEqual({ role: 'ADMIN' });
    expect(reassign[0].detail).toContain('(đã khóa)');
    expect(reassign[0].detail).toContain('(không còn hợp lệ)');
    expect(tasks.filter((task) => task.kind === 'REVIEW_ACCEPTANCE').map((task) => task.assignee)).toEqual([
      { userId: 'tvkt' },
    ]);
  });
});

describe('deadlines (TK-S1 BR-TK-04)', () => {
  it('keeps the snapshotted days (AC-TK.7) and has no date for a kind without days', () => {
    expect(
      currentStepDue(
        record({ taskDueDays: { CONFIRM_RECORD: 2 } as RepairRecord['taskDueDays'] }),
        facts(),
      )?.toISOString(),
    ).toBe('2026-11-12T02:00:00.000Z');
    expect(currentStepDue(record({ status: 'PENDING_PROPOSAL' }), facts())).toBeNull();
  });

  it('gives the record its current step deadline even when the holder is blocked', () => {
    expect(currentStepDue(record(), facts({}, { kt: 'LOCKED' }))?.toISOString()).toBe('2026-11-12T02:00:00.000Z');
  });
});

describe('order of open tasks (TK-S1 BR-TK-07, AC-TK.11)', () => {
  const view = (
    code: string,
    overrides: Partial<TaskView>,
    recordOverrides: Partial<TaskView['record']> = {},
  ): TaskView => ({
    id: code,
    kind: 'CONFIRM_RECORD',
    label: 'Xác nhận hồ sơ',
    tab: 'overview',
    detail: null,
    dueAt: null,
    isOverdue: false,
    startedAt: AT,
    record: {
      id: code,
      code,
      title: code,
      buildingId: 'a',
      locationId: null,
      status: 'X',
      priority: 'NORMAL',
      isEmergency: false,
      ...recordOverrides,
    },
    ...overrides,
  });

  it('puts overdue first, then urgent records, then dated, then undated', () => {
    const tasks = [
      view('NO-DUE', {}),
      view('TOMORROW', { dueAt: new Date('2026-11-11T02:00:00.000Z') }),
      view('URGENT', { dueAt: new Date('2026-11-13T02:00:00.000Z') }, { priority: 'URGENT' }),
      view('OVERDUE', { dueAt: new Date('2026-11-09T02:00:00.000Z'), isOverdue: true }),
    ];
    expect(tasks.sort(compareTasks).map((task) => task.id)).toEqual(['OVERDUE', 'URGENT', 'TOMORROW', 'NO-DUE']);
  });
});
