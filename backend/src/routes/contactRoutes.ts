/**
 * Contact Routes
 * Handles contact form submissions with Brevo email integration
 */

import { Router, Request, Response } from 'express';
import { sendContactEmail, sendAutoResponse } from '../services/emailService';

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

    // Send notification email to WiSkul team
    const contactEmailResult = await sendContactEmail({
      name,
      email,
      phone: phone || 'Not provided',
      school: school || 'Not provided',
      role,
      message,
    });

    if (!contactEmailResult.success) {
      console.error('Failed to send contact notification email:', contactEmailResult);
    }

    // Send auto-response to user - this is critical for UX
    const autoResponseResult = await sendAutoResponse(email, name);

    if (!autoResponseResult.success) {
      console.error('Failed to send confirmation email to user:', autoResponseResult, { userEmail: email });
      // Still report success to user since their message was received, but log the error
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
