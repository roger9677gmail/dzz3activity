import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import Link from 'next/link';
import AdminRegistrationsClient from './AdminRegistrationsClient';
import AdminAttendanceListClient from './AdminAttendanceListClient';

export const dynamic = 'force-dynamic';

export default async function AdminRegistrationsPage({ searchParams }) {
  const session = await getSession();
  const canRegs = hasPermission(session, 'registrations:manage');
  const canAtt = hasPermission(session, 'attendance:manage');
  if (!canRegs && !canAtt) redirect('/admin');

  // Default tab depends on what the admin can actually see.
  const requestedType = searchParams.type;
  const type =
    requestedType === 'attendance' && canAtt
      ? 'attendance'
      : requestedType === 'qf' && canRegs
        ? 'qf'
        : canRegs ? 'qf' : 'attendance';

  const eventId = searchParams.eventId || '';
  const paymentStatus = searchParams.payment_status || '';
  const search = searchParams.search || '';

  const events = await db.prepare("SELECT id, name FROM events ORDER BY start_date DESC").all();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-800">報名管理</h1>
        {type === 'qf' ? (
          <a
            href={`/api/reports?format=xlsx${eventId ? `&eventId=${eventId}` : ''}${paymentStatus ? `&payment_status=${paymentStatus}` : ''}`}
            className="btn-secondary text-sm px-4 py-2"
          >📥 匯出祈福 Excel</a>
        ) : eventId ? (
          <a
            href={`/api/admin/events/${eventId}/attendance/export`}
            className="btn-secondary text-sm px-4 py-2"
          >📥 匯出活動 Excel</a>
        ) : (
          <span className="text-xs text-gray-400">選擇單一活動後可匯出 Excel</span>
        )}
      </div>

      {/* Type tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {canRegs && (
          <TabLink
            href={`/admin/registrations?type=qf`}
            active={type === 'qf'}
          >祈福報名</TabLink>
        )}
        {canAtt && (
          <TabLink
            href={`/admin/registrations?type=attendance`}
            active={type === 'attendance'}
          >活動報名</TabLink>
        )}
      </div>

      {type === 'qf' ? (
        <QfTab eventId={eventId} paymentStatus={paymentStatus} search={search} events={events} />
      ) : (
        <AttendanceTab eventId={eventId} search={search} events={events} />
      )}
    </div>
  );
}

function TabLink({ href, active, children }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm border-b-2 transition-colors ${
        active
          ? 'border-temple-red text-temple-red font-medium'
          : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >{children}</Link>
  );
}

async function QfTab({ eventId, paymentStatus, search, events }) {
  let query = `
    SELECT r.*, m.name as member_name, m.phone as member_phone, e.name as event_name
    FROM registrations r
    JOIN members m ON m.id = r.member_id
    JOIN events e ON e.id = r.event_id
    WHERE 1=1
  `;
  const params = [];
  if (eventId) { query += ' AND r.event_id = ?'; params.push(eventId); }
  if (paymentStatus) { query += ' AND r.payment_status = ?'; params.push(paymentStatus); }
  if (search) {
    query += ' AND (m.name LIKE ? OR m.phone LIKE ? OR r.receipt_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY r.created_at DESC LIMIT 200';

  const registrations = await db.prepare(query).all(...params);
  if (registrations.length > 0) {
    const regIds = registrations.map((r) => r.id);
    const placeholders = regIds.map(() => '?').join(',');
    const allItems = await db.prepare(`
      SELECT ri.*, ei.name as item_name
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id IN (${placeholders})
      ORDER BY ri.registration_id, ri.is_gift, ri.id
    `).all(...regIds);
    const byReg = new Map();
    for (const it of allItems) {
      if (!byReg.has(it.registration_id)) byReg.set(it.registration_id, []);
      byReg.get(it.registration_id).push(it);
    }
    for (const reg of registrations) reg.items = byReg.get(reg.id) || [];
  }

  return (
    <AdminRegistrationsClient
      registrations={registrations}
      events={events}
      initialFilters={{ eventId, paymentStatus, search }}
    />
  );
}

async function AttendanceTab({ eventId, search, events }) {
  let query = `
    SELECT a.id, a.event_id, a.member_id, a.attendee_name, a.attendee_relation,
           a.notes, a.created_at, a.updated_at,
           m.name AS member_name, m.phone AS member_phone,
           e.name AS event_name,
           l.name AS location_name
      FROM event_attendance a
      JOIN members m ON m.id = a.member_id
      JOIN events e ON e.id = a.event_id
 LEFT JOIN locations l ON l.id = m.location_id
     WHERE m.is_disabled = 0
  `;
  const params = [];
  if (eventId) { query += ' AND a.event_id = ?'; params.push(eventId); }
  if (search) {
    query += ' AND (m.name LIKE ? OR m.phone LIKE ? OR a.attendee_name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY a.created_at DESC LIMIT 300';

  const rows = await db.prepare(query).all(...params);

  return (
    <AdminAttendanceListClient
      rows={rows}
      events={events}
      initialFilters={{ eventId, search }}
    />
  );
}
