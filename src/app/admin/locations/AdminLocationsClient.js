'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function AdminLocationsClient({ locations }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', sort_order: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          sort_order: form.sort_order ? parseInt(form.sort_order) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '新增失敗');
      } else {
        setForm({ name: '', sort_order: '' });
        setShowForm(false);
        router.refresh();
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setSubmitting(false);
  }

  async function toggleActive(loc) {
    const res = await fetch(`/api/admin/locations/${loc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !loc.active }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || '更新失敗');
      return;
    }
    router.refresh();
  }

  async function rename(loc) {
    const next = prompt('新的道場名稱', loc.name);
    if (!next || next.trim() === loc.name) return;
    const res = await fetch(`/api/admin/locations/${loc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: next.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || '更新失敗');
      return;
    }
    router.refresh();
  }

  async function reorder(loc) {
    const next = prompt('新的排序值（數字越小越前）', String(loc.sort_order ?? 0));
    if (next == null) return;
    const v = parseInt(next);
    if (Number.isNaN(v)) return alert('請輸入數字');
    const res = await fetch(`/api/admin/locations/${loc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sort_order: v }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || '更新失敗');
      return;
    }
    router.refresh();
  }

  async function handleDelete(loc) {
    if (loc.member_count > 0) {
      alert(`仍有 ${loc.member_count} 位師兄姐屬於此道場，請先轉移後再刪除`);
      return;
    }
    if (!(await confirm({ title: '刪除道場', message: `確定刪除道場「${loc.name}」？`, confirmText: '刪除', danger: true }))) return;
    const res = await fetch(`/api/admin/locations/${loc.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || '刪除失敗');
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 mb-4">
        {locations.length === 0 && (
          <div className="p-6 text-center text-gray-400">尚無道場，請新增</div>
        )}
        {locations.map((loc) => (
          <div key={loc.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-800 flex items-center gap-2">
                {loc.name}
                {!loc.active && <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">停用</span>}
              </div>
              <div className="text-xs text-gray-500">
                排序 {loc.sort_order ?? 0} ・ {loc.member_count} 位師兄姐
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <button onClick={() => rename(loc)} className="text-temple-red">改名</button>
              <button onClick={() => reorder(loc)} className="text-gray-500">排序</button>
              <button onClick={() => toggleActive(loc)} className="text-gray-500">
                {loc.active ? '停用' : '啟用'}
              </button>
              <button onClick={() => handleDelete(loc)} className="text-red-500 disabled:text-gray-300"
                disabled={loc.member_count > 0}>
                刪除
              </button>
            </div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary">+ 新增道場</button>
      ) : (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800">新增道場</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">道場名稱 *</label>
            <input type="text" required maxLength={50} className="input-field text-sm"
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">排序（數字越小越前）</label>
            <input type="number" className="input-field text-sm"
              value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
          </div>
          {error && <div role="alert" aria-live="polite" className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(''); }} className="btn-secondary flex-1">取消</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? '建立中...' : '建立'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
