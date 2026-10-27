/**
 * Demo equipment (SPEC MT-S1 BR-MT-12), the 16 items of web `mock/seed-maintenance.ts`. A location is named by its
 * building, floor and name in `DEMO_LOCATIONS`; dates are months (and days) from the seeding day, so the warranty
 * warnings stay visible: CAM-A01 ends within 30 days, several others have ended.
 */
export interface SeedItem {
  buildingCode: string;
  floor: string;
  locationName: string;
  ownerCode: string;
  code: string;
  name: string;
  type: string;
  equipment?: { model: string; supplier: string; installMonths: number; warrantyMonths: number; warrantyDays?: number };
}

export const DEMO_ITEMS: readonly SeedItem[] = [
  {
    buildingCode: 'A',
    floor: 'Mái',
    locationName: 'Sân thượng & phòng kỹ thuật thang máy',
    ownerCode: 'BQL-A',
    code: 'TM-A01',
    name: 'Thang máy số 1',
    type: 'Thang máy',
    equipment: {
      model: 'Mitsubishi NexWay 1000kg',
      supplier: 'Công ty TNHH Thang máy & Bảo trì Nam Long',
      installMonths: -18,
      warrantyMonths: 6,
    },
  },
  {
    buildingCode: 'A',
    floor: 'B2',
    locationName: 'Phòng bơm & bể nước ngầm',
    ownerCode: 'BQL-A',
    code: 'BOM-A01',
    name: 'Bơm nước sinh hoạt',
    type: 'Bơm nước',
    equipment: {
      model: 'Ebara 3M 40-200/7.5',
      supplier: 'Công ty CP Cơ điện Sao Việt',
      installMonths: -40,
      warrantyMonths: -16,
    },
  },
  {
    buildingCode: 'A',
    floor: 'B1',
    locationName: 'Phòng máy phát & tủ điện tổng',
    ownerCode: 'BQL-A',
    code: 'MPD-A01',
    name: 'Máy phát điện dự phòng',
    type: 'Máy phát điện',
    equipment: {
      model: 'Cummins C250D5',
      supplier: 'Công ty CP Cơ điện Sao Việt',
      installMonths: -10,
      warrantyMonths: 14,
    },
  },
  {
    buildingCode: 'A',
    floor: 'Trệt',
    locationName: 'Sảnh chính',
    ownerCode: 'BQL-A',
    code: 'BC-A01',
    name: 'Hệ thống báo cháy tự động',
    type: 'PCCC',
  },
  {
    buildingCode: 'B',
    floor: 'Trệt',
    locationName: 'Sảnh & khu thương mại',
    ownerCode: 'BQL-B',
    code: 'CS-B01',
    name: 'Chiếu sáng chung',
    type: 'Chiếu sáng',
  },
  {
    buildingCode: 'B',
    floor: 'Mái',
    locationName: 'Phòng quạt & sân thượng',
    ownerCode: 'BQL-B',
    code: 'TG-B01',
    name: 'Hệ thống thông gió',
    type: 'Thông gió',
  },
  {
    buildingCode: 'A',
    floor: 'B1',
    locationName: 'Hầm xe B1',
    ownerCode: 'BQL-A',
    code: 'CS-A01',
    name: 'Chiếu sáng hầm xe B1',
    type: 'Chiếu sáng',
    equipment: {
      model: 'Rạng Đông LED tube T8 1m2',
      supplier: 'Công ty CP Bóng đèn Phích nước Rạng Đông',
      installMonths: -30,
      warrantyMonths: -6,
    },
  },
  {
    buildingCode: 'A',
    floor: 'Trệt',
    locationName: 'Sảnh chính',
    ownerCode: 'BQL-A',
    code: 'CAM-A01',
    name: 'Hệ thống camera an ninh',
    type: 'Camera/CCTV',
    equipment: {
      model: 'Hikvision DS-7716NI-K4 + 24 camera',
      supplier: 'Công ty TNHH Giải pháp An ninh Toàn Cầu',
      installMonths: -24,
      warrantyMonths: 0,
      warrantyDays: 20,
    },
  },
  {
    buildingCode: 'A',
    floor: 'B1',
    locationName: 'Hầm xe B1',
    ownerCode: 'BQL-A',
    code: 'CC-A01',
    name: 'Cửa cuốn lối vào hầm',
    type: 'Cửa cuốn',
    equipment: {
      model: 'Austdoor S50i + motor YH500',
      supplier: 'Công ty CP Tập đoàn Austdoor',
      installMonths: -36,
      warrantyMonths: -12,
    },
  },
  {
    buildingCode: 'B',
    floor: '3',
    locationName: 'Văn phòng tầng 3',
    ownerCode: 'BQL-B',
    code: 'DH-B01',
    name: 'Điều hòa trung tâm VRV văn phòng',
    type: 'Điều hòa trung tâm',
    equipment: {
      model: 'Daikin VRV A RXQ20AYM',
      supplier: 'Công ty TNHH Điện lạnh Minh Châu',
      installMonths: -14,
      warrantyMonths: 10,
    },
  },
  {
    buildingCode: 'C',
    floor: 'Mái',
    locationName: 'Sân thượng & tháp giải nhiệt',
    ownerCode: 'BQL-B',
    code: 'CH-C01',
    name: 'Chiller & tháp giải nhiệt',
    type: 'Điều hòa trung tâm/Chiller',
    equipment: {
      model: 'Trane CVHE 350RT + tháp Liang Chi LBC-300',
      supplier: 'Công ty CP Cơ điện lạnh REE',
      installMonths: -60,
      warrantyMonths: -36,
    },
  },
  {
    buildingCode: 'C',
    floor: 'B1',
    locationName: 'Hầm xe & phòng bơm',
    ownerCode: 'BQL-B',
    code: 'BOM-C01',
    name: 'Cụm bơm cấp nước sinh hoạt',
    type: 'Bơm nước',
    equipment: {
      model: 'Grundfos Hydro MPC-E 3 CRE 15-3',
      supplier: 'Công ty TNHH Cơ điện Đông Á',
      installMonths: -20,
      warrantyMonths: 4,
    },
  },
  {
    buildingCode: 'C',
    floor: 'Trệt',
    locationName: 'Sảnh chính',
    ownerCode: 'BQL-B',
    code: 'PCCC-C01',
    name: 'Hệ thống chữa cháy sprinkler',
    type: 'PCCC',
    equipment: {
      model: 'Tủ điều khiển Hochiki + bơm chữa cháy Pentax',
      supplier: 'Công ty TNHH Kỹ thuật Hòa Phát Xanh',
      installMonths: -48,
      warrantyMonths: -24,
    },
  },
  {
    buildingCode: 'D',
    floor: 'B1',
    locationName: 'Phòng điện & máy phát',
    ownerCode: 'BQL-B',
    code: 'TD-D01',
    name: 'Tủ điện tổng & bộ chuyển nguồn ATS',
    type: 'Điện',
    equipment: {
      model: 'Schneider Prisma P + ATS Socomec Atys',
      supplier: 'Công ty TNHH Điện Thăng Long',
      installMonths: -40,
      warrantyMonths: -3,
    },
  },
  {
    buildingCode: 'D',
    floor: 'B1',
    locationName: 'Phòng điện & máy phát',
    ownerCode: 'BQL-B',
    code: 'MPD-D01',
    name: 'Máy phát điện dự phòng',
    type: 'Máy phát điện',
    equipment: {
      model: 'Denyo DCA-400SPK',
      supplier: 'Công ty CP Cơ điện Sao Việt',
      installMonths: -8,
      warrantyMonths: 16,
    },
  },
  {
    buildingCode: 'D',
    floor: 'Trệt',
    locationName: 'Sảnh & quầy lễ tân',
    ownerCode: 'BQL-B',
    code: 'TM-D01',
    name: 'Thang máy khách số 1',
    type: 'Thang máy',
    equipment: {
      model: 'Schindler 5500 1350kg',
      supplier: 'Công ty TNHH Thang máy Schindler Việt Nam',
      installMonths: -26,
      warrantyMonths: -2,
    },
  },
];

/** `today` moved by whole months (day clamped to the target month) then days, as `YYYY-MM-DD`. */
export const shiftDate = (today: string, months: number, days = 0): string => {
  const [year, month, day] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  const shifted = new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay) + days));
  return shifted.toISOString().slice(0, 10);
};
