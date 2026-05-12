'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialog';

// Inline manager for one event's staff (法會工作人員).
// Rows are flat (event_id, role_name, member_id); UI groups by role_name.
export default function EventStaffEditor({ eventId, initialStaff, initialSuggestions, candidates }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [staff, setStaff] = useState(initialStaff || []);
  const [suggestions, setSuggestions] = useState(initialSuggestions || []);
  const [addingTo, setAddingTo] = useState(null); // role_name being added to (or '__new__')
  const [newRoleName, setNewRoleName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const res = await fetch(`/api/admin/events/${eventId}/staff`);
    const data = await res.json();
    if (res.ok) {
      setStaff(data.staff || []);
      setSuggestions(data.suggestions || []);
    }
  }

  // Group rows by role_name preserving sort_order then id.
  const groups = [];
  const byRole = new Map();
  for (const r of staff) {
    if (!byRole.has(r.role_name)) {
      byRole.set(r.role_name, []);
      groups.push(r.role_name);
    }
    byRole.get(r.role_name).push(r);
  }

  function cancelAdd() {
    setAddingTo(null);
    setNewRoleName('');
    setSearch('');
    setSelectedIds([]);
    setNotify(true);
    setError('');
  }

  async function submitAdd() {
    setError('');
    // Defensive: addingTo can in theory be null mid-render. Guard the trim().
    const rawRole = addingTo === '__new__' ? newRoleName : (addingTo || '');
    const roleName = String(rawRole).trim();
    if (!roleName) { setError('請輸入工作組名稱'); return; }
    if (selectedIds.length === 0) { setError('請選擇要加入的師兄姐'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_name: roleName, member_ids: selectedIds, notify }),
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON response */ }
      if (!res.ok) {
        const msg = data.error || `加入失敗 (HTTP ${res.status})`;
        setError(msg);
        alert(msg);
        setBusy(false);
        return;
      }
      if (data.push?.error) {
        alert(`已新增 ${data.added} 位，但 ${data.push.error}`);
      } else if (data.push?.sent != null && notify) {
        // Brief feedback so the admin knows the push fired.
        alert(`✅ 已新增 ${data.added} 位，推播已送出 ${data.push.sent} / ${data.push.total}`);
      } else {
        alert(`✅ 已新增 ${data.added || 0} 位`);
      }
      cancelAdd();
      await refresh();
    } catch (err) {
      console.error('submitAdd failed:', err);
      const msg = `網路錯誤：${err?.message || ''}`;
      setError(msg);
      alert(msg);
    }
    setBusy(false);
  }

  async function removeOne(row) {
    if (!(await confirm({
      title: '移除工作人員',
      message: `將 ${row.member_name} 從「${row.role_name}」移除？`,
      confirmText: '移除',
      danger: true,
    }))) return;
    await fetch(`/api/admin/events/${eventId}/staff/${row.id}`, { method: 'DELETE' });
    await refresh();
  }

  async function renameRole(oldName) {
    const next = window.prompt(`「${oldName}」改名為：`, oldName);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === oldName) return;
    const res = await fetch(`/api/admin/events/${eventId}/staff`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_role_name: oldName, new_role_name: trimmed }),
    });
    if (res.ok) await refresh();
  }

  async function deleteRole(roleName) {
    const count = (byRole.get(roleName) || []).length;
    if (!(await confirm({
      title: '刪除工作組',
      message: `刪除「${roleName}」整組（${count} 位成員）？`,
      confirmText: '刪除',
      danger: true,
    }))) return;
    const res = await fetch(`/api/admin/events/${eventId}/staff`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_role_name: roleName, delete: true }),
    });
    if (res.ok) await refresh();
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between border-b pb-2 mb-3">
        <h3 className="font-bold text-temple-dark">工作人員</h3>
        <span className="text-xs text-gray-400">{staff.length} 位</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        指定法會工作人員 — 被指派的師兄姐可於「法會活動」頁查看夥伴名單與報名資料。
      </p>

      <div className="space-y-3">
        {groups.length === 0 && addingTo !== '__new__' && (
          <div className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-lg">
            尚未指派任何工作人員
          </div>
        )}

        {groups.map((role) => {
          const rows = byRole.get(role) || [];
          return (
            <div key={role} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm text-gray-800">
                  {role} <span className="text-xs text-gray-400 ml-1">{rows.length}</span>
                </div>
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => renameRole(role)} className="text-blue-600">改名</button>
                  <button type="button" onClick={() => deleteRole(role)} className="text-red-500">刪除組</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {rows.map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full pl-2 pr-1 py-0.5">
                    {r.member_name}
                    <button
                      type="button"
                      onClick={() => removeOne(r)}
                      aria-label={`移除 ${r.member_name}`}
                      className="ml-0.5 w-5 h-5 rounded-full hover:bg-gray-200 text-gray-500"
                    >✕</button>
                  </span>
                ))}
              </div>
              {addingTo === role ? (
                <AddForm
                  candidates={candidates}
                  excludeIds={new Set(rows.map((r) => r.member_id))}
                  search={search} setSearch={setSearch}
                  selectedIds={selectedIds} setSelectedIds={setSelectedIds}
                  notify={notify} setNotify={setNotify}
                  busy={busy} error={error}
                  onSubmit={submitAdd} onCancel={cancelAdd}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { cancelAdd(); setAddingTo(role); }}
                  className="text-xs text-temple-red"
                >+ 加成員</button>
              )}
            </div>
          );
        })}

        {addingTo === '__new__' ? (
          <div className="border border-temple-red rounded-lg p-3 bg-red-50">
            <div className="font-medium text-sm text-gray-800 mb-2">新增工作組</div>
            <input
              type="text"
              className="input-field text-sm mb-2"
              placeholder="工作組名稱（例：香積組）"
              list="role-suggestions"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              autoFocus
              maxLength={50}
            />
            <datalist id="role-suggestions">
              {suggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
            <AddForm
              candidates={candidates}
              excludeIds={new Set()}
              search={search} setSearch={setSearch}
              selectedIds={selectedIds} setSelectedIds={setSelectedIds}
              notify={notify} setNotify={setNotify}
              busy={busy} error={error}
              onSubmit={submitAdd} onCancel={cancelAdd}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { cancelAdd(); setAddingTo('__new__'); }}
            className="btn-secondary text-sm w-full"
          >+ 新增工作組</button>
        )}
      </div>
    </div>
  );
}

function AddForm({ candidates, excludeIds, search, setSearch, selectedIds, setSelectedIds, notify, setNotify, busy, error, onSubmit, onCancel }) {
  const needle = search.trim().toLowerCase();
  const filtered = candidates.filter((c) => !excludeIds.has(c.id) && (
    !needle ||
    (c.name && c.name.toLowerCase().includes(needle)) ||
    (c.email && c.email.toLowerCase().includes(needle)) ||
    (c.phone && c.phone.includes(needle)) ||
    (c.location_name && c.location_name.toLowerCase().includes(needle))
  ));
  function toggle(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  return (
    <div className="space-y-2 mt-2">
      <input
        type="text"
        className="input-field text-sm"
        placeholder="搜尋姓名 / Email / 電話 / 道場"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-48 overflow-y-auto bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {filtered.length === 0 && <div className="text-xs text-gray-400 text-center py-4">無符合的師兄姐</div>}
        {filtered.slice(0, 30).map((c) => {
          const checked = selectedIds.includes(c.id);
          return (
            <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(c.id)}
                className="rounded"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-800">{c.name}</div>
                <div className="text-[11px] text-gray-400">
                  {c.location_name || ''}{c.phone ? `${c.location_name ? ' ・ ' : ''}${c.phone}` : ''}
                </div>
              </div>
            </label>
          );
        })}
        {filtered.length > 30 && (
          <div className="text-[11px] text-gray-400 text-center py-1">
            顯示前 30 筆，請輸入關鍵字（共 {filtered.length} 筆）
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        同時推播通知被指派者
      </label>
      {error && <div role="alert" className="text-xs text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-sm">取消</button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || selectedIds.length === 0}
          className="btn-primary flex-1 text-sm"
        >{busy ? '加入中…' : `加入 ${selectedIds.length} 位`}</button>
      </div>
    </div>
  );
}
