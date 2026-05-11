'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { defaultOptions, TYPE_LABELS, QUESTION_TYPES, formatAnswer } from '@/lib/attendance';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const TABS = [
  { key: 'questions', label: '題目設計' },
  { key: 'answers', label: '已登記名單' },
];

export default function AttendanceAdminClient({ eventId, initialQuestions, attendances }) {
  const [tab, setTab] = useState('questions');

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm px-3 py-1.5 rounded-lg ${
              tab === t.key ? 'bg-temple-red text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >{t.label}</button>
        ))}
      </div>
      {tab === 'questions' && <QuestionsEditor eventId={eventId} initial={initialQuestions} />}
      {tab === 'answers' && <AnswersList questions={initialQuestions} attendances={attendances} eventId={eventId} />}
    </div>
  );
}

// ── Questions editor ──────────────────────────────────────────────────
function QuestionsEditor({ eventId, initial }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [draftNew, setDraftNew] = useState({ label: '', type: 'text', options: defaultOptions('text'), required: false });
  const [editingId, setEditingId] = useState(null);
  const [draftEdit, setDraftEdit] = useState(null);
  const [error, setError] = useState('');

  async function createOne(e) {
    e.preventDefault();
    setError('');
    const res = await fetch(`/api/admin/events/${eventId}/attendance-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draftNew, sort_order: initial.length }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || '建立失敗'); return; }
    setAdding(false);
    setDraftNew({ label: '', type: 'text', options: defaultOptions('text'), required: false });
    router.refresh();
  }

  async function saveEdit() {
    setError('');
    const res = await fetch(`/api/admin/events/${eventId}/attendance-questions/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftEdit),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || '更新失敗'); return; }
    setEditingId(null);
    setDraftEdit(null);
    router.refresh();
  }

  async function remove(q) {
    if (!(await confirm({
      title: '刪除題目',
      message: `刪除題目「${q.label}」會清掉所有人的這題答案，確定？`,
      confirmText: '刪除',
      danger: true,
    }))) return;
    await fetch(`/api/admin/events/${eventId}/attendance-questions/${q.id}`, { method: 'DELETE' });
    router.refresh();
  }

  async function move(q, dir) {
    const idx = initial.findIndex((x) => x.id === q.id);
    const target = idx + dir;
    if (target < 0 || target >= initial.length) return;
    const other = initial[target];
    await Promise.all([
      fetch(`/api/admin/events/${eventId}/attendance-questions/${q.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: other.sort_order }),
      }),
      fetch(`/api/admin/events/${eventId}/attendance-questions/${other.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: q.sort_order }),
      }),
    ]);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {initial.length === 0 && !adding && (
        <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">
          尚未建立題目。點下方「新增題目」開始設計這場活動的登記表。
        </div>
      )}

      {initial.map((q, idx) => {
        if (editingId === q.id) {
          return (
            <div key={q.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <QuestionForm draft={draftEdit} setDraft={setDraftEdit} />
              {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setEditingId(null); setDraftEdit(null); }} className="btn-secondary flex-1 text-sm">取消</button>
                <button onClick={saveEdit} className="btn-primary flex-1 text-sm">儲存</button>
              </div>
            </div>
          );
        }
        return (
          <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-800">
                  {q.label}
                  {q.required ? <span className="ml-1 text-red-500">*</span> : null}
                  {!q.active && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-500">停用</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {TYPE_LABELS[q.type] || q.type} ・ <OptionsSummary q={q} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-sm">
                <button onClick={() => move(q, -1)} disabled={idx === 0} className="text-gray-500 disabled:text-gray-300">↑</button>
                <button onClick={() => move(q, +1)} disabled={idx === initial.length - 1} className="text-gray-500 disabled:text-gray-300">↓</button>
                <button onClick={() => { setEditingId(q.id); setDraftEdit({ label: q.label, type: q.type, options: q.options, required: !!q.required, active: q.active !== 0 }); }} className="text-blue-600">編輯</button>
                <button onClick={() => remove(q)} className="text-red-500">刪除</button>
              </div>
            </div>
          </div>
        );
      })}

      {adding ? (
        <form onSubmit={createOne} className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-3">新增題目</h3>
          <QuestionForm draft={draftNew} setDraft={setDraftNew} />
          {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => { setAdding(false); setError(''); }} className="btn-secondary flex-1 text-sm">取消</button>
            <button type="submit" className="btn-primary flex-1 text-sm">建立</button>
          </div>
        </form>
      ) : (
        <button onClick={() => { setError(''); setAdding(true); }} className="btn-primary">+ 新增題目</button>
      )}
    </div>
  );
}

function OptionsSummary({ q }) {
  const o = q.options || {};
  switch (q.type) {
    case 'text': return <>長度上限 {o.maxLength || 200}</>;
    case 'choice': return <>選項：{(o.choices || []).join('、')}{o.allow_text ? ` ・ 含自訂文字（${o.text_label || ''}）` : ''}</>;
    case 'multi_date': return <>選項：{(o.dates || []).join('、')}</>;
    case 'count': return <>範圍：{o.min ?? 0}~{o.max ?? 99}</>;
    case 'checkbox': return <>勾選即代表「是」</>;
    default: return null;
  }
}

function QuestionForm({ draft, setDraft }) {
  if (!draft) return null;
  function setOpts(patch) {
    setDraft((d) => ({ ...d, options: { ...d.options, ...patch } }));
  }
  function setType(type) {
    setDraft((d) => ({ ...d, type, options: defaultOptions(type) }));
  }
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">題目 *</label>
        <input type="text" required className="input-field text-sm"
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">題型 *</label>
          <select className="input-field text-sm" value={draft.type} onChange={(e) => setType(e.target.value)}>
            {QUESTION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-1">
          <input type="checkbox" checked={!!draft.required} onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))} />
          必填
        </label>
      </div>
      {draft.type === 'text' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">長度上限</label>
          <input type="number" className="input-field text-sm"
            value={draft.options.maxLength ?? 200}
            onChange={(e) => setOpts({ maxLength: parseInt(e.target.value) || 0 })} />
        </div>
      )}
      {draft.type === 'choice' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">選項（每行一個）</label>
          <textarea rows={4} className="input-field text-sm"
            value={(draft.options.choices || []).join('\n')}
            onChange={(e) => setOpts({ choices: e.target.value.split('\n') })} />
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-2">
            <input type="checkbox" checked={!!draft.options.allow_text}
              onChange={(e) => setOpts({ allow_text: e.target.checked })} />
            另加自訂文字欄位
          </label>
          {draft.options.allow_text && (
            <input type="text" className="input-field text-sm mt-1" placeholder="文字欄位標籤（例：車號）"
              value={draft.options.text_label || ''}
              onChange={(e) => setOpts({ text_label: e.target.value })} />
          )}
        </div>
      )}
      {draft.type === 'multi_date' && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">選項清單（每行一個，可填日期或自訂文字）</label>
          <textarea rows={5} className="input-field text-sm"
            placeholder={'例如：\n2026-08-23\n2026-08-24\n或：\n下午茶時段\n夜間共修'}
            value={(draft.options.dates || []).join('\n')}
            onChange={(e) => setOpts({ dates: e.target.value.split('\n') })} />
        </div>
      )}
      {draft.type === 'count' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">最小值</label>
            <input type="number" className="input-field text-sm"
              value={draft.options.min ?? 0}
              onChange={(e) => setOpts({ min: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">最大值</label>
            <input type="number" className="input-field text-sm"
              value={draft.options.max ?? 99}
              onChange={(e) => setOpts({ max: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Answers list ──────────────────────────────────────────────────────
function AnswersList({ questions, attendances, eventId }) {
  if (attendances.length === 0) {
    return <div className="bg-white rounded-xl p-6 text-center text-gray-400 text-sm">目前無人登記</div>;
  }
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs">
          <tr>
            <th className="px-3 py-2 text-left">師兄姐</th>
            <th className="px-3 py-2 text-left">登記對象</th>
            <th className="px-3 py-2 text-left">關係</th>
            <th className="px-3 py-2 text-left">道場</th>
            <th className="px-3 py-2 text-left">電話</th>
            {questions.map((q) => (
              <th key={q.id} className="px-3 py-2 text-left whitespace-nowrap">{q.label}</th>
            ))}
            <th className="px-3 py-2 text-left">備註</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">提交時間</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {attendances.map((a) => (
            <tr key={a.id}>
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{a.member_name}</td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                {a.attendee_name ? a.attendee_name : <span className="text-gray-400">本人</span>}
              </td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.attendee_relation || ''}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.location_name || ''}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.member_phone || ''}</td>
              {questions.map((q) => (
                <td key={q.id} className="px-3 py-2 text-gray-700 align-top">{formatAnswer(q, a.answers?.[q.id])}</td>
              ))}
              <td className="px-3 py-2 text-gray-500 align-top">{a.notes || ''}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap align-top">
                {String(a.updated_at || a.created_at).slice(0, 16).replace('T', ' ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
