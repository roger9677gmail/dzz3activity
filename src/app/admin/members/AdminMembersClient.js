'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AdminMembersClient({ members, locations, canEdit, canDelete, emptyMessage }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Delete dialog state. We require the admin to retype the member's email
  // before the destructive call fires, so misclicks can't nuke an account.
  const [deletingMember, setDeletingMember] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  function startEdit(m) {
    setEditingId(m.id);
    setDraft({
      name: m.name || '',
      phone: m.phone || '',
      location_id: m.location_id || '',
      address: m.address || '',
    });
    setError('');
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

  function openDelete(m) {
    setDeletingMember(m);
    setDeleteConfirm('');
    setDeleteError('');
  }

  function closeDelete() {
    if (deleting) return;
    setDeletingMember(null);
    setDeleteConfirm('');
    setDeleteError('');
  }

  async function confirmDelete() {
    if (!deletingMember) return;
    if (deleteConfirm.trim().toLowerCase() !== String(deletingMember.email || '').toLowerCase()) {
      setDeleteError('輸入的 Email 與此帳號不符');
      return;
    }
    setDeleteError('');
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/members/${deletingMember.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || '刪除失敗');
        setDeleting(false);
        return;
      }
      const counts = data.counts || {};
      const summary = [
        counts.member ? `師兄姐 1` : null,
        counts.registrations ? `報名 ${counts.registrations}` : null,
        counts.email_verifications ? `驗證碼 ${counts.email_verifications}` : null,
        counts.login_attempts ? `登入紀錄 ${counts.login_attempts}` : null,
      ].filter(Boolean).join('、');
      alert(`已刪除：${summary || '無資料'}`);
      setDeletingMember(null);
      setDeleteConfirm('');
      setDeleting(false);
      router.refresh();
    } catch {
      setDeleteError('網路錯誤');
      setDeleting(false);
    }
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-400 mr-1">{idx + 1}.</span>
                  <span className="font-medium text-gray-800">{m.name}</span>
                  {m.is_admin ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-temple-red text-white">管理員</span>
                  ) : null}
                  {m.is_disabled ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">已停用</span>
                  ) : null}
                </div>
                <div className="text-sm text-gray-500 break-all">{m.phone || '—'}{m.email ? ` ・ ${m.email}` : ''}</div>
                {(m.location_name || m.address) && (
                  <div className="text-xs text-gray-400">{m.location_name || ''}{m.location_name && m.address ? ' ・ ' : ''}{m.address || ''}</div>
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
                {canDelete && (
                  <button onClick={() => openDelete(m)} className="text-red-700 font-medium">
                    刪除
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {deletingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-5 space-y-3">
            <h3 className="text-lg font-bold text-red-700">⚠️ 永久刪除帳號</h3>
            <p className="text-sm text-gray-700">
              即將永久刪除「<strong>{deletingMember.name}</strong>」
              （{deletingMember.email}）及其所有相關資料：
            </p>
            <ul className="text-xs text-gray-600 list-disc pl-5 space-y-0.5">
              <li>個人資料、頭像</li>
              <li>所有報名紀錄、報名項目、繳費紀錄、收據編號</li>
              <li>修行訂閱、每日修行紀錄、修行筆記（含公開分享）</li>
              <li>推播訂閱、密碼重設碼、Email 驗證碼、登入失敗紀錄</li>
            </ul>
            <p className="text-sm text-red-600 font-medium">
              此操作 <u>不可復原</u>。請輸入此帳號 Email 以確認：
            </p>
            <div>
              <code className="text-xs text-gray-500 break-all">{deletingMember.email}</code>
              <input
                type="text"
                autoFocus
                className="input-field text-sm mt-1"
                placeholder="輸入 Email 確認"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                disabled={deleting}
              />
            </div>
            {deleteError && <div className="text-sm text-red-600">{deleteError}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={closeDelete} disabled={deleting} className="btn-secondary flex-1 text-sm">
                取消
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 text-sm py-2 rounded-lg bg-red-700 text-white font-medium disabled:opacity-50"
              >
                {deleting ? '刪除中…' : '確認永久刪除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
