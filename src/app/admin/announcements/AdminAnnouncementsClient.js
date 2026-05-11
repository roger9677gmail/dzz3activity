'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '@/components/ui/ConfirmDialog';

async function resizeImage(file, maxSize = 1280, quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

// `starts_at` / `ends_at` come back from the API as 'YYYY-MM-DD HH:MM:SS'.
// <input type="datetime-local"> wants 'YYYY-MM-DDTHH:MM'.
function toLocalInput(v) {
  if (!v) return '';
  const s = String(v).slice(0, 16).replace(' ', 'T');
  return s;
}
function fromLocalInput(v) {
  return v ? v.replace('T', ' ') + ':00' : null;
}

const EMPTY_FORM = {
  title: '', content: '', image: '',
  link_url: '', attachment_url: '', attachment_name: '',
  pinned: false, starts_at: '', ends_at: '', group_ids: [],
  send_push: false,
};

export default function AdminAnnouncementsClient({ announcements, groups }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // When entering "new" mode, default to "全體師兄姐" group selected.
  function startCreate() {
    const def = groups.find((g) => g.name === '全體師兄姐');
    setEditingId(null);
    setForm({ ...EMPTY_FORM, group_ids: def ? [def.id] : [] });
    setError('');
    setShowForm(true);
  }

  async function startEdit(a) {
    setError('');
    setShowForm(true);
    setEditingId(a.id);
    const res = await fetch(`/api/admin/announcements/${a.id}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error || '載入失敗'); return; }
    const x = data.announcement;
    setForm({
      title: x.title || '',
      content: x.content || '',
      image: x.image || '',
      link_url: x.link_url || '',
      attachment_url: x.attachment_url || '',
      attachment_name: x.attachment_name || '',
      pinned: !!x.pinned,
      starts_at: toLocalInput(x.starts_at),
      ends_at: toLocalInput(x.ends_at),
      group_ids: (x.groups || []).map((g) => g.group_id || g.id),
    });
  }

  function toggleGroup(id) {
    setForm((p) => p.group_ids.includes(id)
      ? { ...p, group_ids: p.group_ids.filter((g) => g !== id) }
      : { ...p, group_ids: [...p.group_ids, id] });
  }

  async function handleImage(file) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setError('請選 PNG / JPG / WebP 圖片');
      return;
    }
    try {
      const dataUrl = await resizeImage(file, 1280, 0.85);
      setForm((p) => ({ ...p, image: dataUrl }));
    } catch {
      setError('圖片處理失敗');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('請填寫標題'); return; }
    if (form.group_ids.length === 0) { setError('請至少選擇一個群組'); return; }
    setSubmitting(true);
    const payload = {
      ...form,
      starts_at: fromLocalInput(form.starts_at),
      ends_at: fromLocalInput(form.ends_at),
    };
    try {
      const url = editingId ? `/api/admin/announcements/${editingId}` : '/api/admin/announcements';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || '儲存失敗');
      else {
        setShowForm(false);
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        if (data.push) {
          if (data.push.error) alert(`公告已建立，但 ${data.push.error}`);
          else alert(`✅ 公告已建立，推播已發送給 ${data.push.sent} / ${data.push.total} 人`);
        }
        router.refresh();
      }
    } catch { setError('網路錯誤'); }
    setSubmitting(false);
  }

  async function handleDelete(a) {
    if (!(await confirm({ title: '刪除公告', message: `確定刪除公告「${a.title}」？`, confirmText: '刪除', danger: true }))) return;
    const res = await fetch(`/api/admin/announcements/${a.id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  async function togglePinned(a) {
    await fetch(`/api/admin/announcements/${a.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !a.pinned }),
    });
    router.refresh();
  }

  function fmtDt(v) { return v ? String(v).slice(0, 16).replace('T', ' ') : '—'; }

  return (
    <div>
      {/* List */}
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 mb-4">
        {announcements.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-sm">尚無公告</div>
        )}
        {announcements.map((a) => (
          <div key={a.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {a.pinned ? <span className="text-temple-red" aria-label="置頂">📌</span> : null}
                  <span className="text-sm font-medium text-gray-800">{a.title}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  生效 {fmtDt(a.starts_at)} ・ 失效 {fmtDt(a.ends_at)}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(a.groups || []).map((g) => (
                    <span key={g.id} className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: g.color || '#8B1A1A' }}>{g.name}</span>
                  ))}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  {a.created_by_name || '—'} ・ {String(a.created_at).slice(0, 16).replace('T', ' ')}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-sm">
                <button onClick={() => togglePinned(a)} className="text-temple-red">{a.pinned ? '取消置頂' : '置頂'}</button>
                <button onClick={() => startEdit(a)} className="text-blue-600">編輯</button>
                <button onClick={() => handleDelete(a)} className="text-red-500">刪除</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <button onClick={startCreate} className="btn-primary">+ 新增公告</button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-800">{editingId ? '編輯公告' : '新增公告'}</h3>

          <div>
            <label className="block text-xs text-gray-500 mb-1">標題 *</label>
            <input
              type="text" required className="input-field text-sm"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">內容</label>
            <textarea rows={4} className="input-field text-sm"
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">圖片（PNG / JPG / WebP，自動縮至 1280px）</label>
            <input
              type="file" accept="image/png,image/jpeg,image/webp"
              className="text-xs"
              onChange={(e) => { handleImage(e.target.files?.[0]); e.target.value = ''; }}
            />
            {form.image && (
              <div className="mt-2 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image} alt="" className="max-h-40 rounded-lg" />
                <button type="button" onClick={() => setForm((p) => ({ ...p, image: '' }))}
                  className="mt-1 text-xs text-red-500">移除圖片</button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">外部連結 URL</label>
            <input type="url" className="input-field text-sm" placeholder="https://..."
              value={form.link_url}
              onChange={(e) => setForm((p) => ({ ...p, link_url: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">附件 URL（Google Drive / Dropbox 等）</label>
            <input type="url" className="input-field text-sm" placeholder="https://..."
              value={form.attachment_url}
              onChange={(e) => setForm((p) => ({ ...p, attachment_url: e.target.value }))} />
          </div>
          {form.attachment_url && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">附件顯示名稱</label>
              <input type="text" className="input-field text-sm"
                value={form.attachment_name}
                onChange={(e) => setForm((p) => ({ ...p, attachment_name: e.target.value }))} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">生效時間</label>
              <input type="datetime-local" className="input-field text-sm"
                value={form.starts_at}
                onChange={(e) => setForm((p) => ({ ...p, starts_at: e.target.value }))} />
              <p className="text-[10px] text-gray-400 mt-0.5">空白=立即生效</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">失效時間</label>
              <input type="datetime-local" className="input-field text-sm"
                value={form.ends_at}
                onChange={(e) => setForm((p) => ({ ...p, ends_at: e.target.value }))} />
              <p className="text-[10px] text-gray-400 mt-0.5">空白=不失效</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.pinned}
              onChange={(e) => setForm((p) => ({ ...p, pinned: e.target.checked }))} />
            置頂顯示
          </label>

          {!editingId && (
            <label className="flex items-start gap-2 text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <input
                type="checkbox"
                checked={form.send_push}
                onChange={(e) => setForm((p) => ({ ...p, send_push: e.target.checked }))}
              />
              <span>
                🔔 建立後同時發送推播通知給目標群組
                <span className="block text-xs text-gray-500 mt-0.5">
                  通知標題會自動加上 📢，內容取自公告前 80 字；點推播會跳到「公告訊息」頁
                </span>
              </span>
            </label>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">目標群組 * (至少一個)</label>
            <div className="space-y-1.5 bg-gray-50 rounded-lg p-3">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.group_ids.includes(g.id)} onChange={() => toggleGroup(g.id)} />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color || '#8B1A1A' }} />
                  <span>{g.location_id != null ? `🏯 ${g.name}` : g.name}</span>
                </label>
              ))}
              {groups.length === 0 && <div className="text-xs text-gray-400">尚無可用群組</div>}
            </div>
          </div>

          {error && <div role="alert" aria-live="polite" className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); setError(''); }} className="btn-secondary flex-1">取消</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? '儲存中…' : (editingId ? '儲存' : '發布')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
