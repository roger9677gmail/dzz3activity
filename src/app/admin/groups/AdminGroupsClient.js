'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const DEFAULT_COLOR = '#8B1A1A';
const PRESETS = ['#8B1A1A', '#B22222', '#C4962A', '#2D6E3C', '#1F4F8F', '#6B4DBA', '#3F3F46'];

export default function AdminGroupsClient({ groups }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', color: DEFAULT_COLOR, sort_order: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editError, setEditError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || '新增失敗');
      else {
        setShowForm(false);
        setForm({ name: '', color: DEFAULT_COLOR, sort_order: 0 });
        router.refresh();
      }
    } catch { setError('網路錯誤'); }
    setSubmitting(false);
  }

  async function handleSaveEdit() {
    setEditError('');
    // Mirror groups: only color / sort_order are editable — strip name/active.
    const editing = groups.find((g) => g.id === editingId);
    const payload = editing?.location_id != null
      ? { color: editDraft.color, sort_order: editDraft.sort_order }
      : editDraft;
    const res = await fetch(`/api/admin/groups/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setEditError(data.error || '更新失敗'); return; }
    setEditingId(null);
    setEditDraft(null);
    router.refresh();
  }

  async function handleToggleActive(g) {
    await fetch(`/api/admin/groups/${g.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !g.active }),
    });
    router.refresh();
  }

  async function handleDelete(g) {
    if (g.name === '全體師兄姐') { alert('預設群組無法刪除'); return; }
    if (!confirm(`刪除群組「${g.name}」會解除 ${g.member_count} 位成員的標籤關聯，確定？`)) return;
    const res = await fetch(`/api/admin/groups/${g.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || '刪除失敗'); return; }
    router.refresh();
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 mb-4">
        {groups.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-sm">尚未建立任何群組</div>
        )}
        {groups.map((g) => {
          const isMirror = g.location_id != null;
          const isEditing = editingId === g.id;
          if (isEditing) {
            return (
              <div key={g.id} className="px-4 py-3 space-y-2 bg-gray-50">
                {isMirror ? (
                  <div className="text-sm text-gray-600">
                    🏯 道場鏡射群組「{g.name}」— 名稱請至「道場管理」修改
                  </div>
                ) : (
                  <input
                    type="text" className="input-field text-sm"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                )}
                <div className="flex flex-wrap gap-2 items-center">
                  {PRESETS.map((c) => (
                    <button
                      key={c} type="button"
                      onClick={() => setEditDraft((d) => ({ ...d, color: c }))}
                      className={`w-6 h-6 rounded-full ${editDraft.color === c ? 'ring-2 ring-offset-1 ring-gray-700' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="number" className="input-field text-sm w-20" placeholder="排序"
                    value={editDraft.sort_order}
                    onChange={(e) => setEditDraft((d) => ({ ...d, sort_order: e.target.value }))}
                  />
                </div>
                {editError && <div className="text-sm text-red-600">{editError}</div>}
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(null); setEditDraft(null); }} className="btn-secondary flex-1 text-sm">取消</button>
                  <button onClick={handleSaveEdit} className="btn-primary flex-1 text-sm">儲存</button>
                </div>
              </div>
            );
          }
          return (
            <div key={g.id} className="px-4 py-3 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 flex items-center gap-2 flex-wrap">
                  {isMirror ? '🏯' : null}
                  <span>{g.name}</span>
                  {isMirror && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">道場鏡射</span>
                  )}
                  {!g.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">停用</span>}
                </div>
                <div className="text-xs text-gray-500">
                  {g.member_count} 位成員 ・ 排序：{g.sort_order}
                  {isMirror && <span className="ml-1 text-gray-400">・成員依師兄姐道場自動同步</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-sm">
                <button onClick={() => { setEditingId(g.id); setEditDraft({ name: g.name, color: g.color, sort_order: g.sort_order }); }} className="text-blue-600">編輯</button>
                <button onClick={() => handleToggleActive(g)} disabled={isMirror} className="text-temple-red disabled:text-gray-300">{g.active ? '停用' : '啟用'}</button>
                <button onClick={() => handleDelete(g)} disabled={g.name === '全體師兄姐' || isMirror} className="text-red-500 disabled:text-gray-300">刪除</button>
              </div>
            </div>
          );
        })}
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary">+ 新增群組</button>
      ) : (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800">新增群組</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">群組名稱 *</label>
            <input
              type="text" required className="input-field text-sm"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">代表顏色</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((c) => (
                <button
                  key={c} type="button"
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-full ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-700' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">排序（小→大）</label>
            <input
              type="number" className="input-field text-sm"
              value={form.sort_order}
              onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
            />
          </div>
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary flex-1">取消</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? '建立中…' : '建立'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
