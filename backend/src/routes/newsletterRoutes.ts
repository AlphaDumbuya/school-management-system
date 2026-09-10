/**
 * Public newsletter routes (no authentication required).
 *   POST /subscribe    — opt in to marketing.
 *   GET  /unsubscribe  — one-click opt out via token.
 */
import { Router } from 'express';
import { NewsletterService } from '../services/newsletterService';
import emailService from '../services/emailService';

const router = Router();

router.post('/subscribe', async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    const sub: any = await NewsletterService.upsertSubscriber({ email, name, source: 'public', optIn: true });

    // Send a confirmation/welcome email only when they actually just opted in
    // (a fresh subscribe or a re-subscribe after unsubscribing) — never resend
    // to someone who is already actively subscribed.
    if (sub?.justSubscribed && sub?.unsubscribe_token) {
      emailService
        .sendNewsletterWelcomeEmail(sub.email, {
          name: sub.name,
          unsubscribeUrl: NewsletterService.unsubscribeUrl(sub.unsubscribe_token),
        })
        .catch((err) => console.error('Newsletter welcome email failed:', err?.message || err));
    }

    // State-aware response so the UI can confirm the subscription was recorded
    // and dedupe repeat signups (previously it always said "subscribed", which
    // made it look like nothing was saved on repeat attempts).
    if (sub?.alreadySubscribed) {
      return res.json({
        success: true,
        alreadySubscribed: true,
        message: "You're already subscribed to the WiSkul newsletter — no need to sign up again.",
      });
    }
    res.json({
      success: true,
      alreadySubscribed: false,
      message: 'You have been subscribed to the WiSkul newsletter. Check your inbox for a welcome email.',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/unsubscribe', async (req, res, next) => {
  try {
    const token = req.query.token as string;
    const ok = await NewsletterService.unsubscribeByToken(token);
    // Return a simple HTML confirmation so the user sees something in their browser.
    const html = ok
      ? '<html><body style="font-family:sans-serif;text-align:center;padding:80px 20px;"><h1>Unsubscribed</h1><p>You have been removed from the WiSkul newsletter. You will no longer receive marketing emails.</p></body></html>'
      : '<html><body style="font-family:sans-serif;text-align:center;padding:80px 20px;"><h1>Invalid link</h1><p>This unsubscribe link is not valid or has already been used.</p></body></html>';
    res.status(200).type('html').send(html);
  } catch (error) {
    next(error);
  }
});

export default router;
