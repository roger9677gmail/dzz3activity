import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import Link from 'next/link';
import AdminMembersClient from './AdminMembersClient';

export const dynamic = 'force-dynamic';

export default async function AdminMembersPage({ searchParams }) {
  const session = await getSession();
  if (!hasPermission(session, 'members:manage')) redirect('/admin');

  const eventId = searchParams.eventId || '';
  const mode = searchParams.mode || 'all'; // 'all' | 'unregistered'
  const search = searchParams.search || '';
  const showDisabled = searchParams.disabled === '1';

  const events = await db.prepare("SELECT id, name FROM events WHERE status='active' ORDER BY start_date").all();
  const locations = await db.prepare('SELECT id, name FROM locations WHERE active=1 ORDER BY sort_order, id').all();

  let members;
  if (mode === 'unregistered' && eventId) {
    members = await db.prepare(`
      SELECT m.id, m.name, m.phone, m.email, m.address, m.location_id, m.is_disabled, m.created_at,
             l.name AS location_name
      FROM members m
      LEFT JOIN locations l ON l.id = m.location_id
      WHERE m.is_admin = 0
        AND m.is_disabled = 0
        AND m.id NOT IN (
          SELECT r.member_id FROM registrations r
          WHERE r.event_id = ? AND r.status != 'cancelled'
        )
        ${search ? "AND (m.name LIKE ? OR m.phone LIKE ?)" : ""}
      ORDER BY m.name
    `).all(...[eventId, ...(search ? [`%${search}%`, `%${search}%`] : [])]);
  } else {
    const disabledFilter = showDisabled ? '' : 'AND m.is_disabled = 0';
    members = await db.prepare(`
      SELECT m.id, m.name, m.phone, m.email, m.address, m.location_id, m.is_disabled, m.created_at,
             l.name AS location_name,
        (SELECT COUNT(*) FROM registrations r WHERE r.member_id = m.id AND r.status != 'cancelled') as reg_count
      FROM members m
      LEFT JOIN locations l ON l.id = m.location_id
      WHERE m.is_admin = 0
        ${disabledFilter}
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
        <div className="flex gap-2 flex-wrap">
          <Link href="?mode=all"
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${mode === 'all' && !showDisabled ? 'bg-temple-red text-white' : 'bg-gray-100 text-gray-600'}`}>
            全部師兄姐
          </Link>
          <Link href="?mode=unregistered"
            className={`text-sm px-3 py-1.5 rounded-lg font-medium ${mode === 'unregistered' ? 'bg-temple-red text-white' : 'bg-gray-100 text-gray-600'}`}>
            未報名名單
          </Link>
          {mode === 'all' && (
            <Link href="?mode=all&disabled=1"
              className={`text-sm px-3 py-1.5 rounded-lg font-medium ${showDisabled ? 'bg-temple-red text-white' : 'bg-gray-100 text-gray-600'}`}>
              含已停用
            </Link>
          )}
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
          {showDisabled && <input type="hidden" name="disabled" value="1" />}
          <input type="text" name="search" defaultValue={search} className="input-field text-sm"
            placeholder="搜尋姓名或電話..." />
        </form>
      </div>

      {mode === 'unregistered' && !eventId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700 mb-4">
          請選擇一個法會活動，以查看未報名的師兄姐名單
        </div>
      )}

      <AdminMembersClient
        members={members}
        locations={locations}
        canEdit={mode === 'all'}
        emptyMessage={mode === 'unregistered' ? '所有師兄姐均已報名此活動 🎉' : '無師兄姐資料'}
      />
    </div>
  );
}
