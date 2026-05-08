'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminAdminsClient({ admins, currentAdminId }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '新增失敗');
      } else {
        setForm({ name: '', email: '', phone: '', password: '' });
        setShowForm(false);
        router.refresh();
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setSubmitting(false);
  }

  async function handleDelete(admin) {
    if (!confirm(`確定刪除管理員「${admin.name}」(${admin.email})？`)) return;
    const res = await fetch(`/api/admin/admins/${admin.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '刪除失敗');
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 mb-4">
        {admins.map((a) => (
          <div key={a.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-800">
                {a.name}
                {a.id === currentAdminId && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-temple-red text-white">您</span>
                )}
              </div>
              <div className="text-xs text-gray-500">{a.email}{a.phone ? ` ・ ${a.phone}` : ''}</div>
            </div>
            <button
              onClick={() => handleDelete(a)}
              disabled={a.id === currentAdminId}
              className="text-sm text-red-500 disabled:text-gray-300"
            >
              刪除
            </button>
          </div>
        ))}
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + 新增管理員
        </button>
      ) : (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800">新增管理員</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">姓名 *</label>
            <input
              type="text" required className="input-field text-sm"
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email *（登入帳號）</label>
            <input
              type="email" required className="input-field text-sm"
              value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">電話（選填）</label>
            <input
              type="tel" className="input-field text-sm"
              value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">密碼 *（至少 6 碼）</label>
            <input
              type="password" required minLength={6} className="input-field text-sm"
              value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
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
