import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import { formatMoney, getPaymentStatusLabel } from '@/lib/utils';
import Link from 'next/link';
import AdminRegistrationsClient from './AdminRegistrationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminRegistrationsPage({ searchParams }) {
  const session = await getSession();
  if (!hasPermission(session, 'registrations:manage')) redirect('/admin');

  const eventId = searchParams.eventId || '';
  const paymentStatus = searchParams.payment_status || '';
  const search = searchParams.search || '';

  const events = await db.prepare("SELECT id, name FROM events ORDER BY start_date DESC").all();

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
  for (const reg of registrations) {
    reg.items = await db.prepare(`
      SELECT ri.*, ei.name as item_name
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id = ?
    `).all(reg.id);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">報名管理</h1>
        <a href={`/api/reports?format=xlsx${eventId ? `&eventId=${eventId}` : ''}${paymentStatus ? `&payment_status=${paymentStatus}` : ''}`}
          className="btn-secondary text-sm px-4 py-2">
          📥 匯出 Excel
        </a>
      </div>

      <AdminRegistrationsClient
        registrations={registrations}
        events={events}
        initialFilters={{ eventId, paymentStatus, search }}
      />
    </div>
  );
}
