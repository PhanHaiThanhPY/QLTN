/** Formatting shared by the D5 print documents (SPEC B7-S1 BR-B7-03, BR-B7-05, BR-B7-07). */

/** What the D5 forms print for a value the system does not hold (BR-B7-03). */
export const DOTS = '……………………';

/** The value, or the dotted line of the form; never `undefined`, `null` or an empty cell. */
export const orDots = (value: string | null | undefined): string => {
  const text = value?.trim();
  return text ? text : DOTS;
};

const vndFormatter = new Intl.NumberFormat('vi-VN');

/** "12500000" → "12.500.000" (integer VND as a string, no float); anything else prints as dots. */
export const printVnd = (value: string | null | undefined): string =>
  value && /^\d+$/.test(value) ? vndFormatter.format(BigInt(value)) : DOTS;

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export interface VnDateParts {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
}

/** Vietnam-time parts of an instant ("2026-10-22T07:15:00Z" → 22/10/2026 14:15). */
export const vnDateParts = (iso: string): VnDateParts => {
  const parts = partsFormatter.formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((row) => row.type === type)?.value ?? '';
  return { day: part('day'), month: part('month'), year: part('year'), hour: part('hour'), minute: part('minute') };
};

/** "22/10/2026" in Vietnam time. */
export const printDate = (iso: string | null | undefined): string => {
  if (!iso) return DOTS;
  const { day, month, year } = vnDateParts(iso.length === 10 ? `${iso}T00:00:00+07:00` : iso);
  return `${day}/${month}/${year}`;
};

/** "14:15 22/10/2026" in Vietnam time. */
export const printDateTime = (iso: string): string => {
  const { day, month, year, hour, minute } = vnDateParts(iso);
  return `${hour}:${minute} ${day}/${month}/${year}`;
};

/** The form's "Ngày … tháng … năm …" line. */
export const formDateLine = (iso: string): string => {
  const { day, month, year } = vnDateParts(iso);
  return `Ngày ${day} tháng ${month} năm ${year}`;
};

/** BR-B7-05: replaces the form's "(Đã ký)". */
export const signedAtLine = (iso: string): string => `Ký trên hệ thống QLTN lúc ${printDateTime(iso)}`;

/**
 * "tòa nhà «tên»" without doubling the word when the building name already starts with it
 * ("Tòa A – An Khang" → "tòa nhà A – An Khang"), as api-qltn does for "Kính gửi".
 */
export const buildingPhrase = (buildingName: string): string => `tòa nhà ${buildingName.replace(/^tòa\s+(nhà\s+)?/i, '')}`;

/** A signed box of a form: image, signer name and when (BR-B7-05). An unsigned box stays empty for a hand signature. */
export interface PrintSignature {
  imageDataUrl: string;
  signerName: string;
  signedAt: string;
}

/** Names the documents print: a person's full name (no code) and the building name. */
export interface PrintNames {
  person: (userId: string | null | undefined) => string;
  building: (buildingId: string) => string;
}
