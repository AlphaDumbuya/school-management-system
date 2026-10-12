/**
 * A staff member's jobs. users.role is the MAIN job (teacher, accountant or
 * admissions_officer); `staffDuties` lists extra jobs held on top, which can
 * include 'teacher'. See backend utils/staffDuties.ts.
 */
type MaybeUser = { role?: string; staffDuties?: ReadonlyArray<string> | null } | null | undefined;

/** True when this person does teacher work: main job teacher, or a teaching job on top. */
export function isTeachingUser(user: MaybeUser): boolean {
  if (!user) return false;
  return user.role === 'teacher' || (Array.isArray(user.staffDuties) && user.staffDuties.includes('teacher'));
}

/** True when this person holds the job as main role or as an extra job. */
export function holdsJob(user: MaybeUser, job: 'teacher' | 'accountant' | 'admissions_officer'): boolean {
  if (!user) return false;
  return user.role === job || (Array.isArray(user.staffDuties) && user.staffDuties.includes(job));
}
