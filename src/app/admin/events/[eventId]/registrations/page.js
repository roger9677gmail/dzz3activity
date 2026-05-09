import { redirect, notFound } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import { formatDate, formatMoney, getPaymentStatusLabel, getStatusLabel } from '@/lib/utils';
import Link from 'next/link';
import RegistrationPaymentInline from './RegistrationPaymentInline';

export const dynamic = 'force-dynamic';

export default async function EventRegistrationsPage({ params }) {
  const session = await getSession();
  if (!hasPermission(session, 'registrations:manage')) redirect('/admin');

  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(params.eventId);
  if (!event) notFound();

  const registrations = await db.prepare(`
    SELECT r.*, m.name as member_name, m.phone as member_phone
    FROM registrations r
    JOIN members m ON m.id = r.member_id
    WHERE r.event_id = ?
    ORDER BY m.name
  `).all(params.eventId);

  for (const reg of registrations) {
    reg.items = await db.prepare(`
      SELECT ri.*, ei.name as item_name
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id = ?
    `).all(reg.id);
  }

  const paidCount = registrations.filter((r) => r.payment_status === 'paid').length;
  const unpaidCount = registrations.filter((r) => r.payment_status === 'unpaid' && r.status !== 'cancelled').length;
  const totalAmount = registrations.filter((r) => r.status !== 'cancelled').reduce((s, r) => s + r.total_amount, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <Link href="/admin/events" className="text-sm text-gray-400 hover:text-gray-600">← 返回活動列表</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{event.name}</h1>
          <p className="text-sm text-gray-500">報名名單 ・ {formatDate(event.start_date)}</p>
        </div>
        <a
          href={`/api/reports?format=xlsx&eventId=${event.id}`}
          className="btn-secondary text-sm px-4 py-2"
        >
          📥 匯出 Excel
        </a>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 my-4">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-gray-700">{registrations.filter(r => r.status !== 'cancelled').length}</div>
          <div className="text-xs text-gray-400">報名人數</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-green-600">{paidCount}</div>
          <div className="text-xs text-gray-400">已繳款</div>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <div className="text-xl font-bold text-yellow-600">{unpaidCount}</div>
          <div className="text-xs text-gray-400">待繳款</div>
        </div>
      </div>

      <div className="bg-temple-cream border border-amber-200 rounded-xl p-3 mb-4 flex justify-between">
        <span className="text-sm text-gray-600">總金額</span>
        <span className="font-bold text-temple-red">{formatMoney(totalAmount)}</span>
      </div>

      {/* Registrations table */}
      <div className="space-y-3">
        {registrations.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm">尚無報名記錄</div>
        )}
        {registrations.map((reg) => (
          <RegistrationPaymentInline key={reg.id} reg={reg} />
        ))}
      </div>
    </div>
  );
}
