'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AttendanceFormClient({ event, questions, attendance, initialAnswers, initialNotes }) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialAnswers || {});
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
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
    setMessage('');
    setSaving(true);
    try {
      const res = await fetch(`/api/me/attendance/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, notes }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || '儲存失敗');
      else {
        setMessage('已儲存');
        setTimeout(() => router.push(`/events/${event.id}`), 800);
      }
    } catch { setError('網路錯誤'); }
    setSaving(false);
  }

  async function handleClear() {
    if (!attendance) return;
    if (!confirm('確定取消活動登記？已填寫的內容會清空。')) return;
    const res = await fetch(`/api/me/attendance/${event.id}`, { method: 'DELETE' });
    if (res.ok) router.push(`/events/${event.id}`);
  }

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
      ) : (
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
          {message && <div className="text-sm text-green-700 text-center">{message}</div>}

          <div className="flex gap-2">
            {attendance && (
              <button type="button" onClick={handleClear} className="btn-secondary text-red-600 border-red-200">
                取消登記
              </button>
            )}
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? '儲存中…' : (attendance ? '更新登記' : '送出登記')}
            </button>
          </div>
        </form>
      )}
    </div>
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
