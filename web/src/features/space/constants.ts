import type { BlockData, FloorKey, RepairStage } from './types';

export const BLOCKS: BlockData[] = [
  { id: 'A', jobs: 3, due: 2 },
  { id: 'B', jobs: 2, due: 1 },
  { id: 'C', jobs: 1, due: 2 },
  { id: 'D', jobs: 1, due: 1 },
];

export const FLOOR_TYPES: Record<FloorKey, string> = {
  B1: 'Tầng hầm',
  G: 'Tầng trệt',
  '5': 'Tầng 5 · Căn hộ',
  R: 'Tầng mái',
};

export const REPAIR_STAGES: Record<RepairStage, { label: string; color: string }> = {
  waiting: { label: 'Chờ sửa', color: '#d35b60' },
  active: { label: 'Đang sửa', color: '#dc922d' },
  review: { label: 'Chờ nghiệm thu', color: '#537bc1' },
  done: { label: 'Đã sửa · nghiệm thu', color: '#198b77' },
  normal: { label: 'Chưa có sự cố', color: '#81939c' },
};

export const STATUS_COLORS = {
  ok: '#198b77',
  due: '#e6a246',
  issue: '#e16c69',
  unknown: '#8b9ca6',
};

export const STATUS_LABELS = {
  ok: 'Đã kiểm tra',
  due: 'Đến hạn bảo trì',
  issue: 'Có sự cố',
  unknown: 'Chưa kiểm tra',
};

export const BLOCK_TINTS: Record<string, string> = {
  A: '#d5d7cb',
  B: '#c5cdc8',
  C: '#d9d4c4',
  D: '#c9d2cc',
};

export const BLOCK_FLOORS: Record<string, number> = {
  A: 17,
  B: 15,
  C: 13,
  D: 16,
};

export const BLOCK_POSITIONS: Record<string, [number, number]> = {
  A: [-27, -19],
  B: [27, -19],
  C: [-27, 19],
  D: [27, 19],
};
