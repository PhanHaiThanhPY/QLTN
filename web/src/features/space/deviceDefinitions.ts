import type { AssetDef, FloorKey, ZoneLayout } from './types';
import { FLOOR_TYPES } from './constants';

function svgX(px: number): number {
  return 60 + (px + 24) * 18.3;
}

function svgY(pz: number): number {
  return 223 + (pz + 4) * 18;
}

export function getDeviceDefinitions(block: string, floor: FloorKey): AssetDef[] {
  const elevatorDefs: Omit<AssetDef, 'id' | 'x' | 'y'>[] = [
    { code: 'TM-01', name: 'Thang máy 01', zone: 'Sảnh thang máy', px: -4, pz: 1, seed: 'waiting', shared: true },
    { code: 'TM-02', name: 'Thang máy 02', zone: 'Sảnh thang máy', px: 0, pz: 1, seed: 'active', shared: true },
    { code: 'TM-03', name: 'Thang máy 03', zone: 'Sảnh thang máy', px: 4, pz: 1, seed: 'done', shared: true },
  ];

  const floorDefs: Omit<AssetDef, 'id' | 'x' | 'y'>[] =
    floor === 'B1'
      ? [
          { code: 'CAM-01', name: 'Camera bãi xe 01', zone: 'Bãi xe ô tô', px: -14, pz: 10, seed: 'normal', shared: false },
          { code: 'CAM-02', name: 'Camera bãi xe 02', zone: 'Lối xuống hầm', px: 18, pz: 10, seed: 'review', shared: false },
          { code: 'PCCC-01', name: 'Tủ PCCC 01', zone: 'Giao thông hầm', px: -11, pz: 2, seed: 'waiting', shared: false },
          { code: 'BOM-01', name: 'Bơm nước 01', zone: 'Phòng bơm & bể nước', px: -20, pz: -10, seed: 'active', shared: false },
          { code: 'BOM-02', name: 'Bơm nước 02', zone: 'Phòng bơm & bể nước', px: -16, pz: -10, seed: 'normal', shared: false },
          { code: 'DB-01', name: 'Tủ điện hầm', zone: 'Phòng điện', px: -6, pz: -10, seed: 'normal', shared: false },
        ]
      : floor === 'R'
      ? [
          { code: 'NUOC-01', name: 'Cảm biến bồn nước 01', zone: 'Bồn nước mái', px: -19, pz: -10, seed: 'normal', shared: false },
          { code: 'NUOC-02', name: 'Cảm biến bồn nước 02', zone: 'Bồn nước mái', px: -16, pz: -10, seed: 'waiting', shared: false },
          { code: 'QUAT-01', name: 'Quạt thông gió 01', zone: 'Cụm quạt thông gió', px: 4, pz: -10, seed: 'active', shared: false },
          { code: 'QUAT-02', name: 'Quạt thông gió 02', zone: 'Cụm quạt thông gió', px: 8, pz: -10, seed: 'done', shared: false },
          { code: 'DB-01', name: 'Tủ điện mái', zone: 'Khu kỹ thuật', px: 18, pz: -10, seed: 'review', shared: false },
        ]
      : [
          { code: 'CAM-01', name: 'Camera hành lang 01', zone: 'Hành lang phía Tây', px: -13, pz: 2, seed: 'review', shared: false },
          { code: 'CAM-02', name: 'Camera hành lang 02', zone: 'Hành lang phía Đông', px: 12, pz: 2, seed: 'normal', shared: false },
          { code: 'PCCC-01', name: 'Tủ PCCC 01', zone: 'Gần thang bộ 01', px: -17, pz: 2, seed: 'waiting', shared: false },
          { code: 'PCCC-02', name: 'Tủ PCCC 02', zone: 'Gần thang bộ 02', px: 18, pz: 2, seed: 'done', shared: false },
          { code: 'DB-01', name: 'Tủ điện tầng', zone: 'Phòng kỹ thuật', px: 15, pz: -1, seed: 'active', shared: false },
        ];

  const allDefs = [
    ...elevatorDefs.map(d => ({
      ...d,
      id: `${block}-${d.code}`,
      x: svgX(d.px),
      y: svgY(d.pz),
    })),
    ...floorDefs.map(d => ({
      ...d,
      id: `${block}-${floor}-${d.code}`,
      x: svgX(d.px),
      y: svgY(d.pz),
    })),
  ];

  return allDefs;
}

export function getZoneLayout(floor: FloorKey, block: string): ZoneLayout[] {
  const names5 = ['Căn Studio', '1PN', '3PN', '2PN', '3PN', '2PN', 'Studio', '2PN'].map(
    (n, i) => `Căn ${block}${501 + (i < 4 ? i : 11 - i)} · ${n}`,
  );
  const namesB1 = [
    'Phòng bơm & bể nước',
    'Phòng điện',
    'Máy phát dự phòng',
    'Kho kỹ thuật',
    'Bãi xe ô tô',
    'Bãi xe máy',
    'Khu thông gió',
    'Lối xuống hầm',
  ];
  const namesG = [
    'Văn phòng BQL',
    'Phòng sinh hoạt chung',
    'Thư tín & giao nhận',
    'Cửa hàng mẫu',
    'Sảnh đón & bảo vệ',
    'Khu chờ',
    'Dịch vụ mẫu',
    'Sảnh phụ',
  ];
  const namesR = [
    'Bồn nước mái',
    'Phòng kỹ thuật thang',
    'Cụm quạt thông gió',
    'Khu kỹ thuật',
    'Sân mái',
    'Sân mái',
    'Sân mái',
    'Sân mái',
  ];

  const names = floor === '5' ? names5 : floor === 'B1' ? namesB1 : floor === 'G' ? namesG : namesR;
  const widths5 = [12, 9, 15, 12, 15, 12, 9, 12];
  const defaultWidths = [12, 12, 12, 12, 12, 12, 12, 12];
  const widths = floor === '5' ? widths5 : defaultWidths;

  const list: ZoneLayout[] = [];
  for (const side of [-1, 1]) {
    let edge = -24;
    for (let j = 0; j < 4; j++) {
      const i = side === -1 ? j : 4 + j;
      const w = widths[i];
      list.push({ name: names[i], x: edge + w / 2, z: side * 10, w, d: 12, index: i });
      edge += w;
    }
  }
  return list;
}

export function getFloorLabel(floor: FloorKey): string {
  return FLOOR_TYPES[floor];
}
