import Papa from "papaparse";

/** Neutralises spreadsheet formula injection (CWE-1236) in exported cells. */
export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return Papa.unparse({ fields: headers, data: rows.map((r) => r.map(sanitizeCell)) });
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  if (file.size > MAX_CSV_BYTES) {
    return Promise.resolve({ headers: [], rows: [], errors: ["File is larger than 2 MB."] });
  }
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (result) =>
        resolve({
          headers: result.meta.fields ?? [],
          rows: result.data,
          errors: result.errors.slice(0, 5).map((e) => `Row ${(e.row ?? 0) + 1}: ${e.message}`),
        }),
    });
  });
}
