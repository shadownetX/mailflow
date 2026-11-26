import { readFileSync } from 'node:fs';

// The existing UI locale files are also copied into backend/locales by the Docker build.
const LANGUAGES = new Set(['en', 'de', 'fr', 'es', 'it', 'ru', 'zhCN', 'pl', 'cs', 'ptBR', 'ko']);
const dictionaries = new Map();
function dictionary(language) {
  if (!LANGUAGES.has(language)) return null;
  if (dictionaries.has(language)) return dictionaries.get(language);
  for (const directory of ['../../locales/', '../../../frontend/src/locales/']) {
    try {
      const locale = JSON.parse(readFileSync(new URL(directory + language + '.json', import.meta.url), 'utf8'));
      dictionaries.set(language, locale);
      return locale;
    } catch { /* try the development or packaged location */ }
  }
  return null;
}

export const DEFAULT_PUSH_APPEARANCE = Object.freeze({ avatar: false, account: false, preview: false });
export function validPushAppearance(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 3
    && Object.keys(DEFAULT_PUSH_APPEARANCE).every(key => Object.hasOwn(value, key) && typeof value[key] === 'boolean');
}

function bounded(value, limit) {
  if (typeof value !== 'string') return '';
  return Array.from(value.replace(/\s+/gu, ' ').trim()).slice(0, limit).join('');
}

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

function accountMark(icon) {
  const value = typeof icon === 'string' ? icon.trim() : '';
  return value.length <= 32 && [...graphemes.segment(value)].length === 1
    && /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u20E3]/u.test(value) ? value : '';
}

export function enrichPushPayload(base, latest, count, accountName, preferences = {}, accountIcon) {
  const appearance = validPushAppearance(preferences.pushAppearance)
    ? preferences.pushAppearance : DEFAULT_PUSH_APPEARANCE;
  const locale = dictionary(preferences.language);
  const payload = { ...base };
  if (locale) {
    if (!latest.fromName && !latest.fromEmail) payload.title = locale.notifications.newMessage;
    if (count === 1 && !latest.subject) payload.body = locale.common.noSubject;
    if (count > 1) payload.body = locale.admin.push.newMessages.replace('{{count}}', String(count));
    if (base.messageId) {
      payload.actionLabels = {
        read: locale.contextMenu.markRead,
        archive: locale.contextMenu.archive,
        noArchiveTitle: locale.message.archived.noFolderTitle,
        noArchiveBody: locale.message.archived.noFolderBody,
      };
    }
  }
  const parts = [bounded(payload.body, 200)];
  // Grouped alerts must not expose one arbitrary message's content.
  if (appearance.preview && count === 1 && bounded(latest.snippet, 160)) parts.push(bounded(latest.snippet, 160));
  payload.body = parts.join('\n');
  const sender = bounded(payload.title, 120);
  const account = appearance.account ? bounded(accountName, 60) : '';
  const mark = account ? accountMark(accountIcon) : '';
  const accountLabel = mark ? `${mark} ${account}` : account;
  // Reserve space for the account, keeping a stored emoji intact even if it is a joined sequence.
  payload.title = accountLabel
    ? `${bounded(sender, 120 - 3 - Array.from(accountLabel).length)} · ${accountLabel}`
    : sender;
  if (appearance.avatar && count === 1) {
    payload.avatar = {
      email: bounded(latest.fromEmail, 254),
      name: sender,
      gravatar: preferences.gravatarAvatars === true,
      favicon: preferences.senderFavicons === true,
    };
  }
  return payload;
}
