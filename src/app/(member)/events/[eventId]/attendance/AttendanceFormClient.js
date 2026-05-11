'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AttendanceFormClient({ event, questions, entries, relations }) {
  const router = useRouter();
  const selfEntry = entries.find((e) => !e.attendee_name) || null;
  const friendEntries = entries.filter((e) => !!e.attendee_name);

  // editing: null (list view) | {kind:'self'|'friend', id?:number}
  const [editing, setEditing] = useState(null);

  function startNewSelf() { setEditing({ kind: 'self', id: null }); }
  function startNewFriend() { setEditing({ kind: 'friend', id: null }); }
  function startEdit(entry) {
    setEditing({ kind: entry.attendee_name ? 'friend' : 'self', id: entry.id });
  }
  function done() { setEditing(null); router.refresh(); }

  return (
    <div>
      <div className="page-header" style={{ backgroundColor: event.banner_color || '#8B1A1A' }}>
        <Link href={`/events/${event.id}`} className="text-red-200 text-xs">← 回活動</Link>
        <h1 className="text-lg font-bold mt-1">{event.name} ・ 活動登記</h1>
      </div>

      {questions.length === 0 ? (
        <div className="p-4">
          <div className="card p-6 text-center text-gray-400 text-sm">
            主辦單位尚未設定登記題目
          </div>
        </div>
      ) : editing ? (
        <EntryForm
          event={event}
          questions={questions}
          relations={relations}
          editing={editing}
          existing={
            editing.id
              ? entries.find((e) => e.id === editing.id)
              : null
          }
          onCancel={() => setEditing(null)}
          onDone={done}
        />
      ) : (
        <div className="p-4 space-y-4">
          {/* 本人 */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-sm text-gray-800">本人登記</div>
              {selfEntry && (
                <button onClick={() => startEdit(selfEntry)} className="text-blue-600 text-xs">編輯</button>
              )}
            </div>
            {selfEntry ? (
              <>
                <Summary questions={questions} entry={selfEntry} />
                <div className="mt-3 flex justify-end">
                  <CancelButton
                    eventId={event.id} entryId={selfEntry.id}
                    label="取消我的登記" onDone={done}
                  />
                </div>
              </>
            ) : (
              <button onClick={startNewSelf} className="btn-primary w-full text-sm">我要登記</button>
            )}
          </div>

          {/* 親友 */}
          {friendEntries.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500 px-1">親友登記</div>
              {friendEntries.map((e) => (
                <div key={e.id} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm text-gray-800">
                      {e.attendee_name}
                      {e.attendee_relation && (
                        <span className="ml-1 text-[11px] text-gray-500">（{e.attendee_relation}）</span>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs">
                      <button onClick={() => startEdit(e)} className="text-blue-600">編輯</button>
                      <CancelButton
                        eventId={event.id} entryId={e.id} label="刪除" onDone={done} compact
                      />
                    </div>
                  </div>
                  <Summary questions={questions} entry={e} />
                </div>
              ))}
            </div>
          )}

          <button onClick={startNewFriend} className="btn-secondary w-full text-sm">
            + 新增親友登記
          </button>
        </div>
      )}
    </div>
  );
}

function CancelButton({ eventId, entryId, label, onDone, compact }) {
  const [busy, setBusy] = useState(false);
  async function handle() {
    if (!confirm(`確定${label}？`)) return;
    setBusy(true);
    const res = await fetch(`/api/me/attendance/${eventId}/${entryId}`, { method: 'DELETE' });
    if (res.ok) onDone();
    else setBusy(false);
  }
  return (
    <button
      onClick={handle} disabled={busy}
      className={compact ? 'text-red-600' : 'btn-secondary text-red-600 border-red-200 text-sm'}
    >
      {busy ? '處理中…' : label}
    </button>
  );
}

function Summary({ questions, entry }) {
  const rows = questions.map((q) => {
    const v = entry.answers?.[q.id];
    return { q, text: summaryText(q, v) };
  }).filter((r) => r.text);
  if (rows.length === 0 && !entry.notes) {
    return <div className="text-xs text-gray-400">尚未填寫任何內容</div>;
  }
  return (
    <div className="space-y-1.5 text-xs text-gray-600">
      {rows.map(({ q, text }) => (
        <div key={q.id} className="flex gap-2">
          <span className="text-gray-400 shrink-0">{q.label}：</span>
          <span className="flex-1 break-words">{text}</span>
        </div>
      ))}
      {entry.notes && (
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <span className="text-gray-400 shrink-0">備註：</span>
          <span className="flex-1 break-words">{entry.notes}</span>
        </div>
      )}
    </div>
  );
}

function summaryText(q, v) {
  if (v == null) return '';
  switch (q.type) {
    case 'text': return v.text || '';
    case 'choice':
      if (!v.choice) return '';
      return v.text ? `${v.choice}（${v.text}）` : v.choice;
    case 'multi_date': {
      const arr = Array.isArray(v.dates) ? v.dates : [];
      return arr.join('、');
    }
    case 'count':
      return v.count === '' || v.count == null ? '' : String(v.count);
    case 'checkbox': return v.checked ? '參加' : '';
    default: return '';
  }
}

function EntryForm({ event, questions, relations, editing, existing, onCancel, onDone }) {
  const isFriend = editing.kind === 'friend';
  const [attendeeName, setAttendeeName] = useState(existing?.attendee_name || '');
  const [attendeeRelation, setAttendeeRelation] = useState(existing?.attendee_relation || (isFriend ? relations[0] : ''));
  const [answers, setAnswers] = useState(existing?.answers || {});
  const [notes, setNotes] = useState(existing?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(qid, patch) {
    setAnswers((prev) => ({ ...prev, [qid]: { ...(prev[qid] || {}), ...patch } }));
  }
  function setValue(qid, value) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (isFriend && !attendeeName.trim()) {
      setError('請填寫親友姓名');
      return;
    }
    setSaving(true);
    const payload = {
      attendee_name: isFriend ? attendeeName.trim() : null,
      attendee_relation: isFriend ? attendeeRelation : null,
      answers,
      notes,
    };
    try {
      const url = existing
        ? `/api/me/attendance/${event.id}/${existing.id}`
        : `/api/me/attendance/${event.id}`;
      const res = await fetch(url, {
        method: existing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '儲存失敗');
        setSaving(false);
        return;
      }
      onDone();
    } catch {
      setError('網路錯誤');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div className="card p-4">
        <div className="font-medium text-sm text-gray-800 mb-2">
          {isFriend ? (existing ? '編輯親友登記' : '新增親友登記') : (existing ? '編輯本人登記' : '本人登記')}
        </div>
        {isFriend && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">姓名 *</label>
              <input
                type="text" className="input-field text-sm"
                value={attendeeName} maxLength={100}
                onChange={(e) => setAttendeeName(e.target.value)}
                placeholder="親友姓名"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">關係 *</label>
              <select
                className="input-field text-sm"
                value={attendeeRelation}
                onChange={(e) => setAttendeeRelation(e.target.value)}
              >
                {relations.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {questions.map((q) => (
        <div key={q.id} className="card p-4">
          <div className="text-sm font-medium text-gray-800 mb-2">
            {q.label}
            {q.required ? <span className="ml-1 text-red-500">*</span> : null}
          </div>
          <QuestionInput
            q={q}
            value={answers[q.id]}
            onUpdate={(patch) => update(q.id, patch)}
            onSetValue={(v) => setValue(q.id, v)}
          />
        </div>
      ))}

      <div className="card p-4">
        <label className="block text-sm font-medium text-gray-800 mb-2">備註</label>
        <textarea rows={3} className="input-field text-sm"
          placeholder="有其他需要告知主辦的事項可在這裡填寫"
          value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary">取消</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? '儲存中…' : (existing ? '更新' : '送出登記')}
        </button>
      </div>
    </form>
  );
}

function QuestionInput({ q, value, onUpdate, onSetValue }) {
  const v = value || {};
  switch (q.type) {
    case 'text':
      return (
        <input
          type="text" className="input-field text-sm"
          maxLength={q.options.maxLength || 200}
          value={v.text || ''}
          onChange={(e) => onSetValue({ text: e.target.value })}
        />
      );
    case 'choice': {
      const choices = q.options.choices || [];
      const allowText = !!q.options.allow_text;
      return (
        <div className="space-y-1.5">
          {choices.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name={`q${q.id}`}
                checked={v.choice === c}
                onChange={() => onUpdate({ choice: c })}
              />
              {c}
            </label>
          ))}
          {allowText && (
            <input
              type="text"
              className="input-field text-sm mt-1"
              placeholder={q.options.text_label || '其他/補充'}
              value={v.text || ''}
              onChange={(e) => onUpdate({ text: e.target.value })}
            />
          )}
        </div>
      );
    }
    case 'multi_date': {
      const dates = q.options.dates || [];
      const checked = new Set(v.dates || []);
      return (
        <div className="grid grid-cols-2 gap-1.5">
          {dates.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={checked.has(d)}
                onChange={(e) => {
                  const next = new Set(checked);
                  if (e.target.checked) next.add(d); else next.delete(d);
                  onSetValue({ dates: [...next].sort() });
                }}
              />
              {d}
            </label>
          ))}
        </div>
      );
    }
    case 'count':
      return (
        <input
          type="number" inputMode="numeric"
          min={q.options.min ?? 0}
          max={q.options.max ?? 99}
          className="input-field text-sm w-32"
          value={v.count ?? ''}
          onChange={(e) => onSetValue({ count: e.target.value === '' ? '' : parseInt(e.target.value) })}
        />
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!!v.checked}
            onChange={(e) => onSetValue({ checked: e.target.checked })}
          />
          參加
        </label>
      );
    default:
      return null;
  }
}
