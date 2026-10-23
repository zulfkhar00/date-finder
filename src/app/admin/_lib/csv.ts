// RFC 4180 CSV. Cells starting with = + - @ (or tab/CR) are prefixed with ' so spreadsheet apps
// do not evaluate user-supplied text (city, UTM values) as formulas.

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T extends Record<string, unknown>>(columns: readonly (keyof T & string)[], rows: readonly T[]): string {
  const lines = [columns.map(cell).join(",")];
  for (const row of rows) lines.push(columns.map((column) => cell(row[column])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
