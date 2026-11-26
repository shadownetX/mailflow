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
  it('bounds unusually large notifications', () => {
    const payload = enrichPushPayload({ ...base, title: '😀'.repeat(500), body: '😀'.repeat(500) }, { ...latest, snippet: '😀'.repeat(500) }, 1, '😀'.repeat(500), { pushAppearance: { avatar: true, account: true, preview: true } });
    expect(Array.from(payload.title)).toHaveLength(120);
    expect(Array.from(payload.body)).toHaveLength(361);
    expect(payload.title.endsWith(' · ' + '😀'.repeat(60))).toBe(true);
  });
});
