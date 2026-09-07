/**
 * Contact Routes
 * Handles contact form submissions with Brevo email integration
 */

import { Router, Request, Response } from 'express';
import { sendContactEmail, sendAutoResponse } from '../services/emailService';
import { db } from '../utils/database';

const router = Router();

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  school?: string;
  role: string;
  message: string;
}

/**
 * POST /api/contact
 * Submit contact form
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, school, role, message }: ContactFormData = req.body;

    // Validation
    if (!name || !email || !role || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, role, and message are required',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
      });
    }

    // Persist to the platform inbox so the operator can see/manage it later.
    // Best-effort — a DB hiccup must not fail the visitor's submission.
    try {
      const tenant = school
        ? await db('tenants').whereRaw('LOWER(name) = LOWER(?)', [school]).first()
        : null;
      await db('platform_messages').insert({
        name, email, phone: phone || null, school: school || null, role: role || null,
        message, source: 'contact', status: 'unread', tenant_id: tenant?.id || null,
        created_at: new Date(),
      });
    } catch (dbErr: any) {
      console.error('Failed to persist contact message:', dbErr?.message || dbErr);
    }

    // Send notification email to the WiSkul team. Email delivery must NOT crash
    // the endpoint — if Brevo rejects (e.g. unverified sender) we log and carry
    // on, so the visitor still gets a success response and we don't 500.
    try {
      await sendContactEmail({
        name,
        email,
        phone: phone || 'Not provided',
        school: school || 'Not provided',
        role,
        message,
      });
    } catch (mailErr: any) {
      console.error('Failed to send contact notification email:', mailErr?.message || mailErr);
    }

    // Send auto-response to the visitor (best-effort).
    try {
      await sendAutoResponse(email, name);
    } catch (mailErr: any) {
      console.error('Failed to send confirmation email to user:', mailErr?.message || mailErr, { userEmail: email });
    }

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you soon!',
    });
  } catch (error: any) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
