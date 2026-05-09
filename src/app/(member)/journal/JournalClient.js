'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Heatmap from '@/components/journal/Heatmap';
import LogInput from '@/components/journal/LogInput';
import { formatPracticeValue, minutesToDurationString } from '@/lib/practices';

const TABS = [
  { key: 'log', label: '修行日誌' },
  { key: 'public', label: '大眾分享' },
  { key: 'leaderboard', label: '排名' },
];

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
        body: JSON.stringify({ log_date: date, content: newNote, is_public: newNotePublic }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNoteError(data.error || '儲存失敗');
      } else {
        setNewNote('');
        setNewNotePublic(false);
        router.refresh();
        setNotesVersion((v) => v + 1);
      }
    } catch {
      setNoteError('網路錯誤');
    }
    setNoteSaving(false);
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
    if (!confirm('確定刪除這則筆記？')) return;
    const res = await fetch(`/api/me/notes/${note.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
      setNotesVersion((v) => v + 1);
    }
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
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={newNotePublic}
                    onChange={(e) => setNewNotePublic(e.target.checked)}
                  />
                  公開分享
                </label>
                <button type="submit" disabled={noteSaving || !newNote.trim()} className="btn-primary text-sm">
                  {noteSaving ? '儲存中…' : '新增筆記'}
                </button>
              </div>
              {noteError && <div className="text-sm text-red-600">{noteError}</div>}
            </form>
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm whitespace-pre-wrap break-words text-gray-800">{n.content}</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{n.is_public ? '🌐 已公開' : '🔒 私人'}</span>
                    <div className="flex gap-3">
                      <button onClick={() => toggleNotePublic(n)} className="text-temple-red">
                        {n.is_public ? '改為私人' : '改為公開'}
                      </button>
                      <button onClick={() => deleteNote(n)} className="text-red-500">刪除</button>
                    </div>
                  </div>
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
  );
}

// ── My notes (paginated, infinite-scroll) ──────────────────────────────
function MyNotesSection({ version, onMutate }) {
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
    if (!confirm('確定刪除這則筆記？')) return;
    const res = await fetch(`/api/me/notes/${note.id}`, { method: 'DELETE' });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      onMutate && onMutate();
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">我的修行心得</h2>
      <div className="space-y-2">
        {notes.map((n) => (
          <div key={n.id} className="bg-gray-50 rounded-lg p-3">
            <div className="text-[11px] text-gray-400 mb-1">{n.log_date}</div>
            <div className="text-sm whitespace-pre-wrap break-words text-gray-800">{n.content}</div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>{n.is_public ? '🌐 已公開' : '🔒 私人'}</span>
              <div className="flex gap-3">
                <button onClick={() => togglePublic(n)} className="text-temple-red">
                  {n.is_public ? '改為私人' : '改為公開'}
                </button>
                <button onClick={() => remove(n)} className="text-red-500">刪除</button>
              </div>
            </div>
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
        <div key={n.id} className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            {n.member_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={n.member_avatar} alt={n.member_name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-temple-red flex items-center justify-center text-white text-xs">
                {n.member_name?.[0] || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800">{n.member_name}</div>
              <div className="text-[11px] text-gray-400">{n.location_name || ''} ・ {n.log_date}</div>
            </div>
          </div>
          <div className="text-sm whitespace-pre-wrap break-words text-gray-700">{n.content}</div>
        </div>
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
