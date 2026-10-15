export type FloorKey = 'B1' | 'G' | '5' | 'R';
export type ViewMode = '3d' | 'map' | 'list' | 'floor3d';
export type RepairStage = 'waiting' | 'active' | 'review' | 'done' | 'normal';

export interface BlockData {
  id: string;
  jobs: number;
  due: number;
}

export interface AssetDef {
  id: string;
  code: string;
  name: string;
  zone: string;
  px: number;
  pz: number;
  x: number;
  y: number;
  seed: RepairStage;
  shared: boolean;
}

export interface RepairHistoryEntry {
  date: string;
  text: string;
}

export interface RepairTask {
  id: string;
  title: string;
  stage: RepairStage;
  location: string;
  owner: string;
  deadline: string;
  contractor: string;
  price: string;
  note: string;
  history: RepairHistoryEntry[];
  before: string;
  after: string;
}

export interface AssetRecord {
  tasks: RepairTask[];
}

export interface Asset extends AssetDef {
  stage: RepairStage;
  status: 'ok' | 'due' | 'issue' | 'unknown';
  task: string;
  date: string;
}

export type SelectedItem =
  | { type: 'asset'; data: Asset }
  | { type: 'zone'; name: string };

export interface ZoneLayout {
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
  index: number;
}

export interface IncidentRecord {
  id: string;
  title: string;
  description: string;
  priority: string;
  location: string;
  block: string;
  assetId: string | null;
}
