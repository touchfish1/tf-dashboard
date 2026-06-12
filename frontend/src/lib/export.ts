/** Client-side CSV export */

export function escapeCSVCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export function buildCSV(headers: string[], rows: string[][]): string {
  return [
    headers.join(","),
    ...rows.map((r) => r.map(escapeCSVCell).join(",")),
  ].join("\n");
}

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: string[][]
) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + buildCSV(headers, rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
