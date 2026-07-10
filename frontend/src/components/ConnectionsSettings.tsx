import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Send, CheckCircle2, AlertCircle, Cable } from 'lucide-react';
import { connectionsApi, ConnectionDto } from '../api/connections';
import { useLanguageStore } from '../stores/useLanguageStore';

const TYPE_LABELS: Record<string, string> = {
  telegram_bot: 'Telegram Bot',
  discord_webhook: 'Discord Webhook',
  generic_webhook: 'Webhook (HTTP)',
};

const TYPE_FIELDS: Record<string, { key: string; label: { ru: string; en: string }; placeholder: string; secret?: boolean }[]> = {
  telegram_bot: [
    { key: 'botToken', label: { ru: 'Токен бота (@BotFather)', en: 'Bot token (@BotFather)' }, placeholder: '123456:ABC-DEF...', secret: true },
  ],
  discord_webhook: [
    { key: 'webhookUrl', label: { ru: 'Webhook URL канала', en: 'Channel webhook URL' }, placeholder: 'https://discord.com/api/webhooks/...', secret: true },
  ],
  generic_webhook: [
    { key: 'url', label: { ru: 'URL эндпоинта', en: 'Endpoint URL' }, placeholder: 'https://example.com/hook' },
    { key: 'hmacSecret', label: { ru: 'HMAC-секрет (опционально)', en: 'HMAC secret (optional)' }, placeholder: 'для подписи X-Signature', secret: true },
  ],
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)', padding: '8px 10px', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none',
};

const btnStyle = (bg: string, color = '#fff'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer',
  borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, padding: '8px 14px',
  background: bg, color,
});

export default function ConnectionsSettings() {
  const { language } = useLanguageStore();
  const isRu = language === 'ru';

  const [items, setItems] = useState<ConnectionDto[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('telegram_bot');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [testChatId, setTestChatId] = useState('');
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await connectionsApi.list();
      setItems(res.data);
    } catch { /* backend недоступен — список останется пустым */ }
  };

  useEffect(() => { load(); }, []);

  const flash = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 5000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await connectionsApi.create({ name, type, config });
      setFormOpen(false);
      setName('');
      setConfig({});
      flash('success', isRu ? 'Подключение сохранено' : 'Connection saved');
      load();
    } catch (err: any) {
      flash('error', err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(isRu ? 'Удалить подключение? Ноды, которые на него ссылаются, перестанут доставлять сигналы.' : 'Delete this connection? Nodes referencing it will stop delivering.')) return;
    await connectionsApi.remove(id);
    load();
  };

  const handleTest = async (c: ConnectionDto) => {
    setBusy(true);
    try {
      const res = await connectionsApi.test(c.id, c.type === 'telegram_bot' ? testChatId : undefined);
      if (res.data.ok) flash('success', isRu ? 'Тестовое сообщение отправлено' : 'Test message sent');
      else flash('error', res.data.error || 'error');
    } catch (err: any) {
      flash('error', err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Cable size={18} /> {isRu ? 'Подключения' : 'Connections'}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.6 }}>
        {isRu
          ? 'Секреты (токены, webhook-URL) хранятся здесь в зашифрованном виде. Delivery-ноды на канвасе ссылаются на подключение по имени и не содержат секретов — стратегии можно безопасно экспортировать и публиковать.'
          : 'Secrets (tokens, webhook URLs) are stored here encrypted. Delivery nodes on the canvas reference a connection by name and contain no secrets — strategies stay safe to export and share.'}
      </p>

      {banner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius-md)',
          marginBottom: 16, fontSize: 13, fontWeight: 600,
          background: banner.type === 'success' ? 'var(--success-soft)' : 'var(--danger-soft)',
          color: banner.type === 'success' ? 'var(--success)' : 'var(--danger)',
        }}>
          {banner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {banner.text}
        </div>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {items.map((c) => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            background: 'var(--bg-accent)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', padding: '12px 14px',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {TYPE_LABELS[c.type]} • {Object.values(c.configPreview).join(' • ') || '—'}
                {!c.user_id && (isRu ? ' • общесерверное' : ' • server-wide')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {c.type === 'telegram_bot' && (
                <input
                  value={testChatId}
                  onChange={(e) => setTestChatId(e.target.value)}
                  placeholder={isRu ? 'chat id для теста' : 'test chat id'}
                  style={{ ...inputStyle, width: 140, fontSize: 11 }}
                />
              )}
              <button onClick={() => handleTest(c)} disabled={busy} style={btnStyle('var(--accent-color)')}>
                <Send size={12} /> {isRu ? 'Проверить' : 'Test'}
              </button>
              <button onClick={() => handleDelete(c.id)} style={btnStyle('var(--danger-soft)', 'var(--danger)')}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '16px 0' }}>
            {isRu ? 'Подключений пока нет.' : 'No connections yet.'}
          </div>
        )}
      </div>

      {/* Create form */}
      {formOpen ? (
        <form onSubmit={handleCreate} style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
                {isRu ? 'Название' : 'Name'}
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isRu ? 'Мой канал сигналов' : 'My signals channel'} style={inputStyle} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
                {isRu ? 'Тип' : 'Type'}
              </label>
              <select value={type} onChange={(e) => { setType(e.target.value); setConfig({}); }} style={inputStyle}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {TYPE_FIELDS[type].map((f) => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>
                {isRu ? f.label.ru : f.label.en}
              </label>
              <input
                type={f.secret ? 'password' : 'text'}
                value={config[f.key] || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={inputStyle}
                autoComplete="off"
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" disabled={busy} style={btnStyle('var(--accent-color)')}>
              {isRu ? 'Сохранить' : 'Save'}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} style={btnStyle('var(--bg-accent)', 'var(--text-secondary)')}>
              {isRu ? 'Отмена' : 'Cancel'}
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setFormOpen(true)} style={btnStyle('var(--accent-color)')}>
          <Plus size={14} /> {isRu ? 'Добавить подключение' : 'Add connection'}
        </button>
      )}
    </div>
  );
}
