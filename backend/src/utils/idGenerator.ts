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
      'id_separator',
      'id_padding',
      'id_include_year'
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

  const prefix = (type === 'teacher' ? settingsMap['id_staff_prefix'] : settingsMap['id_student_prefix']) || defaultPrefix;
  const separator = settingsMap['id_separator'] !== undefined ? settingsMap['id_separator'] : '-';
  const includeYear = settingsMap['id_include_year'] !== undefined ? Boolean(settingsMap['id_include_year']) : true;
  const padding = Number(settingsMap['id_padding']) || (type === 'teacher' ? 3 : 5);

  const year = new Date().getFullYear();
  const yearPart = includeYear ? `${separator}${year}` : '';

  let tableName = 'students';
  let idColumn = 'student_id';

  if (type === 'teacher') {
    tableName = 'teachers';
    idColumn = 'teacher_id';
  } else if (type === 'admission') {
    tableName = 'admission_applications';
    idColumn = 'application_number';
  }

  const prefixPattern = `${prefix}${yearPart}${separator}%`;

  let maxNum = 0;

  try {
    const records = await db(tableName)
      .where(idColumn, 'like', prefixPattern)
      .select(idColumn);

    for (const rec of records) {
      const val = String(rec[idColumn]);
      const lastPart = separator ? val.split(separator).pop() : val.replace(/^[^\d]+/, '');
      const num = parseInt(lastPart || '0', 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  } catch (err) {
    maxNum = 0;
  }

  const nextNum = maxNum + 1;
  const numberStr = String(nextNum).padStart(padding, '0');

  return `${prefix}${yearPart}${separator}${numberStr}`;
}
