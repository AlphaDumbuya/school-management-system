import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { PasswordService } from '../services/passwordService';
import { assertPortalAllowed, portalAllowed } from '../services/entitlementService';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/**
 * GET /api/v1/students/guardian-lookup?email=&phone=
 * Smart parent detection: given a guardian email/phone, report whether a
 * matching parent already exists in this tenant, and how many children are
 * already linked. Used by the registration form to link instead of duplicate.
 * NOTE: declared BEFORE /:studentId routes so it isn't captured as a param.
 */
router.get('/guardian-lookup', authenticate, authorize('principal', 'super_admin', 'admissions_officer', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');

    const email = (req.query.email as string || '').trim().toLowerCase();
    const phone = (req.query.phone as string || '').trim();

    if (!email && !phone) {
      return res.json({ success: true, found: false });
    }

    // 1) Match an existing parent USER account (email is the strong key).
    let parentUser: any = null;
    if (email) {
      parentUser = await db('users')
        .where({ tenant_id: tenantId, email })
        .whereIn('role', ['parent', 'guardian'])
        .first();
    }

    // 2) Match existing guardian records (by linked user, email or phone).
    let guardianQuery = db('guardians as g')
      .join('students as s', 'g.student_id', 's.id')
      .where('s.tenant_id', tenantId);
    guardianQuery = guardianQuery.where(function (this: any) {
      if (parentUser) this.orWhere('g.user_id', parentUser.id);
      if (email) this.orWhereRaw('LOWER(g.email) = ?', [email]);
      if (phone) this.orWhere('g.phone_number', phone);
    });

    const linked = await guardianQuery
      .distinct('s.id as student_id', 's.first_name', 's.last_name', 's.student_id as reg_id')
      .select();

    const found = !!parentUser || linked.length > 0;
    if (!found) {
      return res.json({ success: true, found: false });
    }

    // Prefer the parent user's identity; else fall back to a guardian record.
    const anyGuardian = !parentUser
      ? await db('guardians as g')
          .join('students as s', 'g.student_id', 's.id')
          .where('s.tenant_id', tenantId)
          .modify((qb: any) => {
            qb.where(function (this: any) {
              if (email) this.orWhereRaw('LOWER(g.email) = ?', [email]);
              if (phone) this.orWhere('g.phone_number', phone);
            });
          })
          .select('g.first_name', 'g.last_name', 'g.email', 'g.phone_number', 'g.user_id')
          .first()
      : null;

    res.json({
      success: true,
      found: true,
      parent: {
        user_id: parentUser?.id ?? anyGuardian?.user_id ?? null,
        has_account: !!parentUser,
        first_name: parentUser?.first_name ?? anyGuardian?.first_name ?? null,
        last_name: parentUser?.last_name ?? anyGuardian?.last_name ?? null,
        email: parentUser?.email ?? anyGuardian?.email ?? email ?? null,
        phone: anyGuardian?.phone_number ?? phone ?? null,
      },
      children: linked.map((c: any) => ({
        student_id: c.student_id,
        reg_id: c.reg_id,
        name: `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim(),
      })),
      children_count: linked.length,
    });
  } catch (error) {
    logger.error('Error in guardian-lookup:', error);
    next(error);
  }
});

/**
 * POST /api/v1/students/:studentId/guardians
 * Add a guardian to a student
 */
router.post('/:studentId/guardians', authenticate, authorize('admin', 'principal', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const { first_name, last_name, relationship, email, phone_number, occupation, address_line_1, address_line_2, city, state, postal_code, country, is_primary_guardian } = req.body;
    const createdBy = (req as any).user.id;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    // Validate student exists within this tenant
    const student = await db('students')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('id', studentId).orWhere('student_id', studentId);
      })
      .first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Validate required fields
    if (!first_name || !last_name || !relationship || !email || !phone_number) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    const guardianEmail = email.toLowerCase().trim();

    // Link to an existing parent user (tenant-scoped) if one has this email, so
    // the parent portal (resolveChildren) can see this child. If none exists,
    // create a parent login account with a demo password so the guardian can
    // actually sign in.
    let parentUser = await db('users').where({ tenant_id: tenantId, email: guardianEmail }).first();
    let generatedParentPassword: string | null = null;
    // Parent logins only on plans with the parent portal; the guardian's
    // contact record is saved either way.
    const parentPortal = await portalAllowed(tenantId, 'parent').catch(() => true);
    if (!parentUser && parentPortal) {
      const pwd = PasswordService.generateTemporaryPassword();
      const [created] = await db('users').insert({
        tenant_id: tenantId,
        email: guardianEmail,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        password_hash: await PasswordService.hashPassword(pwd),
        temp_password: pwd,
        role: 'parent',
        status: 'active',
        created_by: createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*').catch(() => [null]);
      if (created) { parentUser = created; generatedParentPassword = pwd; }
    }

    // Create guardian (linked to the parent user account).
    const [id] = await db('guardians').insert({
      student_id: student.id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      relationship,
      email: guardianEmail,
      phone_number,
      occupation: occupation || null,
      address_line_1: address_line_1 || null,
      address_line_2: address_line_2 || null,
      city: city || null,
      state: state || null,
      postal_code: postal_code || null,
      country: country || null,
      is_primary_guardian: is_primary_guardian || false,
      user_id: parentUser?.id || null,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: createdBy,
    }).returning('id');

    const guardian = await db('guardians')
      .select('id', 'student_id', 'first_name', 'last_name', 'relationship', 'email', 'phone_number', 'is_primary_guardian', 'created_at')
      .where('id', id)
      .first();

    res.status(201).json({
      message: 'Guardian added successfully',
      guardian,
      parent_account: parentUser
        ? { email: parentUser.email, temporary_password: generatedParentPassword || '(existing account)' }
        : null,
    });

    logger.info(`Guardian added for student ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/guardians
 * List guardians for a student
 */
router.get('/:studentId/guardians', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('id', studentId).orWhere('student_id', studentId);
      })
      .first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    const guardians = await db('guardians')
      .select('guardians.id', 'guardians.first_name', 'guardians.last_name', 'guardians.relationship', 'guardians.email', 'guardians.phone_number', 'guardians.is_primary_guardian', 'guardians.created_at')
      .where('guardians.student_id', student.id)
      .orderBy('guardians.is_primary_guardian', 'desc')
      .orderBy('guardians.created_at', 'desc');

    res.json({
      student_id: student.student_id,
      guardians,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/guardians/:guardianId
 * Update guardian information
 */
router.put('/:guardianId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guardianId } = req.params;
    const { first_name, last_name, email, phone_number, occupation, address_line_1, address_line_2, city, state, postal_code, country } = req.body;
    const updatedBy = (req as any).user.id;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const guardian = await db('guardians')
      .join('students', 'guardians.student_id', 'students.id')
      .where('guardians.id', guardianId)
      .where('students.tenant_id', tenantId)
      .select('guardians.*')
      .first();
    if (!guardian) {
      throw new AppError('Guardian not found', 404, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (first_name) updateData.first_name = first_name.trim();
    if (last_name) updateData.last_name = last_name.trim();
    if (email) updateData.email = email.toLowerCase();
    if (phone_number) updateData.phone_number = phone_number;
    if (occupation) updateData.occupation = occupation;
    if (address_line_1) updateData.address_line_1 = address_line_1;
    if (address_line_2) updateData.address_line_2 = address_line_2;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (postal_code) updateData.postal_code = postal_code;
    if (country) updateData.country = country;

    updateData.updated_at = new Date();
    updateData.updated_by = updatedBy;

    await db('guardians').where('id', guardianId).update(updateData);

    const updated = await db('guardians').where('id', guardianId).first();

    res.json({
      message: 'Guardian updated successfully',
      guardian: updated,
    });

    logger.info(`Guardian updated: ${guardianId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/guardians/:guardianId
 * Remove a guardian
 */
router.delete('/:guardianId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guardianId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const guardian = await db('guardians')
      .join('students', 'guardians.student_id', 'students.id')
      .where('guardians.id', guardianId)
      .where('students.tenant_id', tenantId)
      .select('guardians.*')
      .first();
    if (!guardian) {
      throw new AppError('Guardian not found', 404, 'NOT_FOUND');
    }

    await db('guardians').where('id', guardianId).delete();

    res.json({
      message: 'Guardian removed successfully',
    });

    logger.info(`Guardian removed: ${guardianId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/guardians/:guardianId/set-primary
 * Set guardian as primary for student
 */
router.post('/:guardianId/set-primary', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guardianId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const guardian = await db('guardians')
      .join('students', 'guardians.student_id', 'students.id')
      .where('guardians.id', guardianId)
      .where('students.tenant_id', tenantId)
      .select('guardians.*')
      .first();
    if (!guardian) {
      throw new AppError('Guardian not found', 404, 'NOT_FOUND');
    }

    // Set all guardians for this student to non-primary
    await db('guardians').where('student_id', guardian.student_id).update({ is_primary_guardian: false });

    // Set this guardian as primary
    await db('guardians').where('id', guardianId).update({ is_primary_guardian: true });

    logger.info(`Guardian set as primary: ${guardianId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/students/:studentId/parent-account
 * Create or link a parent user account for a student (principal/super_admin/admissions_officer)
 */
router.post('/:studentId/parent-account', authenticate, authorize('principal', 'super_admin', 'admissions_officer', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const { email, first_name, last_name, phone, relationship, password } = req.body;
    const tenantId = req.user?.tenant_id;
    const createdBy = (req as any).user.id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .where('tenant_id', tenantId)
      .andWhere(function (this: any) {
        this.where('id', studentId).orWhere('student_id', studentId);
      })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    const targetEmail = (email || student.email || '').trim().toLowerCase();
    const targetFirstName = (first_name || (student.guardian_name ? student.guardian_name.split(' ')[0] : 'Parent')).trim();
    const targetLastName = (last_name || (student.guardian_name ? student.guardian_name.split(' ').slice(1).join(' ') : student.last_name)).trim();

    if (!targetEmail) {
      throw new AppError('Parent email is required to create an account', 400, 'VALIDATION_ERROR');
    }
    await assertPortalAllowed(tenantId, 'parent', { forAccountCreation: true });

    // Check if user already exists (tenant-scoped).
    let user = await db('users').where({ tenant_id: tenantId, email: targetEmail }).first();
    let tempPassword = '';

    if (!user) {
      tempPassword = password || PasswordService.generateTemporaryPassword();
      const passwordHash = await PasswordService.hashPassword(tempPassword);

      const [insertedUser] = await db('users').insert({
        tenant_id: tenantId,
        email: targetEmail,
        first_name: targetFirstName,
        last_name: targetLastName,
        password_hash: passwordHash,
        temp_password: tempPassword,
        role: 'parent',
        status: 'active',
        created_by: createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');

      user = insertedUser;
    } else if (password) {
      // Principal explicitly set a password for an existing parent account.
      const passwordHash = await PasswordService.hashPassword(password);
      await db('users').where('id', user.id).update({
        password_hash: passwordHash, temp_password: password, status: 'active', updated_at: new Date(),
      });
      tempPassword = password;
    } else if (!user.last_login && user.temp_password) {
      // Never-logged-in account — surface the existing demo password.
      tempPassword = user.temp_password;
    }

    // Is this the student's FIRST guardian? If so, make it primary.
    const guardianCount = await db('guardians').where('student_id', student.id).count('* as c').first();
    const isFirstGuardian = Number(guardianCount?.c ?? 0) === 0;

    // Insert/link guardian entry in guardians table for multi-guardian tracking.
    // CRITICAL: link guardians.user_id to the parent user so the parent portal
    // (resolveChildren) can see this child.
    const existingGuardian = await db('guardians')
      .where('student_id', student.id)
      .andWhere(function(this: any) {
        this.whereRaw('LOWER(email) = ?', [targetEmail])
            .orWhere('user_id', user.id)
            .orWhere(db.raw('LOWER(first_name) = ? AND LOWER(last_name) = ?', [targetFirstName.toLowerCase(), targetLastName.toLowerCase()]));
      })
      .first();

    if (!existingGuardian) {
      await db('guardians').insert({
        student_id: student.id,
        first_name: targetFirstName,
        last_name: targetLastName,
        email: targetEmail,
        phone_number: phone || student.guardian_phone || null,
        relationship: relationship || 'Parent',
        is_primary_guardian: isFirstGuardian,
        user_id: user.id,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: createdBy,
      }).catch((e) => logger.warn(`Guardian insert failed for student ${student.id}: ${e?.message || e}`));
    } else if (!existingGuardian.user_id) {
      // Link the existing guardian row to the parent user account.
      await db('guardians').where('id', existingGuardian.id).update({ user_id: user.id, updated_at: new Date() }).catch(() => {});
    }

    // Update primary guardian info if not set
    if (!student.guardian_name || student.guardian_name === '—') {
      await db('students').where('id', student.id).update({
        guardian_name: `${targetFirstName} ${targetLastName}`.trim(),
        guardian_phone: phone || student.guardian_phone || null,
        guardian_relationship: relationship || student.guardian_relationship || 'Parent',
        updated_at: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      message: 'Parent account created & linked successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      temporary_password: tempPassword || '(Account already existed)',
    });

    logger.info(`Parent account ${targetEmail} created/linked for student ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

export default router;
