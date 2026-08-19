// utils/push.js
import webpush from 'web-push';
import { db } from '../db/index.js';

const vapidConfigured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Sends a push notification to every device a user has subscribed on.
 * Silently does nothing if VAPID keys aren't configured yet, and cleans up
 * subscriptions the browser has expired/revoked (410/404 responses).
 */
export async function sendPushToUser(userId, { title, body, url }) {
  if (!vapidConfigured) return;

  const subs = await db.query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
  const payload = JSON.stringify({ title, body, url: url || '/' });

  for (const sub of subs.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        // Subscription is dead (uninstalled, permissions revoked, etc.) — remove it.
        await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
      } else {
        console.error('Push send failed', e.message);
      }
    }
  }
}
