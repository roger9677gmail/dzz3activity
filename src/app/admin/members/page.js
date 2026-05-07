import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminMembersPage({ searchParams }) {
  const session = await getSession(true);
  if (!session) redirect('/admin/login');

  const eventId = searchParams.eventId || '';
  const mode = searchParams.mode || 'all'; // 'all' | 'unregistered'
  const search = searchParams.search || '';

  const events = await db.prepare("SELECT id, name FROM events WHERE status='active' ORDER BY start_date").all();

  let members;
  if (mode === 'unregistered' && eventId) {
    members = await db.prepare(`
      SELECT m.id, m.name, m.phone, m.email, m.created_at
      FROM members m
      WHERE m.role = 'member'
        AND m.id NOT IN (
          SELECT r.member_id FROM registrations r
          WHERE r.event_id = ? AND r.status != 'cancelled'
        )
        ${search ? "AND (m.name LIKE ? OR m.phone LIKE ?)" : ""}
      ORDER BY m.name
    `).all(...[eventId, ...(search ? [`%${search}%`, `%${search}%`] : [])]);
  } else {
    members = await db.prepare(`
      SELECT m.id, m.name, m.phone, m.email, m.created_at,
        (SELECT COUNT(*) FROM registrations r WHERE r.member_id = m.id AND r.status != 'cancelled') as reg_count
      FROM members m
      WHERE m.role = 'member'
        ${search ? "AND (m.name LIKE ? OR m.phone LIKE ?)" : ""}
      ORDER BY m.name
    `).all(...(search ? [`%${search}%`, `%${search}%`] : []));
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">師兄姐管理</h1>
        <span className="text-sm text-gray-500">{members.length} 位</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-3">
        <div className="flex gap-2">
          <Link href="?mode=all"
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${mode === 'all' ? 'bg-temple-red text-white' : 'bg-gray-100 text-gray-600'}`}>
            全部師兄姐
          </Link>
          <Link href="?mode=unregistered"
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${mode === 'unregistered' ? 'bg-temple-red text-white' : 'bg-gray-100 text-gray-600'}`}>
            未報名名單
          </Link>
        </div>

        {mode === 'unregistered' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">選擇法會活動</label>
            <div className="flex gap-2 flex-wrap">
              {events.map((ev) => (
                <Link key={ev.id} href={`?mode=unregistered&eventId=${ev.id}`}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${
                    eventId === String(ev.id) ? 'bg-temple-red text-white border-temple-red' : 'border-gray-200 text-gray-600 hover:border-temple-red'
                  }`}>
                  {ev.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <form>
          <input type="hidden" name="mode" value={mode} />
          {eventId && <input type="hidden" name="eventId" value={eventId} />}
          <input type="text" name="search" defaultValue={search} className="input-field text-sm"
            placeholder="搜尋姓名或電話..." />
        </form>
      </div>

      {mode === 'unregistered' && !eventId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700 mb-4">
          請選擇一個法會活動，以查看未報名的師兄姐名單
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {members.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            {mode === 'unregistered' ? '所有師兄姐均已報名此活動 🎉' : '無師兄姐資料'}
          </div>
        )}
        <div className="divide-y divide-gray-100">
          {members.map((m, idx) => (
            <div key={m.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-400 mr-2">{idx + 1}.</span>
                <span className="font-medium text-gray-800">{m.name}</span>
                <div className="text-sm text-gray-500">{m.phone}{m.email ? ` ・ ${m.email}` : ''}</div>
              </div>
              {mode === 'all' && 'reg_count' in m && (
                <span className="text-xs text-gray-400">{m.reg_count} 次報名</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
