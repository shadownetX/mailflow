import { describe, expect, it } from 'vitest';
import { enrichPushPayload, validPushAppearance } from './pushAppearance.js';

const base = { title: 'Ann', body: 'Subject', icon: '/icon-512.png', messageId: 'm' };
const latest = { fromName: 'Ann', fromEmail: 'ann@example.com', subject: 'Subject', snippet: 'Secret' };

describe('push appearance', () => {
  it('preserves privacy defaults', () => {
    expect(enrichPushPayload(base, latest, 1, 'Work', {})).toEqual(base);
  });
  it('does not accept arbitrary actions or preference keys', () => {
    expect(validPushAppearance({ avatar: true, account: true, preview: false })).toBe(true);
    expect(validPushAppearance({ avatar: true, account: true, preview: false, actions: ['delete'] })).toBe(false);
  });
  it.each(['en', 'de', 'fr', 'es', 'it', 'ru', 'zhCN', 'pl', 'cs', 'ptBR', 'ko'])('localizes both existing action labels for %s', language => {
    const payload = enrichPushPayload(base, latest, 1, 'Work', { language });
    expect(payload.actionLabels.read).toBeTruthy();
    expect(payload.actionLabels.archive).toBeTruthy();
    expect(payload.actionLabels.noArchiveTitle).toBeTruthy();
  });
  it('does not add body content unless explicitly enabled', () => {
    const payload = enrichPushPayload(base, latest, 1, 'Work', { pushAppearance: { avatar: true, account: true, preview: false } });
    expect(payload.title).toBe('Ann · Work');
    expect(payload.body).toBe('Subject');
    expect(payload.avatar).toEqual({ email: 'ann@example.com', name: 'Ann', favicon: false, gravatar: false });
    expect(JSON.stringify(payload)).not.toContain('Secret');
  });
  it('omits a missing account and retains the sender separately for avatar initials', () => {
    const payload = enrichPushPayload(base, latest, 1, '   ', { pushAppearance: { avatar: true, account: true, preview: true } });
    expect(payload.title).toBe('Ann');
    expect(payload.body).toBe('Subject\nSecret');
    expect(payload.avatar.name).toBe('Ann');
  });
  it.each(['🏠', '💼', '🇫🇷', '👩🏽‍💻', '1️⃣', '🏳️‍🌈'])('preserves the configured account emoji %s', icon => {
    const payload = enrichPushPayload(base, latest, 1, 'Work', { pushAppearance: { avatar: true, account: true, preview: true } }, icon);
    expect(payload.title).toBe(`Ann · ${icon} Work`);
    expect(payload.body).toBe('Subject\nSecret');
    expect(payload.avatar.name).toBe('Ann');
  });
  it.each([undefined, null, '', '   ', 'not an emoji', '🏠💼', '<svg>'])('omits absent or invalid account icons (%s)', icon => {
    expect(enrichPushPayload(base, latest, 1, 'Work', { pushAppearance: { avatar: false, account: true, preview: false } }, icon).title).toBe('Ann · Work');
  });
  it('hides account icon together with the account name when disabled or unnamed', () => {
    expect(enrichPushPayload(base, latest, 1, 'Work', {}, '🏠')).toEqual(base);
    const prefs = { pushAppearance: { avatar: false, account: true, preview: false } };
    expect(enrichPushPayload(base, latest, 1, '', prefs, '🏠').title).toBe('Ann');
  });
  it('keeps a joined emoji intact when truncating long titles', () => {
    const icon = '👩🏽‍💻';
    const payload = enrichPushPayload({ ...base, title: 'A'.repeat(500) }, latest, 1, 'B'.repeat(500), { pushAppearance: { avatar: false, account: true, preview: false } }, icon);
    expect(Array.from(payload.title)).toHaveLength(120);
    expect(payload.title.endsWith(` · ${icon} ` + 'B'.repeat(60))).toBe(true);
  });
  it('bounds unusually large notifications', () => {
    const payload = enrichPushPayload({ ...base, title: '😀'.repeat(500), body: '😀'.repeat(500) }, { ...latest, snippet: '😀'.repeat(500) }, 1, '😀'.repeat(500), { pushAppearance: { avatar: true, account: true, preview: true } });
    expect(Array.from(payload.title)).toHaveLength(120);
    expect(Array.from(payload.body)).toHaveLength(361);
    expect(payload.title.endsWith(' · ' + '😀'.repeat(60))).toBe(true);
  });
});

describe('independent push appearance options', () => {
  for (const avatar of [false, true]) {
    for (const account of [false, true]) {
      for (const preview of [false, true]) {
        it(`avatar=${avatar}, account=${account}, preview=${preview}`, () => {
          const payload = enrichPushPayload(base, latest, 1, 'Work', { language: 'fr', pushAppearance: { avatar, account, preview } }, '💼');
          expect(payload.title).toBe(account ? 'Ann · 💼 Work' : 'Ann');
          expect(payload.body).toBe(preview ? 'Subject\nSecret' : 'Subject');
          expect(Boolean(payload.avatar)).toBe(avatar);
          expect(payload.messageId).toBe('m');
          expect(payload.actionLabels.read).toBe('Marquer comme lu');
          expect(payload.actionLabels.archive).toBe('Archiver');
        });
      }
    }
  }
});
