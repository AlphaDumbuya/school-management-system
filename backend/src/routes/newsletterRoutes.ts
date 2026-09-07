/**
 * Public newsletter routes (no authentication required).
 *   POST /subscribe    — opt in to marketing.
 *   GET  /unsubscribe  — one-click opt out via token.
 */
import { Router } from 'express';
import { NewsletterService } from '../services/newsletterService';

const router = Router();

router.post('/subscribe', async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    await NewsletterService.upsertSubscriber({ email, name, source: 'public', optIn: true });
    res.json({ success: true, message: 'You have been subscribed to the WiSkul newsletter.' });
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
