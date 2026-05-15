'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function StaffViewClient({ event, type, qfRows, attendanceRows, attendanceQuestions }) {
  const router = useRouter();
  const pathname = usePathname();

  function pickType(next) {
    const params = new URLSearchParams();
    if (next) params.set('type', next);
    router.push(`${pathname}${params.toString() ? `?${params}` : ''}`);
  }

  const exportHref = `/api/me/events/${event.id}/export?type=${type}`;
  const count = type === 'qf' ? (qfRows?.length || 0) : (attendanceRows?.length || 0);

  return (
    <div>
      <div className="page-header" style={{ backgroundColor: event.banner_color || '#8B1A1A' }}>
        <Link
          href={`/events/${event.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-white bg-black/25 hover:bg-black/40 transition-colors rounded-full px-3 py-1.5 mb-2"
          aria-label="返回活動詳情"
        >
          <span aria-hidden="true">←</span> 回活動
        </Link>
        <h1 className="text-lg font-bold">{event.name} ・ 工作人員視角</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => pickType('qf')}
            className={`flex-1 text-sm py-2 px-3 rounded-lg border transition-colors ${
              type === 'qf'
                ? 'bg-temple-red text-white border-temple-red'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >祈福報名</button>
          <button
            type="button"
            onClick={() => pickType('attendance')}
            className={`flex-1 text-sm py-2 px-3 rounded-lg border transition-colors ${
              type === 'attendance'
                ? 'bg-temple-red text-white border-temple-red'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >活動報名</button>
        </div>

        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-sm text-gray-700">
            符合條件：<strong className="text-temple-red ml-1">{count}</strong>
            <span className="ml-1 text-gray-600">{type === 'qf' ? '筆報名' : '筆登記'}</span>
          </div>
          {count > 0 && (
            <a href={exportHref} className="btn-primary text-sm px-3 py-1.5">📥 下載 Excel</a>
          )}
        </div>

        <p className="text-[11px] text-gray-400 px-1">
          ⓘ 工作人員視角不顯示金額與收據編號等財務資訊。
        </p>

        {type === 'qf' && <QfTable rows={qfRows || []} />}
        {type === 'attendance' && (
          <AttendanceTable rows={attendanceRows || []} questions={attendanceQuestions || []} />
        )}
      </div>
    </div>
  );
}

function QfTable({ rows }) {
  if (rows.length === 0) {
    return <div className="card p-6 text-center text-gray-400 text-sm">尚無祈福報名</div>;
  }
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs">
          <tr>
            <th className="px-3 py-2 text-left">師兄姐</th>
            <th className="px-3 py-2 text-left">道場</th>
            <th className="px-3 py-2 text-left">電話</th>
            <th className="px-3 py-2 text-left">項目（功德主 / 超度內容）</th>
            <th className="px-3 py-2 text-left">繳款</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const items = r.items.length > 0 ? r.items : [null];
            const span = items.length;
            return items.map((it, idx) => (
              <tr key={`${r.id}-${idx}`}>
                {idx === 0 && <td rowSpan={span} className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap align-top border-t border-gray-100">{r.member_name}</td>}
                {idx === 0 && <td rowSpan={span} className="px-3 py-2 text-gray-600 whitespace-nowrap align-top border-t border-gray-100">{r.location_name || ''}</td>}
                {idx === 0 && <td rowSpan={span} className="px-3 py-2 text-gray-600 whitespace-nowrap align-top border-t border-gray-100">{r.member_phone || ''}</td>}
                <td className="px-3 py-2 text-gray-700 align-top">
                  {it ? (
                    <div className="text-xs">
                      {it.item_name} × {it.quantity}
                      {it.is_gift ? <span className="text-temple-gold ml-1">（贈品）</span> : null}
                      {it.names_arr.length > 0 && (
                        <span className="text-gray-400 ml-1">（{it.names_arr.join('、')}）</span>
                      )}
                      {it.contents_arr.some((c) => c && c.trim()) && (
                        <div className="pl-3 text-[11px] text-gray-500 mt-0.5">
                          超渡：{it.contents_arr.filter((c) => c && c.trim()).join('；')}
                        </div>
                      )}
                    </div>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
                {idx === 0 && (
                  <td rowSpan={span} className="px-3 py-2 whitespace-nowrap align-top border-t border-gray-100">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.payment_status === 'paid' ? 'badge-paid' : 'badge-unpaid'}`}>
                      {r.payment_status === 'paid' ? '已繳款' : '未繳款'}
                    </span>
                  </td>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceTable({ rows, questions }) {
  if (rows.length === 0) {
    return <div className="card p-6 text-center text-gray-400 text-sm">尚無活動報名</div>;
  }
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs">
          <tr>
            <th className="px-3 py-2 text-left whitespace-nowrap">師兄姐</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">登記對象</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">關係</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">道場</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">電話</th>
            {questions.map((q) => (
              <th key={q.id} className="px-3 py-2 text-left whitespace-nowrap">{q.label}</th>
            ))}
            <th className="px-3 py-2 text-left">備註</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((a) => {
            const ansMap = Object.fromEntries((a.answers_pretty || []).map((x) => [x.label, x.text]));
            return (
              <tr key={a.id}>
                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{a.member_name}</td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                  {a.attendee_name || <span className="text-gray-400">本人</span>}
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.attendee_relation || ''}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.location_name || ''}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.member_phone || ''}</td>
                {questions.map((q) => (
                  <td key={q.id} className="px-3 py-2 text-gray-700 align-top">{ansMap[q.label] || ''}</td>
                ))}
                <td className="px-3 py-2 text-gray-500">{a.notes || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
