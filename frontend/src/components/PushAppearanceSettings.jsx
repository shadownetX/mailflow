import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api.js';
import ToggleRow from './SettingsToggleRow.jsx';

const defaults = { avatar: false, account: false, preview: false };
const rows = [
  ['avatar', 'admin.push.avatar', 'admin.push.avatarDesc'],
  ['account', 'admin.push.receivingAccount', 'admin.push.receivingAccountDesc'],
  ['preview', 'admin.push.contentPreview', 'admin.push.contentPreviewDesc'],
];

// admin.push.newMessages is consumed by the backend for grouped Web Push notifications.
export default function PushAppearanceSettings({ userId }) {
  const { t } = useTranslation();
  const [appearance, setAppearance] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const active = useRef(false);

  useEffect(() => {
    let cancelled = false;
    active.current = true;
    setReady(false);
    setError(false);
    if (userId) api.getPreferences().then(prefs => {
      if (cancelled) return;
      const stored = prefs.pushAppearance || {};
      setAppearance({ avatar: stored.avatar === true, account: stored.account === true, preview: stored.preview === true });
      setReady(true);
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; active.current = false; };
  }, [userId]);

  const save = async (key, value) => {
    if (!ready || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(false);
    const next = { ...appearance, [key]: value };
    try {
      await api.savePreferences({ pushAppearance: next });
      if (active.current) setAppearance(next);
    } catch {
      if (active.current) setError(true);
    } finally {
      pending.current = false;
      if (active.current) setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 20, display: 'grid', gap: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t('admin.push.appearanceTitle')}</div>
      {rows.map(([key, label, desc]) => (
        <ToggleRow key={key} label={t(label)} desc={t(desc)} checked={appearance[key]} disabled={!ready || saving} onChange={value => save(key, value)} />
      ))}
      {error && <div role="alert" style={{ fontSize: 12, color: 'var(--red)' }}>{t('admin.push.appearanceError')}</div>}
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>{t('admin.push.previewTitle')}</div>
      <div style={{ padding: 12, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 13, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{'MailFlow'}</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
            <div style={{ fontWeight: 600 }}>{'GitHub'}</div>
            {appearance.account && <div style={{ color: 'var(--text-secondary)' }}>{t('admin.push.exampleAccount')}</div>}
            <div>{t('admin.push.title')}</div>
            {appearance.preview && <div style={{ color: 'var(--text-secondary)' }}>{t('admin.push.description')}</div>}
          </div>
          {appearance.avatar
            ? <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#475569', color: '#fff', fontWeight: 600, flexShrink: 0 }}>{'G'}</div>
            : <img alt="" src="/icon-512.png" width={40} height={40} style={{ borderRadius: 8 }} />}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 8, color: 'var(--accent)', fontSize: 12 }}>
          <span>{t('contextMenu.markRead')}</span>
          <span>{t('contextMenu.archive')}</span>
        </div>
      </div>
    </div>
  );
}
