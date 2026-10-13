/**
 * redact — keep secrets out of anything that leaves the server as a whole row
 * (backups, admin read-outs). Drops every column whose name looks like a secret.
 */
const SECRET_COLUMN = /(token|secret|password|passwd|api_?key|private_?key|backup_codes|two_factor)/i;

export const isSecretColumn = (name: string): boolean => SECRET_COLUMN.test(name);

/** A copy of the row without its secret columns. */
export function stripSecretColumns<T extends Record<string, any>>(row: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row || {})) if (!isSecretColumn(k)) out[k] = v;
  return out as Partial<T>;
}
