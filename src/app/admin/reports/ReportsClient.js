'use client';
import { useRouter, usePathname } from 'next/navigation';
import { formatMoney, getPaymentStatusLabel } from '@/lib/utils';

export default function ReportsClient({
  events, groups,
  eventId, type, groupIds,
  qfRows, attendanceRows, attendanceQuestions,
}) {
  const router = useRouter();
  const pathname = usePathname();

  function pushFilters(next) {
    const merged = {
      event_id: next.event_id !== undefined ? next.event_id : eventId,
      type: next.type !== undefined ? next.type : type,
      group_ids: next.group_ids !== undefined ? next.group_ids : groupIds,
    };
    const params = new URLSearchParams();
    if (merged.event_id) params.set('event_id', String(merged.event_id));
    if (merged.type) params.set('type', merged.type);
    if (merged.group_ids && merged.group_ids.length > 0) {
      params.set('group_ids', merged.group_ids.join(','));
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleGroup(id) {
    const next = groupIds.includes(id)
      ? groupIds.filter((g) => g !== id)
      : [...groupIds, id];
    pushFilters({ group_ids: next });
  }
  function clearGroups() {
    if (groupIds.length === 0) return;
    pushFilters({ group_ids: [] });
  }

  // Build Excel link for the active filter set.
  let excelHref = null;
  let excelLabel = null;
  if (eventId && type === 'qf') {
    const p = new URLSearchParams({ format: 'xlsx', eventId: String(eventId) });
    if (groupIds.length > 0) p.set('group_ids', groupIds.join(','));
    excelHref = `/api/reports?${p.toString()}`;
    excelLabel = '📥 下載祈福報名 Excel';
  } else if (eventId && type === 'attendance') {
    const p = new URLSearchParams();
    if (groupIds.length > 0) p.set('group_ids', groupIds.join(','));
    const qs = p.toString();
    excelHref = `/api/admin/events/${eventId}/attendance/export${qs ? `?${qs}` : ''}`;
    excelLabel = '📥 下載活動報名 Excel';
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Event */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">① 法會活動</label>
        <select
          className="input-field"
          value={eventId || ''}
          onChange={(e) => {
            const v = e.target.value ? parseInt(e.target.value) : null;
            pushFilters({ event_id: v });
          }}
        >
          <option value="">— 請選擇法會活動 —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>

      {/* Step 2: Type */}
      {eventId && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">② 報名類型</label>
          <div className="flex gap-2">
            <TypeButton active={type === 'qf'} onClick={() => pushFilters({ type: 'qf' })}>
              祈福報名（功德主 / 蓮位）
            </TypeButton>
            <TypeButton active={type === 'attendance'} onClick={() => pushFilters({ type: 'attendance' })}>
              活動報名（用餐 / 禪修 / 朝山）
            </TypeButton>
          </div>
        </div>
      )}

      {/* Step 3: Group filter */}
      {eventId && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">③ 群組標籤篩選（選擇性，多選=任一）</label>
            {groupIds.length > 0 && (
              <button onClick={clearGroups} type="button" className="text-xs text-gray-500 hover:text-temple-red">
                清除
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const checked = groupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    checked
                      ? 'text-white border-transparent'
                      : 'text-gray-600 bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                  style={checked ? { backgroundColor: g.color || '#8B1A1A' } : {}}
                >
                  {g.location_id != null ? `🏯 ${g.name}` : g.name}
                </button>
              );
            })}
            {groups.length === 0 && (
              <span className="text-xs text-gray-400">尚無群組可篩選</span>
            )}
          </div>
        </div>
      )}

      {/* Excel + count */}
      {eventId && excelHref && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="text-sm text-gray-700">
            符合條件：
            <strong className="text-temple-red ml-1">
              {type === 'qf' ? (qfRows?.length || 0) : (attendanceRows?.length || 0)}
            </strong>
            <span className="ml-1">{type === 'qf' ? ' 筆報名' : ' 筆登記'}</span>
          </div>
          <a href={excelHref} className="btn-primary text-sm px-4 py-2">{excelLabel}</a>
        </div>
      )}

      {/* List */}
      {!eventId && (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
          請先選擇法會活動
        </div>
      )}
      {eventId && type === 'qf' && (
        <QfList rows={qfRows || []} />
      )}
      {eventId && type === 'attendance' && (
        <AttendanceList rows={attendanceRows || []} questions={attendanceQuestions || []} />
      )}
    </div>
  );
}

function TypeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-sm py-2 px-3 rounded-lg border transition-colors ${
        active
          ? 'bg-temple-red text-white border-temple-red'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function QfList({ rows }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
        無符合條件的祈福報名
      </div>
    );
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
            <th className="px-3 py-2 text-right whitespace-nowrap">金額</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">繳款</th>
            <th className="px-3 py-2 text-left whitespace-nowrap">收據</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const items = r.items.length > 0 ? r.items : [null]; // ensure at least one row
            const span = items.length;
            return items.map((it, idx) => (
              <tr key={`${r.id}-${idx}`} className={idx > 0 ? 'border-t-0' : ''}>
                {idx === 0 && (
                  <td rowSpan={span} className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap align-top border-t border-gray-100">
                    {r.member_name}
                  </td>
                )}
                {idx === 0 && (
                  <td rowSpan={span} className="px-3 py-2 text-gray-600 whitespace-nowrap align-top border-t border-gray-100">
                    {r.location_name || ''}
                  </td>
                )}
                {idx === 0 && (
                  <td rowSpan={span} className="px-3 py-2 text-gray-600 whitespace-nowrap align-top border-t border-gray-100">
                    {r.member_phone || ''}
                  </td>
                )}
                <td className="px-3 py-2 text-gray-700 align-top">
                  {it ? (
                    <div className="text-xs">
                      {it.item_name} × {it.quantity}
                      {it.is_gift && <span className="text-temple-gold ml-1">（贈品）</span>}
                      {it.names_arr.length > 0 && (
                        <span className="text-gray-400 ml-1">（{it.names_arr.join('、')}）</span>
                      )}
                      {it.contents_arr.some((c) => c && c.trim()) && (
                        <div className="pl-3 text-[11px] text-gray-500 mt-0.5">
                          超渡：{it.contents_arr.filter((c) => c && c.trim()).join('；')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap align-top text-temple-red text-xs">
                  {it ? formatMoney(it.subtotal || 0) : ''}
                </td>
                {idx === 0 && (
                  <td rowSpan={span} className="px-3 py-2 whitespace-nowrap align-top border-t border-gray-100">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.payment_status === 'paid' ? 'badge-paid' : 'badge-unpaid'
                    }`}>
                      {getPaymentStatusLabel(r.payment_status)}
                    </span>
                    <div className="text-[11px] text-gray-400 mt-1">
                      合計 {formatMoney(r.total_amount)}
                    </div>
                  </td>
                )}
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap align-top">
                  {it ? (it.receipt_number || r.receipt_number || '—') : (r.receipt_number || '—')}
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceList({ rows, questions }) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
        無符合條件的活動報名
      </div>
    );
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
                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap align-top">{a.member_name}</td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap align-top">
                  {a.attendee_name || <span className="text-gray-400">本人</span>}
                </td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap align-top">{a.attendee_relation || ''}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap align-top">{a.location_name || ''}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap align-top">{a.member_phone || ''}</td>
                {questions.map((q) => (
                  <td key={q.id} className="px-3 py-2 text-gray-700 align-top">{ansMap[q.label] || ''}</td>
                ))}
                <td className="px-3 py-2 text-gray-500 align-top">{a.notes || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
