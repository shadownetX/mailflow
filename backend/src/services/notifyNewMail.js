import { newMailPushPayload } from './inboxRules.js';
import { query } from './db.js';
import { sendPushToUser } from './pushNotifications.js';
import { notifyWebhook } from './webhooks.js';
import { enrichPushPayload } from './pushAppearance.js';

// Called only for alert-eligible INBOX arrivals. Delivery never blocks mail sync.
export function notifyNewMail({ userId, accountId, accountName, alertMessages, alertCount }) {
  const latest = alertMessages[alertMessages.length - 1];
  // Each channel starts independently; webhook failures must never delay Web Push.
  notifyWebhook({ userId, accountName, count: alertCount, latest })
    .catch(() => console.warn('Webhook notification unavailable'));
  const basePayload = newMailPushPayload(alertMessages, alertCount);
  // Fetch fresh account appearance, preferences and the unread badge in one query. The IMAP
  // connection may still hold the previous account name or icon after a settings change.
  // If the query fails for any reason, send the push without it so
  // notifications are never silently dropped.
  query(
    `SELECT u.preferences, source.name AS account_name, source.icon AS account_icon,
     (SELECT COUNT(*)::int FROM messages m
     JOIN email_accounts a ON a.id = m.account_id
     WHERE a.user_id = u.id AND a.enabled = true AND m.folder = 'INBOX' AND m.is_read = false AND m.is_deleted = false) AS total
     FROM users u LEFT JOIN email_accounts source ON source.id = $2 AND source.user_id = u.id
     WHERE u.id = $1`,
    [userId, accountId ?? null]
  ).then(r => {
    const row = r.rows[0];
    const payload = enrichPushPayload(basePayload, latest, alertCount, row?.account_name ?? accountName, row?.preferences || {}, row?.account_icon);
    sendPushToUser(userId, { ...payload, unreadCount: r.rows[0]?.total ?? 0 })
      .catch(err => console.warn('Push notification error:', err.message));
  }).catch(() => {
    sendPushToUser(userId, basePayload)
      .catch(err => console.warn('Push notification error:', err.message));
  });
}
