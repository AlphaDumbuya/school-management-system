import { Knex } from 'knex';

export type IdType = 'student' | 'teacher' | 'admission';

/**
 * Generate unique custom ID based on tenant's ID format settings in school_config_settings
 */
export async function generateNextId(
  db: Knex,
  tenantId: string,
  type: IdType
): Promise<string> {
  // Fetch tenant settings for ID format
  const settingsRows = await db('school_config_settings')
    .where('tenant_id', tenantId)
    .whereIn('setting_key', [
      'id_student_prefix',
      'id_staff_prefix',
      'id_admission_prefix',
      'id_separator',
      'id_padding',
      'id_include_year',
      'id_year_format'
    ]);

  const settingsMap: Record<string, any> = {};
  for (const row of settingsRows) {
    let val = row.setting_value;
    if (row.data_type === 'number') val = Number(val);
    if (row.data_type === 'boolean') val = val === true || val === 'true';
    settingsMap[row.setting_key] = val;
  }

  // Fallback defaults
  let defaultPrefix = 'STU';
  if (type === 'teacher') defaultPrefix = 'TCH';
  if (type === 'admission') defaultPrefix = 'ADM';

  let rawPrefix = '';
  if (type === 'teacher') {
    rawPrefix = settingsMap['id_staff_prefix'];
  } else if (type === 'admission') {
    rawPrefix = settingsMap['id_admission_prefix'] || settingsMap['id_student_prefix'];
  } else {
    rawPrefix = settingsMap['id_student_prefix'];
  }

  const prefix = (rawPrefix && String(rawPrefix).trim()) ? String(rawPrefix).trim() : defaultPrefix;

  // Separator: 'none', '', or undefined -> empty string
  let separator = settingsMap['id_separator'];
  if (separator === 'none' || separator === undefined || separator === null) {
    separator = '';
  } else {
    separator = String(separator);
  }

  // Year Format: 'full' (2026), 'short' (26), 'none'
  let yearFormat = settingsMap['id_year_format'];
  if (!yearFormat) {
    const includeYear = settingsMap['id_include_year'] !== undefined ? Boolean(settingsMap['id_include_year']) : true;
    yearFormat = includeYear ? 'full' : 'none';
  }

  const fullYear = new Date().getFullYear();
  const shortYear = String(fullYear).slice(-2);
  let yearPart = '';
  if (yearFormat === 'full') {
    yearPart = String(fullYear);
  } else if (yearFormat === 'short') {
    yearPart = shortYear;
  }

  const padding = Number(settingsMap['id_padding']) || (type === 'teacher' ? 3 : 5);

  let tableName = 'students';
  let idColumn = 'student_id';

  if (type === 'teacher') {
    tableName = 'teachers';
    idColumn = 'teacher_id';
  } else if (type === 'admission') {
    tableName = 'admission_applications';
    idColumn = 'application_number';
  }

  // Prefix pattern for matching existing IDs in DB
  const partsForPattern: string[] = [];
  if (prefix) partsForPattern.push(prefix);
  if (yearPart) partsForPattern.push(yearPart);
  const patternPrefix = partsForPattern.join(separator);
  const searchPattern = patternPrefix ? `${patternPrefix}${separator}%` : '%';

  let maxNum = 0;

  try {
    const records = await db(tableName)
      .where(idColumn, 'like', searchPattern)
      .select(idColumn);

    for (const rec of records) {
      const val = String(rec[idColumn]);
      const lastDigitsMatch = val.match(/(\d+)$/);
      if (lastDigitsMatch) {
        const num = parseInt(lastDigitsMatch[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  } catch (err) {
    maxNum = 0;
  }

  const nextNum = maxNum + 1;
  const numberStr = String(nextNum).padStart(padding, '0');

  const finalParts: string[] = [];
  if (prefix) finalParts.push(prefix);
  if (yearPart) finalParts.push(yearPart);
  finalParts.push(numberStr);

  return finalParts.join(separator);
}
