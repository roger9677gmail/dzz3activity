import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { formatDate, formatMoney, getStatusLabel, getPaymentStatusLabel } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const session = await getSession(false);

  const registrations = db.prepare(`
    SELECT r.*, e.name as event_name, e.start_date, e.end_date, e.banner_color
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.member_id = ?
    ORDER BY r.created_at DESC
  `).all(session.sub);

  for (const reg of registrations) {
    reg.items = db.prepare(`
      SELECT ri.*, ei.name as item_name
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id = ?
    `).all(reg.id);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-lg font-bold">報名紀錄</h1>
        <p className="text-red-200 text-sm">共 {registrations.length} 筆記錄</p>
      </div>

      <div className="p-4 space-y-3">
        {registrations.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p>尚無報名記錄</p>
            <Link href="/events" className="mt-3 inline-block text-temple-red text-sm font-medium">前往報名活動 →</Link>
          </div>
        )}

        {registrations.map((reg) => (
          <div key={reg.id} className="card overflow-hidden">
            <div className="h-1.5" style={{ backgroundColor: reg.banner_color || '#8B1A1A' }} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-temple-dark">{reg.event_name}</h3>
                <span className={`shrink-0 ${reg.payment_status === 'paid' ? 'badge-paid' : 'badge-unpaid'}`}>
                  {getPaymentStatusLabel(reg.payment_status)}
                </span>
              </div>

              <div className="text-sm text-gray-500 mb-3">
                📅 {formatDate(reg.start_date)}{reg.start_date !== reg.end_date ? ` ～ ${formatDate(reg.end_date)}` : ''}
              </div>

              <div className="space-y-1 mb-3">
                {reg.items.map((item) => {
                  const itemNames = item.names ? JSON.parse(item.names) : [];
                  return (
                    <div key={item.id} className="text-sm">
                      <span className="text-gray-700">· {item.item_name} × {item.quantity}</span>
                      {itemNames.length > 0 && (
                        <span className="text-gray-400 ml-1">（{itemNames.join('、')}）</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  reg.status === 'confirmed' ? 'badge-confirmed' : reg.status === 'cancelled' ? 'badge-cancelled' : 'badge-pending'
                }`}>
                  {getStatusLabel(reg.status)}
                </span>
                <span className="font-bold text-temple-red">{formatMoney(reg.total_amount)}</span>
              </div>

              {reg.receipt_number && (
                <div className="mt-2 text-xs text-gray-400">收據：{reg.receipt_number}
                  {reg.payment_date && ` ・ ${reg.payment_date}`}
                </div>
              )}

              {reg.notes && (
                <div className="mt-1 text-xs text-gray-400">備註：{reg.notes}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
