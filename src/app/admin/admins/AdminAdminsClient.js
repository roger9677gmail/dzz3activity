'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const PERMISSION_OPTIONS = [
  { key: '*', label: '全部權限（最高管理員）' },
  { key: 'events:manage', label: '活動管理' },
  { key: 'registrations:manage', label: '報名管理' },
  { key: 'members:manage', label: '師兄姐管理' },
  { key: 'locations:manage', label: '道場管理' },
  { key: 'admins:manage', label: '管理員設定（含權限指派）' },
  { key: 'reports:view', label: '報表匯出' },
  { key: 'notifications:send', label: '推播通知' },
  { key: 'practices:manage', label: '功課項目管理' },
  { key: 'announcements:manage', label: '公告訊息管理' },
  { key: 'groups:manage', label: '群組標籤管理' },
  { key: 'attendance:manage', label: '活動登記管理' },
];

function summarize(perms) {
  if (!Array.isArray(perms) || perms.length === 0) return '尚未指派任何權限';
  if (perms.includes('*')) return '全部權限';
  return perms
    .map((p) => PERMISSION_OPTIONS.find((o) => o.key === p)?.label || p)
    .join('、');
}

export default function AdminAdminsClient({ admins, currentAdminId }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    permissions: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwInfo, setPwInfo] = useState('');
  const [permEditingId, setPermEditingId] = useState(null);
  const [permDraft, setPermDraft] = useState([]);
  const [permSaving, setPermSaving] = useState(false);
  const [permError, setPermError] = useState('');

  function togglePerm(list, key) {
    if (key === '*') return list.includes('*') ? [] : ['*'];
    const without = list.filter((p) => p !== '*');
    return without.includes(key) ? without.filter((p) => p !== key) : [...without, key];
  }

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
        setForm({ name: '', email: '', phone: '', password: '', permissions: [] });
        setShowForm(false);
        router.refresh();
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setSubmitting(false);
  }

  async function handleRevoke(admin) {
    if (!(await confirm({
      title: '撤銷管理員權限',
      message: `確定撤銷管理員「${admin.name}」(${admin.email}) 的後台權限？\n（其師兄姐帳號與紀錄會保留）`,
      confirmText: '撤銷',
      danger: true,
    }))) return;
    const res = await fetch(`/api/admin/admins/${admin.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '撤銷失敗');
      return;
    }
    router.refresh();
  }

  async function handlePermSave(admin) {
    setPermError('');
    setPermSaving(true);
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: permDraft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPermError(data.error || '儲存失敗');
      } else {
        setPermEditingId(null);
        router.refresh();
      }
    } catch {
      setPermError('網路錯誤');
    }
    setPermSaving(false);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwInfo('');
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('新密碼兩次輸入不一致');
      return;
    }
    if (pwForm.new_password.length < 6) {
      setPwError('新密碼至少需 6 碼');
      return;
    }
    setPwSubmitting(true);
    try {
      const res = await fetch(`/api/admin/admins/${currentAdminId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: pwForm.old_password,
          new_password: pwForm.new_password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || '修改失敗');
      } else {
        setPwInfo('密碼已更新');
        setPwForm({ old_password: '', new_password: '', confirm_password: '' });
        setTimeout(() => { setPwInfo(''); setPwOpen(false); }, 1500);
      }
    } catch {
      setPwError('網路錯誤，請稍後再試');
    }
    setPwSubmitting(false);
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 mb-4">
        {admins.map((a) => {
          const isMe = a.id === currentAdminId;
          const editing = permEditingId === a.id;
          const perms = a.admin_permissions || [];
          return (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-800">
                    {a.name}
                    {isMe && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-temple-red text-white">您</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 break-all">{a.email}{a.phone ? ` ・ ${a.phone}` : ''}</div>
                  <div className="text-xs text-gray-500 mt-1">權限：{summarize(perms)}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isMe && (
                    <button
                      onClick={() => { setPwOpen((v) => !v); setPwError(''); setPwInfo(''); }}
                      className="text-sm text-temple-red"
                    >
                      {pwOpen ? '取消' : '修改密碼'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (editing) {
                        setPermEditingId(null);
                      } else {
                        setPermEditingId(a.id);
                        setPermDraft([...perms]);
                        setPermError('');
                      }
                    }}
                    className="text-sm text-blue-600"
                  >
                    {editing ? '取消' : '編輯權限'}
                  </button>
                  <button
                    onClick={() => handleRevoke(a)}
                    disabled={isMe}
                    className="text-sm text-red-500 disabled:text-gray-300"
                  >
                    撤銷
                  </button>
                </div>
              </div>

              {editing && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3 space-y-2">
                  {PERMISSION_OPTIONS.map((opt) => {
                    const checked = opt.key === '*'
                      ? permDraft.includes('*')
                      : permDraft.includes('*') || permDraft.includes(opt.key);
                    const disabled = opt.key !== '*' && permDraft.includes('*');
                    return (
                      <label key={opt.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => setPermDraft((d) => togglePerm(d, opt.key))}
                        />
                        <span className={disabled ? 'text-gray-400' : ''}>{opt.label}</span>
                      </label>
                    );
                  })}
                  {permError && <div className="text-sm text-red-600">{permError}</div>}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPermEditingId(null)}
                      className="btn-secondary flex-1 text-sm"
                    >取消</button>
                    <button
                      type="button"
                      onClick={() => handlePermSave(a)}
                      disabled={permSaving}
                      className="btn-primary flex-1 text-sm"
                    >
                      {permSaving ? '儲存中…' : '儲存權限'}
                    </button>
                  </div>
                </div>
              )}

              {isMe && pwOpen && (
                <form onSubmit={handleChangePassword} className="mt-3 space-y-2 bg-gray-50 rounded-lg p-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">目前密碼</label>
                    <input
                      type="password" required autoComplete="current-password"
                      className="input-field text-sm"
                      value={pwForm.old_password}
                      onChange={(e) => setPwForm((p) => ({ ...p, old_password: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">新密碼（至少 6 碼）</label>
                    <input
                      type="password" required minLength={6} autoComplete="new-password"
                      className="input-field text-sm"
                      value={pwForm.new_password}
                      onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">再次輸入新密碼</label>
                    <input
                      type="password" required autoComplete="new-password"
                      className="input-field text-sm"
                      value={pwForm.confirm_password}
                      onChange={(e) => setPwForm((p) => ({ ...p, confirm_password: e.target.value }))}
                    />
                  </div>
                  {pwError && <div className="text-sm text-red-600">{pwError}</div>}
                  {pwInfo && <div className="text-sm text-green-700">{pwInfo}</div>}
                  <button type="submit" disabled={pwSubmitting} className="btn-primary text-sm w-full">
                    {pwSubmitting ? '更新中…' : '更新密碼'}
                  </button>
                </form>
              )}
            </div>
          );
        })}
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">指派權限</label>
            <div className="space-y-1.5 bg-gray-50 rounded-lg p-3">
              {PERMISSION_OPTIONS.map((opt) => {
                const checked = opt.key === '*'
                  ? form.permissions.includes('*')
                  : form.permissions.includes('*') || form.permissions.includes(opt.key);
                const disabled = opt.key !== '*' && form.permissions.includes('*');
                return (
                  <label key={opt.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => setForm((p) => ({ ...p, permissions: togglePerm(p.permissions, opt.key) }))}
                    />
                    <span className={disabled ? 'text-gray-400' : ''}>{opt.label}</span>
                  </label>
                );
              })}
            </div>
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
