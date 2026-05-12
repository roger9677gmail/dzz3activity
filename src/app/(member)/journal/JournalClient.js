'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Heatmap from '@/components/journal/Heatmap';
import LogInput from '@/components/journal/LogInput';
import { formatPracticeValue, minutesToDurationString } from '@/lib/practices';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const TABS = [
  { key: 'log', label: '修行日誌' },
  { key: 'public', label: '大眾分享' },
  { key: 'leaderboard', label: '排名' },
];

// Client-side resize to keep practice_notes.image inline (~MEDIUMTEXT
// friendly). Reused for both add-form and inline edit.
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

function logsByDateForPractice(rangeLogs, practiceId) {
  const out = {};
  for (const r of rangeLogs) {
    if (Number(r.practice_id) !== Number(practiceId)) continue;
    out[r.log_date] = r.value;
  }
  return out;
}

// First date this member has any record for `practiceId`. Falls back to today.
function startDateForPractice(rangeLogs, practiceId, today) {
  let earliest = null;
  for (const r of rangeLogs) {
    if (Number(r.practice_id) !== Number(practiceId)) continue;
    if (!earliest || r.log_date < earliest) earliest = r.log_date;
  }
  return earliest || today;
}

export default function JournalClient({ session, subscriptions, dayLogs, rangeLogs, dayNotes, today, date, tab }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();

  // ─── Default tab is the editing log; date selector picks any day ──────
  const editing = tab !== 'public' && tab !== 'leaderboard';
  const isPast = date !== today;

  // values keyed by practice_id
  const [values, setValues] = useState(() => {
    const init = {};
    for (const r of dayLogs) init[r.practice_id] = r.value;
    return init;
  });
  const [savingLogs, setSavingLogs] = useState(false);
  const [logsMessage, setLogsMessage] = useState('');

  // notes
  const [notes, setNotes] = useState(dayNotes);
  const [newNote, setNewNote] = useState('');
  const [newNotePublic, setNewNotePublic] = useState(false);
  const [newNoteImage, setNewNoteImage] = useState('');
  const [newNoteLink, setNewNoteLink] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState('');

  // Bumped after any note mutation so the all-notes list (below stats) refetches.
  const [notesVersion, setNotesVersion] = useState(0);

  useEffect(() => {
    const init = {};
    for (const r of dayLogs) init[r.practice_id] = r.value;
    setValues(init);
    setNotes(dayNotes);
  }, [date, dayLogs, dayNotes]);

  function setTab(next) {
    const params = new URLSearchParams(searchParams);
    if (next === 'log') {
      params.delete('tab');
    } else {
      params.set('tab', next);
    }
    router.push(`/journal?${params.toString()}`);
  }

  function setDate(next) {
    const params = new URLSearchParams(searchParams);
    if (next === today) {
      params.delete('date');
    } else {
      params.set('date', next);
    }
    params.delete('tab');
    router.push(`/journal?${params.toString()}`);
  }

  async function saveLogs() {
    setSavingLogs(true);
    setLogsMessage('');
    try {
      const entries = subscriptions.map((p) => ({ practice_id: p.id, value: values[p.id] ?? null }));
      const res = await fetch('/api/me/logs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, entries }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLogsMessage(data.error || '儲存失敗');
      } else {
        setLogsMessage('已儲存');
        setTimeout(() => setLogsMessage(''), 1500);
        router.refresh();
      }
    } catch {
      setLogsMessage('網路錯誤');
    }
    setSavingLogs(false);
  }

  async function addNote(e) {
    e.preventDefault();
    setNoteError('');
    if (!newNote.trim()) return;
    setNoteSaving(true);
    try {
      const res = await fetch('/api/me/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: date,
          content: newNote,
          image: newNoteImage || null,
          link_url: newNoteLink.trim() || null,
          is_public: newNotePublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNoteError(data.error || '儲存失敗');
      } else {
        setNewNote('');
        setNewNotePublic(false);
        setNewNoteImage('');
        setNewNoteLink('');
        router.refresh();
        setNotesVersion((v) => v + 1);
      }
    } catch {
      setNoteError('網路錯誤');
    }
    setNoteSaving(false);
  }

  async function handleNoteImagePick(file) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setNoteError('請選 PNG / JPG / WebP 圖片');
      return;
    }
    try {
      const dataUrl = await resizeImage(file, 1280, 0.85);
      setNewNoteImage(dataUrl);
      setNoteError('');
    } catch {
      setNoteError('圖片處理失敗');
    }
  }

  async function toggleNotePublic(note) {
    const res = await fetch(`/api/me/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: !note.is_public }),
    });
    if (res.ok) {
      router.refresh();
      setNotesVersion((v) => v + 1);
    }
  }

  async function deleteNote(note) {
    if (!(await confirm({ title: '刪除筆記', message: '確定刪除這則筆記？', confirmText: '刪除', danger: true }))) return;
    const res = await fetch(`/api/me/notes/${note.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
      setNotesVersion((v) => v + 1);
    }
  }

  // Inline edit for the daily notes list (今日 view).
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteDraft, setEditingNoteDraft] = useState('');
  const [editingNoteSaving, setEditingNoteSaving] = useState(false);
  function startEditNote(note) {
    setEditingNoteId(note.id);
    setEditingNoteDraft(note.content || '');
  }
  function cancelEditNote() {
    setEditingNoteId(null);
    setEditingNoteDraft('');
  }
  async function saveEditNote(note) {
    const text = editingNoteDraft.trim();
    if (!text) return;
    setEditingNoteSaving(true);
    const res = await fetch(`/api/me/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) {
      cancelEditNote();
      router.refresh();
      setNotesVersion((v) => v + 1);
    }
    setEditingNoteSaving(false);
  }

  // ─── Horizontal swipe to change tabs ───────────────────────────────────
  const TAB_KEYS = ['log', 'public', 'leaderboard'];
  const currentTabKey = editing ? 'log' : tab;
  const tabIdx = TAB_KEYS.indexOf(currentTabKey);
  const touchStart = useRef(null);

  // Swipes that begin inside a horizontally-scrollable container should let
  // that container handle the gesture (e.g. the practice-chip row in the
  // leaderboard tab). Walk up the DOM looking for one.
  function isInsideHScroll(el) {
    while (el && el !== document.body && el.nodeType === 1) {
      const ox = el.scrollWidth > el.clientWidth ? getComputedStyle(el).overflowX : '';
      if (ox === 'auto' || ox === 'scroll') return true;
      el = el.parentElement;
    }
    return false;
  }

  function handleTouchStart(e) {
    if (e.touches.length !== 1) { touchStart.current = null; return; }
    if (isInsideHScroll(e.target)) { touchStart.current = null; return; }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e) {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < 60) return;        // too short
    if (ax < ay * 1.2) return;  // mostly vertical (scroll)
    if (dx < 0 && tabIdx < TAB_KEYS.length - 1) setTab(TAB_KEYS[tabIdx + 1]);
    else if (dx > 0 && tabIdx > 0) setTab(TAB_KEYS[tabIdx - 1]);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-lg font-bold">修行日誌</h1>
      </div>

      {/* Tab bar */}
      <div className="px-3 pt-3 flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.key === 'log' ? editing : tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 text-sm px-3 py-1.5 rounded-lg ${
                active ? 'bg-temple-red text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {t.label}
            </button>
          );
        })}
        <Link href="/journal/settings" className="shrink-0 text-sm px-3 py-1.5 rounded-lg bg-white text-gray-600 border border-gray-200 ml-auto">⚙️ 設定</Link>
      </div>

      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {editing && (
        <div className="p-4 space-y-4">
          {/* Date selector */}
          <div className="card p-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">日期</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="input-field text-sm flex-1"
            />
            {isPast && (
              <button onClick={() => setDate(today)} className="text-xs text-temple-red whitespace-nowrap">回今日</button>
            )}
          </div>

          {subscriptions.length === 0 && (
            <div className="card p-6 text-center text-gray-400">
              <p className="text-sm">尚未訂閱任何功課</p>
              <Link href="/journal/settings" className="text-temple-red text-sm font-medium mt-2 inline-block">前往設定 →</Link>
            </div>
          )}

          {/* Today's input */}
          {subscriptions.length > 0 && (
            <div className="card p-4 space-y-3">
              <h2 className="text-sm font-bold text-gray-700">{isPast ? '當日紀錄' : '今日功課'}</h2>
              <div className="space-y-3">
                {subscriptions.map((p) => (
                  <LogInput
                    key={p.id}
                    practice={p}
                    value={values[p.id] ?? null}
                    onChange={(v) => setValues((prev) => ({ ...prev, [p.id]: v }))}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveLogs} disabled={savingLogs} className="btn-primary text-sm flex-1">
                  {savingLogs ? '儲存中…' : '儲存紀錄'}
                </button>
                {logsMessage && <span className="text-xs text-green-700">{logsMessage}</span>}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="card p-4 space-y-3">
            <h2 className="text-sm font-bold text-gray-700">修行筆記 ・ {date}</h2>
            <form onSubmit={addNote} className="space-y-2">
              <textarea
                rows={3}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="寫下今天的修行心得…"
                className="input-field text-sm"
              />
              {newNoteImage && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newNoteImage} alt="" className="w-full max-h-60 object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setNewNoteImage('')}
                    aria-label="移除圖片"
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-7 h-7 text-sm"
                  >✕</button>
                </div>
              )}
              <input
                type="url"
                value={newNoteLink}
                onChange={(e) => setNewNoteLink(e.target.value)}
                placeholder="附加連結（選填，例：https://...）"
                className="input-field text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer">
                  📷 加圖片
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleNoteImagePick(e.target.files?.[0])}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 ml-1">
                  <input
                    type="checkbox"
                    checked={newNotePublic}
                    onChange={(e) => setNewNotePublic(e.target.checked)}
                  />
                  公開分享
                </label>
                <button type="submit" disabled={noteSaving || !newNote.trim()} className="btn-primary text-sm ml-auto">
                  {noteSaving ? '儲存中…' : '新增筆記'}
                </button>
              </div>
              {noteError && <div role="alert" className="text-sm text-red-600">{noteError}</div>}
            </form>
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="bg-gray-50 rounded-lg p-3">
                  {editingNoteId === n.id ? (
                    <>
                      <textarea
                        rows={3} maxLength={5000} autoFocus
                        className="input-field text-sm"
                        value={editingNoteDraft}
                        onChange={(e) => setEditingNoteDraft(e.target.value)}
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={cancelEditNote} className="btn-secondary text-xs px-3 py-1">取消</button>
                        <button onClick={() => saveEditNote(n)} disabled={editingNoteSaving} className="btn-primary text-xs px-3 py-1">
                          {editingNoteSaving ? '儲存中…' : '儲存'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm whitespace-pre-wrap break-words text-gray-800">{n.content}</div>
                      <NoteAttachments image={n.image} linkUrl={n.link_url} />
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                        <span>{n.is_public ? '🌐 已公開' : '🔒 私人'}</span>
                        <div className="flex gap-3">
                          <button onClick={() => startEditNote(n)} className="text-blue-600">編輯</button>
                          <button onClick={() => toggleNotePublic(n)} className="text-temple-red">
                            {n.is_public ? '改為私人' : '改為公開'}
                          </button>
                          <button onClick={() => deleteNote(n)} className="text-red-500">刪除</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {notes.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-2">尚無筆記</div>
              )}
            </div>
          </div>

          {/* Stats heatmaps per practice — from first record day → today */}
          {subscriptions.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-700 px-1">修行統計</h2>
              {subscriptions.map((p) => {
                const lbd = logsByDateForPractice(rangeLogs, p.id);
                const startDate = startDateForPractice(rangeLogs, p.id, today);
                return (
                  <div key={p.id} className="card p-4">
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="font-medium text-sm text-gray-800">{p.name}</div>
                      {p.daily_target != null && p.daily_target > 0 && (
                        <div className="text-[11px] text-gray-400">
                          目標 {p.type === 'duration' ? minutesToDurationString(p.daily_target) : `${p.daily_target} ${p.unit_label || '次'}`}
                        </div>
                      )}
                    </div>
                    <Heatmap
                      startDate={startDate}
                      logsByDate={lbd}
                      dailyTarget={p.daily_target}
                      onCellClick={(d) => setDate(d)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* All my notes — paginated, newest first */}
          <MyNotesSection
            version={notesVersion}
            onMutate={() => setNotesVersion((v) => v + 1)}
          />
        </div>
      )}

      {tab === 'public' && <PublicNotesTab />}
      {tab === 'leaderboard' && <LeaderboardTab subscriptions={subscriptions} session={session} />}
      </div>
    </div>
  );
}

// ── My notes (paginated, infinite-scroll) ──────────────────────────────
function MyNotesSection({ version, onMutate }) {
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [notes, setNotes] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const sentinelRef = useRef(null);

  // Reload from offset 0 whenever parent bumps `version` (note added/edited/deleted elsewhere).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/me/notes?offset=0')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = data.notes || [];
        setNotes(list);
        setOffset(list.length);
        setHasMore(!!data.hasMore);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [version]);

  async function loadMore() {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/me/notes?offset=${offset}`);
      const data = await res.json();
      const list = data.notes || [];
      setNotes((prev) => [...prev, ...list]);
      setOffset((o) => o + list.length);
      setHasMore(!!data.hasMore);
    } catch {}
    setLoading(false);
  }

  // Auto-load when the sentinel scrolls into view.
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '120px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, offset, loading]);

  async function togglePublic(note) {
    const res = await fetch(`/api/me/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_public: !note.is_public }),
    });
    if (res.ok) {
      setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, is_public: note.is_public ? 0 : 1 } : n));
      onMutate && onMutate();
    }
  }

  async function remove(note) {
    if (!(await confirm({ title: '刪除筆記', message: '確定刪除這則筆記？', confirmText: '刪除', danger: true }))) return;
    const res = await fetch(`/api/me/notes/${note.id}`, { method: 'DELETE' });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      onMutate && onMutate();
    }
  }

  function startEdit(note) {
    setEditingId(note.id);
    setDraft(note.content || '');
    setEditError('');
  }
  function cancelEdit() {
    setEditingId(null);
    setDraft('');
    setEditError('');
  }
  async function saveEdit(note) {
    const text = draft.trim();
    if (!text) { setEditError('請輸入筆記內容'); return; }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/me/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(data.error || '儲存失敗');
      } else {
        setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, content: text } : n));
        cancelEdit();
        onMutate && onMutate();
      }
    } catch {
      setEditError('網路錯誤');
    }
    setSavingEdit(false);
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">我的修行心得</h2>
      <div className="space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="bg-gray-50 rounded-lg p-3">
            <div className="text-[11px] text-gray-400 mb-1">{n.log_date}</div>
            {editingId === n.id ? (
              <>
                <textarea
                  rows={4} maxLength={5000}
                  className="input-field text-sm"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                />
                {editError && <div className="text-[11px] text-red-600 mt-1">{editError}</div>}
                <div className="mt-2 flex justify-end gap-2">
                  <button onClick={cancelEdit} className="btn-secondary text-xs px-3 py-1">取消</button>
                  <button onClick={() => saveEdit(n)} disabled={savingEdit} className="btn-primary text-xs px-3 py-1">
                    {savingEdit ? '儲存中…' : '儲存'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm whitespace-pre-wrap break-words text-gray-800">{n.content}</div>
                <NoteAttachments image={n.image} linkUrl={n.link_url} />
                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                  <span>{n.is_public ? '🌐 已公開' : '🔒 私人'}</span>
                  <div className="flex gap-3">
                    <button onClick={() => startEdit(n)} className="text-blue-600">編輯</button>
                    <button onClick={() => togglePublic(n)} className="text-temple-red">
                      {n.is_public ? '改為私人' : '改為公開'}
                    </button>
                    <button onClick={() => remove(n)} className="text-red-500">刪除</button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        {notes.length === 0 && !loading && (
          <div className="text-center text-xs text-gray-400 py-2">尚無筆記</div>
        )}
        {hasMore && (
          <div ref={sentinelRef} className="text-center text-xs text-gray-400 py-3">
            {loading ? '載入中…' : '滾動以載入更多'}
          </div>
        )}
        {!hasMore && notes.length > 0 && (
          <div className="text-center text-[11px] text-gray-300 py-2">— 沒有更多了 —</div>
        )}
      </div>
    </div>
  );
}

// ── Public-share feed ───────────────────────────────────────────────────
function PublicNotesTab() {
  const [notes, setNotes] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch('/api/notes/public');
      const data = await res.json();
      if (cancelled) return;
      setNotes(data.notes || []);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function loadMore() {
    if (!cursor) return;
    const res = await fetch(`/api/notes/public?cursor=${cursor}`);
    const data = await res.json();
    setNotes((prev) => [...prev, ...(data.notes || [])]);
    setCursor(data.nextCursor);
    setHasMore(!!data.nextCursor);
  }

  return (
    <div className="p-4 space-y-3">
      {loading && <div className="text-center py-8 text-gray-400 text-sm">載入中…</div>}
      {!loading && notes.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">🪷</div>
          <p className="text-sm">尚無公開筆記</p>
        </div>
      )}
      {notes.map((n) => (
        <PublicNoteCard
          key={n.id}
          note={n}
          onMutate={(patch) => setNotes((prev) => prev.map((x) => x.id === n.id ? { ...x, ...patch } : x))}
        />
      ))}
      {hasMore && (
        <button onClick={loadMore} className="w-full btn-secondary text-sm">載入更多</button>
      )}
    </div>
  );
}

// ── Leaderboards (per practice) ─────────────────────────────────────────
function LeaderboardTab({ subscriptions, session }) {
  const [activePracticeId, setActivePracticeId] = useState(subscriptions[0]?.id || null);
  const [scope, setScope] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activePracticeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/leaderboard?practice_id=${activePracticeId}&scope=${scope}`);
      const d = await res.json();
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activePracticeId, scope]);

  if (subscriptions.length === 0) {
    return (
      <div className="p-4">
        <div className="card p-6 text-center text-gray-400">
          <p className="text-sm">尚未訂閱功課，無排名可看</p>
        </div>
      </div>
    );
  }

  const practice = data?.practice;

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        {subscriptions.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePracticeId(p.id)}
            className={`shrink-0 text-sm px-3 py-1.5 rounded-lg ${
              activePracticeId === p.id ? 'bg-temple-red text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setScope('all')}
          className={`flex-1 text-sm py-1.5 rounded-lg ${scope === 'all' ? 'bg-temple-red text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >全體</button>
        <button
          onClick={() => setScope('location')}
          className={`flex-1 text-sm py-1.5 rounded-lg ${scope === 'location' ? 'bg-temple-red text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >同道場</button>
      </div>

      {loading && <div className="text-center py-6 text-gray-400 text-sm">載入中…</div>}

      {!loading && data && (
        <>
          {data.message && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
              {data.message}
            </div>
          )}
          <div className="text-xs text-gray-400">
            近 {data.period?.days} 天累積量 ・ 共 {data.totalParticipants} 位參與
            {data.myRank ? ` ・ 您目前第 ${data.myRank} 名` : ''}
          </div>
          <div className="card divide-y divide-gray-100">
            {data.rows.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">尚無紀錄</div>
            )}
            {data.rows.map((row) => {
              const isMe = Number(row.member_id) === Number(session.sub);
              return (
                <div key={row.member_id} className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-red-50' : ''}`}>
                  <div className={`w-7 text-center text-sm font-bold ${row.rank <= 3 ? 'text-temple-red' : 'text-gray-400'}`}>
                    {row.rank}
                  </div>
                  {row.member_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.member_avatar} alt={row.member_name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-temple-red flex items-center justify-center text-white text-xs">
                      {row.member_name?.[0] || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {row.member_name}
                      {isMe && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-temple-red text-white">您</span>}
                    </div>
                    <div className="text-[11px] text-gray-400">{row.location_name || ''}</div>
                  </div>
                  <div className="text-sm font-medium text-temple-red">
                    {formatPracticeValue(row.total, practice?.type, practice?.unit_label)}
                  </div>
                </div>
              );
            })}
            {data.myRank && data.myRank > data.rows.length && (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-50">
                <div className="w-7 text-center text-sm font-bold text-temple-red">{data.myRank}</div>
                <div className="flex-1 text-sm text-gray-700">您（{session.name}）</div>
                <div className="text-sm font-medium text-temple-red">
                  {formatPracticeValue(data.myTotal, practice?.type, practice?.unit_label)}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


function NoteAttachments({ image, linkUrl }) {
  if (!image && !linkUrl) return null;
  return (
    <div className="mt-2 space-y-2">
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="w-full max-h-72 object-cover rounded-lg" />
      )}
      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-temple-red underline break-all"
        >🔗 {linkUrl}</a>
      )}
    </div>
  );
}

const REACTION_EMOJIS = ['🙏', '👍', '❤️', '😊', '🎉'];

function PublicNoteCard({ note, onMutate }) {
  const [reactions, setReactions] = useState(note.reactions || {});
  const [mine, setMine] = useState(new Set(note.my_reactions || []));
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);
  const [commentCount, setCommentCount] = useState(note.comment_count || 0);
  const [commentDraft, setCommentDraft] = useState('');
  const [posting, setPosting] = useState(false);

  async function toggle(emoji) {
    const res = await fetch(`/api/notes/public/${note.id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setReactions((r) => ({ ...r, [emoji]: data.count }));
    setMine((prev) => {
      const next = new Set(prev);
      if (data.mine) next.add(emoji); else next.delete(emoji);
      return next;
    });
  }

  async function loadComments() {
    const res = await fetch(`/api/notes/public/${note.id}/comments`);
    if (!res.ok) return;
    const data = await res.json();
    setComments(data.comments || []);
  }
  async function openComments() {
    if (!showComments && comments === null) await loadComments();
    setShowComments((v) => !v);
  }
  async function postComment(e) {
    e.preventDefault();
    const text = commentDraft.trim();
    if (!text || posting) return;
    setPosting(true);
    const res = await fetch(`/api/notes/public/${note.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) {
      setCommentDraft('');
      setCommentCount((c) => c + 1);
      await loadComments();
    }
    setPosting(false);
  }
  async function deleteComment(c) {
    const res = await fetch(`/api/notes/public/${note.id}/comments/${c.id}`, { method: 'DELETE' });
    if (res.ok) {
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      setCommentCount((n) => Math.max(0, n - 1));
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        {note.member_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={note.member_avatar} alt={note.member_name} className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-temple-red flex items-center justify-center text-white text-xs">
            {note.member_name?.[0] || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800">{note.member_name}</div>
          <div className="text-[11px] text-gray-400">{note.location_name || ''} ・ {note.log_date}</div>
        </div>
      </div>
      <div className="text-sm whitespace-pre-wrap break-words text-gray-700">{note.content}</div>
      <NoteAttachments image={note.image} linkUrl={note.link_url} />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {REACTION_EMOJIS.map((e) => {
          const count = reactions[e] || 0;
          const isMine = mine.has(e);
          return (
            <button
              key={e}
              type="button"
              onClick={() => toggle(e)}
              aria-label={`${isMine ? '取消' : ''}${e} 表情`}
              className={`text-sm px-2.5 py-1 rounded-full border transition-colors ${
                isMine
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {e} <span className="text-xs ml-0.5">{count || ''}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={openComments}
          aria-expanded={showComments}
          className="text-sm px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 ml-auto"
        >💬 {commentCount}</button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {comments === null && <div className="text-xs text-gray-400">載入中…</div>}
          {comments?.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              {c.member_avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.member_avatar} alt={c.member_name} className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-temple-red text-white text-[10px] flex items-center justify-center shrink-0">
                  {c.member_name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{c.member_name}</span>
                  <span className="ml-2 text-gray-400">{String(c.created_at).slice(0, 16).replace('T', ' ')}</span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">{c.content}</div>
              </div>
              {c.can_delete && (
                <button
                  type="button"
                  onClick={() => deleteComment(c)}
                  aria-label="刪除留言"
                  className="text-xs text-gray-400 hover:text-red-500"
                >刪除</button>
              )}
            </div>
          ))}
          <form onSubmit={postComment} className="flex gap-2 pt-1">
            <input
              type="text"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="留言…"
              maxLength={500}
              className="input-field text-sm flex-1"
            />
            <button type="submit" disabled={posting || !commentDraft.trim()} className="btn-primary text-xs px-3">
              {posting ? '送出中…' : '送出'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
