'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function AdminMembersClient({ members, locations, groups = [], canEdit, canImpersonate = false, canDelete = false, emptyMessage }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(null); // member id currently being launched
  // Delete dialog state. We require the admin to retype the member's email
  // before the destructive call fires, so misclicks can't nuke an account.
  const [deletingMember, setDeletingMember] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function startImpersonate(m, mode) {
    const isWrite = mode === 'write';
    const ok = await confirm({
      title: `${isWrite ? '✏️ 可寫' : '👁️ 唯讀'}模擬：${m.name}`,
      message: isWrite
        ? '進入【可寫】模式後，你按下的所有按鈕、填的表單都會以該師兄姐名義執行（會留 audit log）。確定？'
        : '進入【唯讀】模式後，可看到該師兄姐看到的畫面；任何寫入動作（報名、點讚、留言…）都會被擋下。確定？',
      confirmText: isWrite ? '進入可寫模式' : '進入唯讀模式',
      danger: isWrite,
    });
    if (!ok) return;
    setImpersonating(m.id);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: m.id, mode: isWrite ? 'write' : 'read' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || '無法進入模擬');
        setImpersonating(null);
        return;
      }
      window.location.href = '/events';
    } catch (err) {
      console.error('start impersonate failed:', err);
      alert('網路錯誤，請稍後再試');
      setImpersonating(null);
    }
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
    if (!(await confirm({
      title: `${action}帳號`,
      message: `確定${action}「${m.name}」(${m.email}) 的帳號？`,
      confirmText: action,
      danger: !m.is_disabled,
    }))) return;
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

  // Inline toggle: add/remove a group for a member. Sends the full new
  // group_ids array via PATCH (mirror groups are auto-filtered server-side).
  const [busyChipId, setBusyChipId] = useState(null); // `${memberId}-${groupId}`
  async function toggleGroupMembership(m, groupId, currentlyMember) {
    const key = `${m.id}-${groupId}`;
    if (busyChipId === key) return;
    setBusyChipId(key);
    try {
      const existing = (m.groups || []).map((g) => g.id);
      const next = currentlyMember
        ? existing.filter((id) => id !== groupId)
        : [...existing, groupId];
      const res = await fetch(`/api/admin/members/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_ids: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || '更新失敗');
      else router.refresh();
    } finally {
      setBusyChipId(null);
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
                {groups.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">群組標籤</label>
                    <div className="flex flex-wrap gap-2 bg-white rounded-lg p-2 border border-gray-200">
                      {groups.map((g) => {
                        const isMirror = g.location_id != null;
                        // Mirror chips follow members.location_id (above) and
                        // can't be hand-toggled here. Show as locked.
                        const checked = isMirror
                          ? Number(draft.location_id) === Number(g.location_id)
                          : draft.group_ids.includes(g.id);
                        return (
                          <button
                            key={g.id} type="button"
                            onClick={() => isMirror ? null : toggleGroup(g.id)}
                            disabled={isMirror}
                            title={isMirror ? '此標籤依「所屬道場」自動套用' : ''}
                            className={`text-xs px-2 py-1 rounded-full border ${
                              checked
                                ? 'text-white border-transparent'
                                : 'text-gray-600 bg-white border-gray-300'
                            } ${isMirror ? 'opacity-70 cursor-not-allowed' : ''}`}
                            style={checked ? { backgroundColor: g.color || '#8B1A1A' } : {}}
                          >
                            {isMirror ? `🏯 ${g.name}` : g.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">🏯 道場標籤依上面的「所屬道場」自動套用，無法手動調整</p>
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
                  {m.is_admin ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-temple-red text-white">👑 管理員</span>
                  ) : null}
                  {m.is_disabled ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">已停用</span>
                  ) : null}
                </div>
                <div className="text-sm text-gray-500 break-all">{m.phone || '—'}{m.email ? ` ・ ${m.email}` : ''}</div>
                {(m.location_name || m.address) && (
                  <div className="text-xs text-gray-400">{m.location_name || ''}{m.location_name && m.address ? ' ・ ' : ''}{m.address || ''}</div>
                )}
                <div className="flex flex-wrap gap-1 mt-1 items-center">
                  {groups.map((g) => {
                    const isMirror = g.location_id != null;
                    const isMember = (m.groups || []).some((mg) => mg.id === g.id);
                    const key = `${m.id}-${g.id}`;
                    const busy = busyChipId === key;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => !isMirror && toggleGroupMembership(m, g.id, isMember)}
                        disabled={isMirror || busy}
                        title={isMirror
                          ? '道場鏡射群組依「所屬道場」自動套用'
                          : (isMember ? '點擊將此師兄姐移出群組' : '點擊將此師兄姐加入群組')}
                        className={`text-xs px-3 py-1.5 min-h-[32px] rounded-full border transition-opacity ${
                          isMember
                            ? 'text-white border-transparent'
                            : 'text-gray-600 bg-white border-gray-300 hover:bg-gray-50'
                        } ${isMirror ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} ${
                          busy ? 'opacity-50' : ''
                        }`}
                        style={isMember ? { backgroundColor: g.color || '#8B1A1A' } : {}}
                      >
                        {isMirror ? `🏯 ${g.name}` : g.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-sm flex-wrap justify-end">
                {'reg_count' in m && (
                  <span className="text-xs text-gray-400">{m.reg_count} 次報名</span>
                )}
                {canImpersonate && !m.is_disabled && (
                  <>
                    <button
                      onClick={() => startImpersonate(m, 'read')}
                      disabled={impersonating === m.id}
                      title="以該師兄姐身分檢視（唯讀，安全）"
                      className="text-amber-700 hover:text-amber-900 disabled:opacity-40"
                    >👁️ 唯讀模擬</button>
                    <button
                      onClick={() => startImpersonate(m, 'write')}
                      disabled={impersonating === m.id}
                      title="以該師兄姐身分代為操作（會留 audit log）"
                      className="text-red-700 hover:text-red-900 disabled:opacity-40"
                    >✏️ 可寫模擬</button>
                  </>
                )}
                {canEdit && (
                  <>
                    <button onClick={() => startEdit(m)} className="text-blue-600">編輯</button>
                    <button
                      onClick={() => toggleDisabled(m)}
                      disabled={!!m.is_admin}
                      title={m.is_admin ? '請先到「管理員設定」撤銷後台權限再停用帳號' : ''}
                      className={`${m.is_disabled ? 'text-temple-red' : 'text-red-500'} disabled:text-gray-300 disabled:cursor-not-allowed`}
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
