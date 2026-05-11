'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const TYPE_OPTIONS = [
  { key: 'count', label: '計次（次/卷/串…）' },
  { key: 'duration', label: '計時（分鐘）' },
];

export default function AdminPracticesClient({ practices }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'count', unit_label: '次', sort_order: 0, active: true });
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
      const res = await fetch('/api/admin/practices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '新增失敗');
      } else {
        setShowForm(false);
        setForm({ name: '', type: 'count', unit_label: '次', sort_order: 0, active: true });
        router.refresh();
      }
    } catch {
      setError('網路錯誤');
    }
    setSubmitting(false);
  }

  async function handleSaveEdit() {
    setEditError('');
    const res = await fetch(`/api/admin/practices/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft),
    });
    const data = await res.json();
    if (!res.ok) {
      setEditError(data.error || '更新失敗');
      return;
    }
    setEditingId(null);
    setEditDraft(null);
    router.refresh();
  }

  async function handleToggleActive(p) {
    await fetch(`/api/admin/practices/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    });
    router.refresh();
  }

  async function handleDelete(p) {
    if (!(await confirm({
      title: '刪除功課',
      message: `刪除「${p.name}」會一併刪掉所有師兄姐的訂閱與紀錄，確定？`,
      confirmText: '刪除',
      danger: true,
    }))) return;
    const res = await fetch(`/api/admin/practices/${p.id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 mb-4">
        {practices.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-sm">尚未建立任何功課</div>
        )}
        {practices.map((p) => {
          const isEditing = editingId === p.id;
          if (isEditing) {
            return (
              <div key={p.id} className="px-4 py-3 space-y-2 bg-gray-50">
                <input
                  type="text" className="input-field text-sm"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                />
                <div className="flex gap-2">
                  <select
                    className="input-field text-sm flex-1"
                    value={editDraft.type}
                    onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="text" className="input-field text-sm w-24"
                    placeholder="單位"
                    value={editDraft.unit_label}
                    onChange={(e) => setEditDraft((d) => ({ ...d, unit_label: e.target.value }))}
                  />
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
            <div key={p.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">
                  {p.name}
                  {!p.active && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">停用</span>}
                </div>
                <div className="text-xs text-gray-500">
                  {p.type === 'duration' ? '計時' : '計次'} ・ 單位：{p.unit_label} ・ 排序：{p.sort_order}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-sm">
                <button onClick={() => { setEditingId(p.id); setEditDraft({ name: p.name, type: p.type, unit_label: p.unit_label, sort_order: p.sort_order }); }} className="text-blue-600">編輯</button>
                <button onClick={() => handleToggleActive(p)} className="text-temple-red">{p.active ? '停用' : '啟用'}</button>
                <button onClick={() => handleDelete(p)} className="text-red-500">刪除</button>
              </div>
            </div>
          );
        })}
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary">+ 新增功課</button>
      ) : (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800">新增功課</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">名稱 *</label>
            <input
              type="text" required className="input-field text-sm"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">類型 *</label>
            <select
              className="input-field text-sm"
              value={form.type}
              onChange={(e) => setForm((p) => ({
                ...p,
                type: e.target.value,
                unit_label: e.target.value === 'duration' ? '分鐘' : '次',
              }))}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">單位（顯示用，計時類自動為「分鐘」）</label>
            <input
              type="text" className="input-field text-sm"
              value={form.unit_label}
              onChange={(e) => setForm((p) => ({ ...p, unit_label: e.target.value }))}
            />
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
