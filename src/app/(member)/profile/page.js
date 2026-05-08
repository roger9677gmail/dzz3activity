'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [locations, setLocations] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: '', location_id: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      if (d.user) {
        setUser(d.user);
        setForm({
          phone: d.user.phone || '',
          location_id: d.user.location_id || '',
          address: d.user.address || '',
        });
      }
    });
    fetch('/api/locations').then((r) => r.json()).then((d) => setLocations(d.locations || [])).catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: form.phone || null,
          location_id: form.location_id || null,
          address: form.address || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || '更新失敗');
      } else {
        setUser(data.user);
        setEditing(false);
        setMessage('已更新');
        setTimeout(() => setMessage(''), 2000);
      }
    } catch {
      setMessage('網路錯誤');
    }
    setSaving(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">載入中...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-lg font-bold">個人資料</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Avatar and name */}
        <div className="card p-6 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-temple-red flex items-center justify-center text-white text-3xl font-bold mb-3">
            {user.name?.[0] || '?'}
          </div>
          <h2 className="text-xl font-bold text-temple-dark">{user.name}</h2>
          <span className="text-sm text-gray-500 mt-1">師兄姐</span>
        </div>

        {/* User info — view or edit */}
        {!editing ? (
          <div className="card divide-y divide-gray-100">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">電話</span>
              <span className="text-sm font-medium">{user.phone || <span className="text-gray-300">未填</span>}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">所屬道場</span>
              <span className="text-sm font-medium">{user.location_name || <span className="text-gray-300">未填</span>}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">地址</span>
              <span className="text-sm font-medium text-right max-w-[55%]">{user.address || <span className="text-gray-300">未填</span>}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500">加入日期</span>
              <span className="text-sm font-medium">{user.created_at?.slice(0, 10)}</span>
            </div>
            <button onClick={() => setEditing(true)}
              className="w-full px-4 py-3 text-sm text-temple-red font-medium hover:bg-red-50 transition-colors">
              ✏️ 編輯資料
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="card p-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" disabled className="input-field text-sm bg-gray-50" value={user.email} />
              <p className="text-[11px] text-gray-400 mt-1">Email 為登入帳號，無法修改</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">電話</label>
              <input type="tel" className="input-field text-sm" placeholder="選填"
                value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">所屬道場</label>
              <select className="input-field text-sm"
                value={form.location_id}
                onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))}>
                <option value="">— 不選 —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">地址</label>
              <input type="text" className="input-field text-sm" placeholder="選填"
                value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            </div>
            {message && (
              <div className="text-sm text-red-600">{message}</div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setEditing(false); setMessage(''); }} className="btn-secondary flex-1 text-sm">取消</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </form>
        )}

        {message && !editing && (
          <div className="text-sm text-green-700 text-center">{message}</div>
        )}

        {/* App info */}
        <div className="card p-4">
          <h3 className="font-medium text-sm text-gray-700 mb-2">關於本系統</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            大自在山活動報名系統讓師兄姐可以便利地報名各項活動，查看報名紀錄，並接收活動提醒通知。
          </p>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full btn-secondary text-red-600 border-red-200"
        >
          {loggingOut ? '登出中...' : '登出'}
        </button>
      </div>
    </div>
  );
}
