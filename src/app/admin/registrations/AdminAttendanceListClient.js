'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function AdminAttendanceListClient({ rows, events, initialFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState(initialFilters);

  function applyFilters(next) {
    const f = { ...filters, ...next };
    setFilters(f);
    const params = new URLSearchParams({ type: 'attendance' });
    if (f.eventId) params.set('eventId', f.eventId);
    if (f.search) params.set('search', f.search);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">法會活動</label>
            <select
              className="input-field text-sm"
              value={filters.eventId}
              onChange={(e) => applyFilters({ eventId: e.target.value })}
            >
              <option value="">全部活動</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">搜尋</label>
            <input
              type="text"
              className="input-field text-sm"
              placeholder="師兄姐姓名 / 電話 / 親友姓名"
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') applyFilters({ search: e.target.value }); }}
              onBlur={(e) => applyFilters({ search: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          顯示最近 300 筆活動報名（本人/親友）。完整名單與各題答案請進「活動名單」頁。
        </p>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">
          目前無活動報名資料
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs">
              <tr>
                <th className="px-3 py-2 text-left whitespace-nowrap">活動</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">師兄姐</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">登記對象</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">關係</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">道場</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">電話</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">提交時間</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{a.event_name}</td>
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{a.member_name}</td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                    {a.attendee_name || <span className="text-gray-400">本人</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.attendee_relation || ''}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.location_name || ''}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{a.member_phone || ''}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                    {String(a.updated_at || a.created_at).slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/events/${a.event_id}/attendance`}
                      className="text-temple-red text-xs hover:underline"
                    >進入活動名單 →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
