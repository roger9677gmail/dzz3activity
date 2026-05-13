'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function NotificationsClient({ events, groups, subCount, initialPresets }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [presets, setPresets] = useState(initialPresets);
  const [form, setForm] = useState({
    title: '', body: '', url: '',
    target: 'all', // 'all' | 'groups' | 'event'
    eventId: '',
    groupIds: [],
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  function applyPreset(p) {
    setForm((s) => ({ ...s, title: p.title, body: p.body }));
  }

  function toggleGroup(id) {
    setForm((s) => s.groupIds.includes(id)
      ? { ...s, groupIds: s.groupIds.filter((g) => g !== id) }
      : { ...s, groupIds: [...s.groupIds, id] });
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!form.title || !form.body) return;
    setLoading(true);
    setResult(null);
    const payload = { title: form.title, body: form.body, url: form.url };
    if (form.target === 'event' && form.eventId) payload.eventId = form.eventId;
    if (form.target === 'groups' && form.groupIds.length > 0) payload.group_ids = form.groupIds;
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: '傳送失敗' });
    }
    setLoading(false);
  }

  // Estimate target count for the send button label.
  let targetCount = subCount;
  if (form.target === 'event' && form.eventId) {
    targetCount = events.find((ev) => String(ev.id) === String(form.eventId))?.sub_count || 0;
  } else if (form.target === 'groups') {
    if (form.groupIds.length === 0) targetCount = 0;
    else {
      // Over-counts a bit if a member is in multiple selected groups, but
      // gives a reasonable estimate; server returns exact count.
      const set = new Set(form.groupIds);
      targetCount = groups.filter((g) => set.has(g.id)).reduce((s, g) => s + (g.sub_count || 0), 0);
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <PresetsEditor
        presets={presets} setPresets={setPresets}
        onApply={applyPreset}
        confirm={confirm} router={router}
      />

      <form onSubmit={handleSend} className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-gray-700">自訂推播訊息</h3>

        <div>
          <label className="block text-sm text-gray-600 mb-1">通知標題 *</label>
          <input type="text" required className="input-field" placeholder="例：法會活動提醒"
            value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">通知內容 *</label>
          <textarea required className="input-field resize-none" rows={3}
            placeholder="輸入推播通知內容..."
            value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">傳送對象</label>
          <div className="space-y-2">
            <Radio
              checked={form.target === 'all'}
              onChange={() => setForm((p) => ({ ...p, target: 'all' }))}
              label={`全體師兄姐（${subCount} 人）`}
            />
            <Radio
              checked={form.target === 'groups'}
              onChange={() => setForm((p) => ({ ...p, target: 'groups' }))}
              label="指定群組標籤"
            />
            {form.target === 'groups' && (
              <div className="ml-6 bg-gray-50 rounded-lg p-2 flex flex-wrap gap-1.5">
                {groups.map((g) => {
                  const active = form.groupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        active ? 'text-white border-transparent' : 'text-gray-600 bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                      style={active ? { backgroundColor: g.color || '#8B1A1A' } : {}}
                    >
                      {g.location_id != null ? `🏯 ${g.name}` : g.name}
                      <span className="ml-1 opacity-70">{g.sub_count || 0}</span>
                    </button>
                  );
                })}
                {groups.length === 0 && <span className="text-xs text-gray-400">尚無群組</span>}
              </div>
            )}
            <Radio
              checked={form.target === 'event'}
              onChange={() => setForm((p) => ({ ...p, target: 'event' }))}
              label="指定法會已報名者"
            />
            {form.target === 'event' && (
              <div className="ml-6">
                <select className="input-field text-sm"
                  value={form.eventId}
                  onChange={(e) => setForm((p) => ({ ...p, eventId: e.target.value }))}>
                  <option value="">— 選擇法會活動 —</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name}（{ev.sub_count || 0} 人）</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className={`text-sm px-4 py-3 rounded-lg ${result.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {result.error || `✅ 成功傳送給 ${result.sent} / ${result.total} 位師兄姐`}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || targetCount === 0 || !form.title || !form.body
            || (form.target === 'event' && !form.eventId)
            || (form.target === 'groups' && form.groupIds.length === 0)}
          className="w-full btn-primary py-3 disabled:opacity-50"
        >
          {loading ? '傳送中…' : `🔔 發送推播通知（約 ${targetCount} 人）`}
        </button>
        {targetCount === 0 && form.target !== 'all' && (
          <p className="text-xs text-gray-400 text-center">無對應的訂閱者</p>
        )}
      </form>
    </div>
  );
}

function Radio({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="radio" checked={checked} onChange={onChange} className="text-temple-red focus:ring-temple-red" />
      <span>{label}</span>
    </label>
  );
}

function PresetsEditor({ presets, setPresets, onApply, confirm, router }) {
  const [editing, setEditing] = useState(null); // null | 'new' | <id>
  const [draft, setDraft] = useState({ title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function startNew() {
    setEditing('new');
    setDraft({ title: '', body: '' });
    setError('');
  }
  function startEdit(p) {
    setEditing(p.id);
    setDraft({ title: p.title, body: p.body });
    setError('');
  }
  function cancel() {
    setEditing(null);
    setDraft({ title: '', body: '' });
    setError('');
  }

  async function refreshPresets() {
    const res = await fetch('/api/admin/push-presets');
    const data = await res.json();
    if (res.ok) setPresets(data.presets);
  }

  async function save() {
    setError('');
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('標題與內容皆必填');
      return;
    }
    setSaving(true);
    try {
      const url = editing === 'new' ? '/api/admin/push-presets' : `/api/admin/push-presets/${editing}`;
      const res = await fetch(url, {
        method: editing === 'new' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '儲存失敗');
      } else {
        await refreshPresets();
        cancel();
      }
    } catch {
      setError('網路錯誤');
    }
    setSaving(false);
  }

  async function remove(p) {
    if (!(await confirm({
      title: '刪除範本',
      message: `確定刪除範本「${p.title}」？`,
      confirmText: '刪除',
      danger: true,
    }))) return;
    const res = await fetch(`/api/admin/push-presets/${p.id}`, { method: 'DELETE' });
    if (res.ok) await refreshPresets();
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-700">快速範本</h3>
        {editing === null && (
          <button type="button" onClick={startNew} className="text-sm text-temple-red font-medium">+ 新增範本</button>
        )}
      </div>

      <div className="space-y-2">
        {presets.length === 0 && editing !== 'new' && (
          <div className="text-sm text-gray-400 text-center py-4">尚無範本，點上方「+ 新增範本」開始建立</div>
        )}
        {presets.map((p) => (
          editing === p.id ? (
            <PresetForm
              key={p.id}
              draft={draft} setDraft={setDraft}
              saving={saving} error={error}
              onSave={save} onCancel={cancel}
            />
          ) : (
            <div key={p.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => onApply(p)}
                className="w-full text-left px-3 py-2.5 hover:bg-red-50 transition-colors"
              >
                <div className="font-medium text-sm">{p.title}</div>
                <div className="text-xs text-gray-400 mt-0.5 truncate">{p.body}</div>
              </button>
              <div className="flex border-t border-gray-200 divide-x divide-gray-200">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="flex-1 text-xs text-blue-600 py-1.5 hover:bg-blue-50"
                >編輯</button>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  className="flex-1 text-xs text-red-500 py-1.5 hover:bg-red-50"
                >刪除</button>
              </div>
            </div>
          )
        ))}
        {editing === 'new' && (
          <PresetForm
            draft={draft} setDraft={setDraft}
            saving={saving} error={error}
            onSave={save} onCancel={cancel}
          />
        )}
      </div>
    </div>
  );
}

function PresetForm({ draft, setDraft, saving, error, onSave, onCancel }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
      <input
        type="text" className="input-field text-sm"
        placeholder="範本標題"
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        maxLength={200}
      />
      <textarea
        rows={3} className="input-field text-sm resize-none"
        placeholder="範本內容"
        value={draft.body}
        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
      />
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-sm">取消</button>
        <button type="button" onClick={onSave} disabled={saving} className="btn-primary flex-1 text-sm">
          {saving ? '儲存中…' : '儲存'}
        </button>
      </div>
    </div>
  );
}
