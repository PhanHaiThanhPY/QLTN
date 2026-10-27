import { inflateRawSync } from 'zlib';
import type { Cell } from '../../domain/bank-statement';

/**
 * Readers of the standard statement template (SPEC F-S4 BR-F4-02): CSV in UTF-8, or the first sheet of an XLSX. The
 * XLSX side is a minimal zip + XML reader (no dependency): shared strings, inline strings and plain values only.
 */

export const STATEMENT_FILE_MAX_BYTES = 5 * 1024 * 1024;

export class StatementFileError extends Error {}

const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_END = 0x06054b50;

/** Entries of a zip archive by name (stored or deflated). */
const unzip = (buffer: Buffer): Map<string, Buffer> => {
  let end = -1;
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 65_557); at -= 1) {
    if (buffer.readUInt32LE(at) === ZIP_END) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new StatementFileError('Tệp XLSX bị hỏng.');
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(at) !== ZIP_CENTRAL) throw new StatementFileError('Tệp XLSX bị hỏng.');
    const method = buffer.readUInt16LE(at + 10);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
    if (buffer.readUInt32LE(local) !== ZIP_LOCAL) throw new StatementFileError('Tệp XLSX bị hỏng.');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + size);
    if (method === 0) files.set(name, data);
    else if (method === 8) files.set(name, inflateRawSync(data));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
};

const decodeXml = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

/** The text of every <t> inside a fragment (rich text runs are concatenated). */
const textOf = (fragment: string): string => [...fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join('');

const columnIndex = (ref: string): number =>
  [...ref.replace(/\d+$/, '')].reduce((total, letter) => total * 26 + (letter.charCodeAt(0) - 64), 0) - 1;

/** Path of the workbook's first sheet, through workbook.xml and its relationships. */
const firstSheetPath = (files: Map<string, Buffer>): string => {
  const workbook = files.get('xl/workbook.xml')?.toString('utf8') ?? '';
  const relId = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? '';
  const target = relId
    ? [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((match) => match[0]).find((tag) => tag.includes(`Id="${relId}"`))
    : undefined;
  const path = target ? /Target="([^"]+)"/.exec(target)?.[1] : undefined;
  if (!path) return 'xl/worksheets/sheet1.xml';
  return path.startsWith('/') ? path.slice(1) : `xl/${path.replace(/^\.\//, '')}`;
};

/** The first sheet as rows of cells; row numbers are kept (a missing row stays an empty line). */
export const readXlsx = (buffer: Buffer): Cell[][] => {
  const files = unzip(buffer);
  const sheet = files.get(firstSheetPath(files))?.toString('utf8');
  if (!sheet) throw new StatementFileError('Không tìm thấy trang tính đầu tiên trong tệp XLSX.');
  const shared = [...(files.get('xl/sharedStrings.xml')?.toString('utf8') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    textOf(match[1]),
  );
  const rows: Cell[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const number = Number(/\br="(\d+)"/.exec(rowMatch[1])?.[1] ?? rows.length + 1);
    while (rows.length < number - 1) rows.push([]);
    const cells: Cell[] = [];
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1];
      const body = cellMatch[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
      const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: Cell = null;
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'str' || type === 'b') value = raw === undefined ? null : decodeXml(raw);
      else if (raw !== undefined) value = Number(raw);
      cells[ref ? columnIndex(ref) : cells.length] = value;
    }
    rows.push(Array.from(cells, (cell) => cell ?? null));
  }
  return rows;
};

/** RFC 4180 CSV in UTF-8 (a BOM is dropped); ";" is the separator when the header uses it instead of ",". */
export const readCsv = (buffer: Buffer): Cell[][] => {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new StatementFileError('Tệp CSV phải mã UTF-8.');
  }
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const separator = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows: Cell[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (quoted) {
      if (char === '"' && text[at + 1] === '"') {
        field += '"';
        at += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[at + 1] === '\n') at += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

/** Reads a template file by its content: a zip (XLSX) or CSV text. */
export const readStatementFile = (buffer: Buffer): Cell[][] => {
  if (buffer.length > STATEMENT_FILE_MAX_BYTES) throw new StatementFileError('Tệp vượt quá 5 MB.');
  return buffer.length >= 4 && buffer.readUInt32LE(0) === ZIP_LOCAL ? readXlsx(buffer) : readCsv(buffer);
};

/** BR-F4-02: the empty template with two example lines (CSV, UTF-8 with BOM so spreadsheets read the accents). */
export const statementTemplateCsv = (): Buffer =>
  Buffer.from(
    '﻿Ngày giao dịch,Ghi có,Ghi nợ,Nội dung,Số tham chiếu,Số tài khoản\r\n' +
      '18/11/2026,10000000,,DV-A chuyển tiền hợp đồng HĐ-001,FT26322001,\r\n' +
      '30/11/2026,,11000,Phí SMS Banking tháng 11,,\r\n',
    'utf8',
  );
