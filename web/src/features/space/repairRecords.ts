import type { AssetDef, AssetRecord, FloorKey, RepairStage, RepairTask, Asset } from './types';
import { FLOOR_TYPES, REPAIR_STAGES } from './constants';

const STORAGE_KEY = 'condoRepairV2';

let cache: Record<string, AssetRecord> = {};
try {
  cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, AssetRecord>;
} catch {
  cache = {};
}

export function persistRepairs(): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

export function getAssetRecord(a: AssetDef, floor: FloorKey): AssetRecord {
  if (!cache[a.id]) {
    const completed = a.seed === 'done';
    const task: RepairTask = {
      id: a.id + '-SC01',
      title: a.shared
        ? 'Kiểm tra lỗi cửa / cảm biến thang máy'
        : 'Kiểm tra và xử lý ' + a.name.toLowerCase(),
      stage: a.seed,
      location: a.shared ? 'Tầng 5 · dữ liệu mẫu' : FLOOR_TYPES[floor],
      owner: '',
      deadline: '18/10/2026',
      contractor: '',
      price: '',
      note: completed ? 'Đã kiểm tra vận hành sau sửa chữa (mẫu).' : '',
      history: [
        {
          date: '14/10/2026',
          text: completed
            ? 'BQL đã nghiệm thu đạt (dữ liệu mẫu)'
            : 'Khởi tạo hồ sơ mẫu · ' + REPAIR_STAGES[a.seed].label,
        },
      ],
      before: '',
      after: '',
    };
    cache[a.id] = { tasks: a.seed === 'normal' ? [] : [task] };
  }
  return cache[a.id];
}

export function getAssetStage(a: AssetDef, floor: FloorKey): RepairStage {
  const tasks = getAssetRecord(a, floor).tasks;
  for (const s of ['waiting', 'active', 'review'] as RepairStage[]) {
    if (tasks.some(t => t.stage === s)) return s;
  }
  return tasks.length ? 'done' : 'normal';
}

export function buildAsset(def: AssetDef, floor: FloorKey): Asset {
  const stage = getAssetStage(def, floor);
  const status: Asset['status'] =
    stage === 'done' || stage === 'normal' ? 'ok' : stage === 'waiting' ? 'issue' : 'due';
  return {
    ...def,
    stage,
    status,
    task: 'Theo dõi hồ sơ sửa chữa',
    date: '18/10/2026',
  };
}

export function updateTaskField(
  assetId: string,
  taskId: string,
  fields: Partial<RepairTask>,
): boolean {
  const rec = cache[assetId];
  if (!rec) return false;
  const task = rec.tasks.find(t => t.id === taskId);
  if (!task) return false;
  Object.assign(task, fields);
  return persistRepairs();
}

export function transitionRepair(
  assetId: string,
  taskId: string,
  next: RepairStage,
  ownerValue: string,
  noteValue: string,
): { ok: boolean; error?: string } {
  const rec = cache[assetId];
  if (!rec) return { ok: false, error: 'Không tìm thấy hồ sơ' };
  const task = rec.tasks.find(t => t.id === taskId);
  if (!task) return { ok: false, error: 'Không tìm thấy công việc' };

  const allowed: Record<RepairStage, RepairStage[]> = {
    waiting: ['active'],
    active: ['review'],
    review: ['done', 'active'],
    done: [],
    normal: [],
  };
  if (!allowed[task.stage]?.includes(next)) return { ok: false, error: 'Chuyển trạng thái không hợp lệ' };

  if (!ownerValue) {
    return { ok: false, error: 'Điền người phụ trách trước khi chuyển bước.' };
  }
  if ((next === 'review' || next === 'done') && !noteValue) {
    return { ok: false, error: 'Điền ghi chú xử lý / nghiệm thu trước khi chuyển bước.' };
  }

  const backup = JSON.stringify(task);
  task.owner = ownerValue;
  task.note = noteValue;
  task.stage = next;
  task.history.push({
    date: new Date().toLocaleString('vi-VN'),
    text:
      (next === 'done'
        ? 'BQL xác nhận nghiệm thu đạt'
        : next === 'active'
        ? 'Bắt đầu / yêu cầu sửa lại'
        : 'Báo sửa xong, chờ BQL nghiệm thu') +
      ' · ' +
      ownerValue +
      ' · ' +
      noteValue,
  });

  if (!persistRepairs()) {
    Object.assign(task, JSON.parse(backup) as RepairTask);
    return { ok: false, error: 'Bộ nhớ demo đã đầy. Chưa lưu được thay đổi.' };
  }
  return { ok: true };
}

export function addIncidentTask(assetId: string, incident: {
  id: string;
  title: string;
  description: string;
  floor: FloorKey;
}): void {
  const rec = cache[assetId];
  if (!rec) return;
  rec.tasks.push({
    id: incident.id,
    title: incident.title,
    stage: 'waiting',
    location: FLOOR_TYPES[incident.floor],
    owner: '',
    deadline: '',
    contractor: '',
    price: '',
    note: incident.description,
    history: [
      {
        date: new Date().toLocaleString('vi-VN'),
        text: 'Ghi nhận sự cố · ' + incident.description,
      },
    ],
    before: '',
    after: '',
  });
  persistRepairs();
}

export function uploadImage(assetId: string, taskId: string, kind: 'before' | 'after', dataUrl: string): boolean {
  const rec = cache[assetId];
  if (!rec) return false;
  const task = rec.tasks.find(t => t.id === taskId);
  if (!task) return false;
  const old = task[kind];
  task[kind] = dataUrl;
  if (!persistRepairs()) {
    task[kind] = old;
    return false;
  }
  return true;
}

export function resetRepairDemo(): void {
  cache = {};
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('condoIncidents');
}

export function getRepairRevision(): number {
  return Object.keys(cache).length;
}
