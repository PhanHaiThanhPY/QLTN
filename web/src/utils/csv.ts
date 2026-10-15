import { downloadText } from './download';

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escapes one CSV cell and neutralizes spreadsheet formulas from user input. */
export const csvCell = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
};

/** Builds CSV text with a UTF-8 BOM so Excel/Numbers read Vietnamese correctly. */
export const buildCsv = (headers: string[], rows: unknown[][]): string => {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  return `﻿${lines.join('\r\n')}`;
};

export const downloadCsv = (fileName: string, content: string): void => downloadText(fileName, content, 'text/csv;charset=utf-8');
