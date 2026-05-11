'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminMembersClient({ members, locations, groups = [], canEdit, emptyMessage }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit(m) {
    setEditingId(m.id);
    setDraft({
      name: m.name || '',
      phone: m.phone || '',
      location_id: m.location_id || '',
      address: m.address || '',
      group_ids: (m.groups || []).map((g) => g.id),
    });
    setError('');
  }

  function toggleGroup(id) {
    setDraft((d) => d.group_ids.includes(id)
      ? { ...d, group_ids: d.group_ids.filter((g) => g !== id) }
      : { ...d, group_ids: [...d.group_ids, id] });
  }

  async function saveEdit(m) {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/members/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          phone: draft.phone || null,
          location_id: draft.location_id || null,
          address: draft.address || null,
          group_ids: draft.group_ids,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '更新失敗');
      } else {
        setEditingId(null);
        setDraft(null);
        router.refresh();
      }
    } catch {
      setError('網路錯誤');
    }
    setSaving(false);
  }

  async function toggleDisabled(m) {
    const action = m.is_disabled ? '啟用' : '停用';
    if (!confirm(`確定${action}「${m.name}」(${m.email}) 的帳號？`)) return;
    const res = await fetch(`/api/admin/members/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_disabled: !m.is_disabled }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '操作失敗');
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {members.length === 0 && (
        <div className="p-8 text-center text-gray-400">{emptyMessage}</div>
      )}
      <div className="divide-y divide-gray-100">
        {members.map((m, idx) => {
          const isEditing = editingId === m.id;
          if (isEditing) {
            return (
              <div key={m.id} className="px-4 py-3 bg-gray-50 space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">姓名 *</label>
                  <input
                    type="text" required className="input-field text-sm"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">電話</label>
                  <input
                    type="tel" className="input-field text-sm"
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">所屬道場</label>
                  <select
                    className="input-field text-sm"
                    value={draft.location_id}
                    onChange={(e) => setDraft((d) => ({ ...d, location_id: e.target.value }))}
                  >
                    <option value="">— 未選 —</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">地址</label>
                  <input
                    type="text" className="input-field text-sm"
                    value={draft.address}
                    onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                  />
                </div>
                {groups.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">群組標籤</label>
                    <div className="flex flex-wrap gap-2 bg-white rounded-lg p-2 border border-gray-200">
                      {groups.map((g) => {
                        const checked = draft.group_ids.includes(g.id);
                        return (
                          <button
                            key={g.id} type="button"
                            onClick={() => toggleGroup(g.id)}
                            className={`text-xs px-2 py-1 rounded-full border ${
                              checked
                                ? 'text-white border-transparent'
                                : 'text-gray-600 bg-white border-gray-300'
                            }`}
                            style={checked ? { backgroundColor: g.color || '#8B1A1A' } : {}}
                          >
                            {g.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="text-[11px] text-gray-400">
                  Email：{m.email}（無法修改）
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(null); setDraft(null); }} className="btn-secondary flex-1 text-sm">取消</button>
                  <button onClick={() => saveEdit(m)} disabled={saving} className="btn-primary flex-1 text-sm">
                    {saving ? '儲存中…' : '儲存'}
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 mr-1">{idx + 1}.</span>
                  <span className="font-medium text-gray-800">{m.name}</span>
                  {m.is_disabled ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">已停用</span>
                  ) : null}
                </div>
                <div className="text-sm text-gray-500 break-all">{m.phone || '—'}{m.email ? ` ・ ${m.email}` : ''}</div>
                {(m.location_name || m.address) && (
                  <div className="text-xs text-gray-400">{m.location_name || ''}{m.location_name && m.address ? ' ・ ' : ''}{m.address || ''}</div>
                )}
                {m.groups && m.groups.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.groups.map((g) => (
                      <span key={g.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: g.color || '#8B1A1A' }}>
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 text-sm">
                {'reg_count' in m && (
                  <span className="text-xs text-gray-400">{m.reg_count} 次報名</span>
                )}
                {canEdit && (
                  <>
                    <button onClick={() => startEdit(m)} className="text-blue-600">編輯</button>
                    <button
                      onClick={() => toggleDisabled(m)}
                      className={m.is_disabled ? 'text-temple-red' : 'text-red-500'}
                    >
                      {m.is_disabled ? '啟用' : '停用'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
