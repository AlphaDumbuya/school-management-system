/**
 * Staff designation options, tailored to the school's LEVEL.
 *
 * Sierra Leone terminology:
 *  - Primary schools:   "Class Teacher" / "Class Master", led by a "Head Teacher"
 *                       (deputy: "Deputy Head Teacher").
 *  - Secondary schools: "Form Teacher" / "Form Master", led by a "Principal"
 *                       (deputy: "Vice Principal").
 *
 * When a school covers a single level we DON'T add a "(Primary)"/"(Secondary)"
 * suffix — the level is implied. When it covers BOTH we disambiguate with a
 * suffix so an admin can pick the right title.
 */

export interface DesignationOption {
  label: string;
  value: string;
}

/** Derive which level tiers a school has from its stored school_type string. */
export function schoolLevels(schoolType?: string | null): { primary: boolean; secondary: boolean } {
  const t = (schoolType || '').toLowerCase();
  // Sensible default when unknown: show everything (covers "all").
  if (!t) return { primary: true, secondary: true };
  const primary = /primary|nursery|early childhood|k-?12|k12/.test(t);
  const secondary = /secondary|jss|sss|junior|senior|k-?12|k12|technical|vocational/.test(t);
  // If neither matched (an unusual custom label), fall back to showing both.
  if (!primary && !secondary) return { primary: true, secondary: true };
  return { primary, secondary };
}

/**
 * Build the Designation / Title options for a school. `both` decides whether we
 * append a level suffix to disambiguate the primary vs secondary variants.
 */
export function designationOptions(schoolType?: string | null): DesignationOption[] {
  const { primary, secondary } = schoolLevels(schoolType);
  const both = primary && secondary;
  const opts: DesignationOption[] = [
    { label: 'Subject Teacher', value: 'subject_teacher' },
  ];

  // Class-leadership title(s)
  if (primary) {
    opts.push({ label: both ? 'Class Master / Class Teacher (Primary)' : 'Class Master / Class Teacher', value: 'class_teacher' });
  }
  if (secondary) {
    opts.push({ label: both ? 'Form Master / Form Teacher (Secondary)' : 'Form Master / Form Teacher', value: 'form_teacher' });
  }

  opts.push(
    { label: 'Senior Teacher', value: 'senior_teacher' },
  );

  // Leadership title(s)
  if (primary) {
    opts.push(
      { label: both ? 'Head Teacher (Primary)' : 'Head Teacher', value: 'head_teacher' },
      { label: both ? 'Deputy Head Teacher (Primary)' : 'Deputy Head Teacher', value: 'vice_head_teacher' },
    );
  }
  if (secondary) {
    opts.push(
      { label: both ? 'Principal (Secondary)' : 'Principal', value: 'principal' },
      { label: both ? 'Vice Principal (Secondary)' : 'Vice Principal', value: 'vice_principal' },
    );
  }

  // Non-teaching administrative roles (level-independent)
  opts.push(
    { label: 'Bursar (Finance)', value: 'bursar' },
    { label: 'Administrator (Admissions)', value: 'administrator' },
  );

  return opts;
}

/** The class-leadership assignment field label for a school's level. */
export function classAssignmentLabel(schoolType?: string | null): string {
  const { primary, secondary } = schoolLevels(schoolType);
  if (primary && !secondary) return 'Class Assignment (Class Master)';
  if (secondary && !primary) return 'Form Assignment (Form Master)';
  return 'Class / Form Assignment (Class or Form Master)';
}
