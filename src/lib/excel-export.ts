import * as XLSX from "xlsx";

export interface SheetSpec {
  name: string;
  /** Array of rows; first row is treated as header if `header` not provided */
  rows: (string | number | null)[][];
  header?: string[];
  /** Optional column widths in characters */
  colWidths?: number[];
}

export function exportXlsx(filename: string, sheets: SheetSpec[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const data = s.header ? [s.header, ...s.rows] : s.rows;
    const ws = XLSX.utils.aoa_to_sheet(data);
    if (s.colWidths) ws["!cols"] = s.colWidths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const safe = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safe);
}

/** Helper: format number for currency cell (kept as number for Excel sums) */
export const num = (n: number | null | undefined) => (n == null ? 0 : Number(n));
