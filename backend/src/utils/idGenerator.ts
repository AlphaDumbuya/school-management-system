import { Knex } from 'knex';

export type IdType = 'student' | 'teacher' | 'admission';

/**
 * Generate a unique ID based on the tenant's ID format settings stored in school_config_settings.
 *
 * The generator:
 *  1. Reads prefix, separator, year format, padding, and the optional "start_from" floor number.
 *  2. Scans the target table to find the current max trailing number (so existing records are never duplicated).
 *  3. Uses Math.max(dbMax, startFrom) — whichever is higher — so schools that continue from an existing
 *     numbering system (e.g. last used 20345) seamlessly pick up at 20346.
 */
export async function generateNextId(
  db: Knex,
  tenantId: string,
  type: IdType
): Promise<string> {
  // ── 1. Load tenant ID-format settings ──────────────────────────────────────
  const settingsRows = await db('school_config_settings')
    .where('tenant_id', tenantId)
    .whereIn('setting_key', [
      'id_student_prefix',
      'id_staff_prefix',
      'id_admission_prefix',
      'id_separator',
      'id_padding',
      'id_include_year',
      'id_year_format',
      'id_student_start_from',
      'id_staff_start_from',
      'id_admission_start_from',
    ]);

  const s: Record<string, any> = {};
  for (const row of settingsRows) {
    let val = row.setting_value;
    if (row.data_type === 'number') val = Number(val);
    if (row.data_type === 'boolean') val = val === true || val === 'true';
    s[row.setting_key] = val;
  }

  // ── 2. Resolve prefix ──────────────────────────────────────────────────────
  const defaultPrefixes: Record<IdType, string> = {
    student: 'STU',
    teacher: 'TCH',
    admission: 'ADM',
  };

  let rawPrefix = '';
  if (type === 'teacher') rawPrefix = s['id_staff_prefix'];
  else if (type === 'admission') rawPrefix = s['id_admission_prefix'] || s['id_student_prefix'];
  else rawPrefix = s['id_student_prefix'];

  const prefix = (rawPrefix && String(rawPrefix).trim()) ? String(rawPrefix).trim() : defaultPrefixes[type];

  // ── 3. Separator ───────────────────────────────────────────────────────────
  let separator: string;
  const rawSep = s['id_separator'];
  if (rawSep === 'none' || rawSep === undefined || rawSep === null) {
    separator = '';
  } else {
    separator = String(rawSep);
  }

  // ── 4. Year ────────────────────────────────────────────────────────────────
  let yearFormat = s['id_year_format'];
  if (!yearFormat) {
    const includeYear = s['id_include_year'] !== undefined ? Boolean(s['id_include_year']) : true;
    yearFormat = includeYear ? 'full' : 'none';
  }

  const fullYear = new Date().getFullYear();
  const shortYear = String(fullYear).slice(-2);
  const yearPart =
    yearFormat === 'full' ? String(fullYear) :
    yearFormat === 'short' ? shortYear :
    '';

  // ── 5. Padding ─────────────────────────────────────────────────────────────
  const defaultPadding: Record<IdType, number> = { student: 5, teacher: 3, admission: 5 };
  const padding = Number(s['id_padding']) || defaultPadding[type];

  // ── 6. Start-from floor ────────────────────────────────────────────────────
  const startFromKey: Record<IdType, string> = {
    student: 'id_student_start_from',
    teacher: 'id_staff_start_from',
    admission: 'id_admission_start_from',
  };
  const startFromRaw = s[startFromKey[type]];
  const startFrom = (startFromRaw !== undefined && startFromRaw !== '' && !isNaN(Number(startFromRaw)))
    ? Number(startFromRaw)
    : 0;

  // ── 7. Find current max from the target table ──────────────────────────────
  const tableMap: Record<IdType, { table: string; col: string }> = {
    student: { table: 'students', col: 'student_id' },
    teacher: { table: 'teachers', col: 'teacher_id' },
    admission: { table: 'admission_applications', col: 'application_number' },
  };
  const { table: tableName, col: idColumn } = tableMap[type];

  // Build a pattern prefix to narrow the LIKE scan
  const partsForPattern: string[] = [prefix];
  if (yearPart) partsForPattern.push(yearPart);
  const patternBase = partsForPattern.join(separator);
  const searchPattern = patternBase ? `${patternBase}${separator}%` : '%';

  let dbMax = 0;
  try {
    const records = await db(tableName)
      .where(idColumn, 'like', searchPattern)
      .select(idColumn);

    // Only the part AFTER "prefix + year + separator" is the sequence number.
    // Reading "trailing digits" instead swallowed the year when there is no
    // separator (TCH + 26 + 0005 → 260005), so every new ID stacked another
    // year on (TCH26260006, TCH2626260007…).
    const head = patternBase ? `${patternBase}${separator}` : '';
    for (const rec of records) {
      const val = String(rec[idColumn]);
      const rest = head && val.startsWith(head) ? val.slice(head.length) : val;
      const match = rest.match(/^(\d+)$/) || (!head ? rest.match(/(\d+)$/) : null);
      if (!match) continue;
      let digits = match[1];
      // IDs already written by that bug carry the year again in front of the
      // number (2626 0006). Strip the repeats so they don't inflate the
      // sequence. A genuine number that long would need 10^(padding+year)
      // records, so a real sequence is never mistaken for one.
      if (yearPart && !separator) {
        while (digits.length >= padding + yearPart.length && digits.startsWith(yearPart)) {
          digits = digits.slice(yearPart.length);
        }
      }
      const num = parseInt(digits, 10);
      if (!isNaN(num) && num > dbMax) dbMax = num;
    }
  } catch {
    dbMax = 0;
  }

  // ── 8. Pick the highest floor and increment ────────────────────────────────
  const nextNum = Math.max(dbMax, startFrom) + 1;
  const numberStr = String(nextNum).padStart(padding, '0');

  // ── 9. Assemble the ID ─────────────────────────────────────────────────────
  const finalParts: string[] = [prefix];
  if (yearPart) finalParts.push(yearPart);
  finalParts.push(numberStr);

  return finalParts.join(separator);
}
