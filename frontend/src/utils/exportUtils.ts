export interface ExportColumn<T> {
  header: string;
  accessor: keyof T;
}

/**
 * Exports data to a UTF-8 CSV file with BOM for Excel compatibility.
 * Filename format: {entityName}-{YYYY-MM-DD}.csv
 */
export function exportToCSV<T extends Record<string, any>>(
  rows: T[],
  columns: ExportColumn<T>[],
  entityName: string
): void {
  const header = columns.map(c => `"${c.header}"`).join(',');
  const body = rows.map(row =>
    columns
      .map(c => `"${String(row[c.accessor] ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${entityName.toLowerCase().replace(/\s+/g, '-')}-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface PDFExportOptions {
  schoolName?: string;
  reportTitle: string;
  headers: string[];
  rows: string[][];
}

/**
 * Opens a print dialog with a formatted HTML table.
 * No external library required — uses browser native print.
 */
export function exportToPDF(options: PDFExportOptions): void {
  const { schoolName = 'School Management System', reportTitle, headers, rows } = options;
  const date = new Date().toLocaleDateString('en-GB');

  const tableRows = rows
    .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${reportTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
    header { margin-bottom: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #6B7280; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #F3F4F6; text-align: left; padding: 8px 12px; border-bottom: 2px solid #E5E7EB; }
    td { padding: 8px 12px; border-bottom: 1px solid #E5E7EB; }
    tr:nth-child(even) td { background: #F9FAFB; }
  </style>
</head>
<body>
  <header>
    <h1>${schoolName}</h1>
    <p class="meta">${reportTitle} &mdash; Generated ${date}</p>
  </header>
  <table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}
