import { writeXlsx } from '../src/common/xlsx/xlsx-writer';

/** Test fixture: a one-sheet XLSX; numbers stay numbers (a decimal one included), text is inline. */
type FixtureCell = string | number | null;

export const xlsxOf = (rows: ReadonlyArray<readonly FixtureCell[]>): Buffer =>
  writeXlsx([
    {
      name: 'Sao ke',
      rows: rows.map((row) => row.map((cell) => (typeof cell === 'number' ? { number: cell } : cell))),
    },
  ]);
