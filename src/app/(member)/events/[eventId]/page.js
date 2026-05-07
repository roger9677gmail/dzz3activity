import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import RegistrationForm from '@/components/events/RegistrationForm';
import { formatDate, isDeadlinePassed, formatMoney } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ params }) {
  const session = await getSession(false);
  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(params.eventId);
  if (!event) notFound();

  event.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(event.id);

  const existingRegistration = await db.prepare(`
    SELECT r.*, GROUP_CONCAT(CONCAT(ei.name, 'x', ri.quantity) SEPARATOR ', ') as items_summary
    FROM registrations r
    LEFT JOIN registration_items ri ON ri.registration_id = r.id
    LEFT JOIN event_items ei ON ei.id = ri.event_item_id
    WHERE r.event_id = ? AND r.member_id = ?
    GROUP BY r.id
  `).get(params.eventId, session.sub);

  const deadlinePassed = isDeadlinePassed(event.registration_deadline);
  const canRegister = event.status === 'active' && !deadlinePassed && !existingRegistration;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-2">
          <Link href="/events" className="text-red-200 text-sm">← 返回</Link>
          <h1 className="text-lg font-bold">{event.name}</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Event Info */}
        <div className="card p-4">
          <div className="h-1 rounded mb-3" style={{ backgroundColor: event.banner_color || '#8B1A1A' }} />
          {event.description && <p className="text-gray-600 text-sm mb-3">{event.description}</p>}
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span>📅</span><span>{formatDate(event.start_date)}{event.start_date !== event.end_date ? ` ～ ${formatDate(event.end_date)}` : ''}</span></div>
            {event.location && <div className="flex gap-2"><span>📍</span><span>{event.location}</span></div>}
            <div className="flex gap-2">
              <span>⏰</span>
              <span>報名截止：{formatDate(event.registration_deadline)}
                {deadlinePassed && <span className="text-red-500 ml-1">（已截止）</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Items preview */}
        {event.items.length > 0 && (
          <div className="card p-4">
            <h3 className="font-bold text-sm text-gray-700 mb-2">可報名項目</h3>
            <div className="space-y-2">
              {event.items.map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <div>
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.description && <span className="text-xs text-gray-400 ml-1">（{item.description}）</span>}
                  </div>
                  <span className="text-temple-gold text-sm font-medium">{formatMoney(item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already registered */}
        {existingRegistration && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-700 font-bold mb-2">✅ 您已完成報名</div>
            <div className="text-sm text-green-700 space-y-1">
              <div>項目：{existingRegistration.items_summary || '—'}</div>
              <div>金額：{formatMoney(existingRegistration.total_amount)}</div>
              <div>繳款狀態：{existingRegistration.payment_status === 'paid' ? '✅ 已繳款' : '⏳ 待繳款'}</div>
              {existingRegistration.receipt_number && <div>收據號碼：{existingRegistration.receipt_number}</div>}
              {existingRegistration.notes && <div>備註：{existingRegistration.notes}</div>}
            </div>
          </div>
        )}

        {/* Registration Form */}
        {canRegister && <RegistrationForm event={event} />}

        {!canRegister && !existingRegistration && (
          <div className="text-center py-6 text-gray-400">
            <div className="text-3xl mb-2">🔒</div>
            <p className="text-sm">{deadlinePassed ? '報名已截止' : '此活動目前不開放報名'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
