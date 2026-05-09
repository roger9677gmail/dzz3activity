import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import RegistrationForm from '@/components/events/RegistrationForm';
import { formatDate, isDeadlinePassed, formatMoney } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ params }) {
  const session = await getSession();
  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(params.eventId);
  if (!event) notFound();

  event.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(event.id);

  const existingRegistration = await db.prepare(`
    SELECT * FROM registrations WHERE event_id = ? AND member_id = ?
  `).get(params.eventId, session.sub);

  if (existingRegistration) {
    existingRegistration.items = await db.prepare(`
      SELECT ri.*, ei.name as item_name, ei.allow_custom_price, ei.gift_event_item_id, ei.gift_quantity
      FROM registration_items ri
      JOIN event_items ei ON ei.id = ri.event_item_id
      WHERE ri.registration_id = ?
      ORDER BY ri.is_gift, ri.id
    `).all(existingRegistration.id);
    existingRegistration.items_summary = existingRegistration.items
      .filter((ri) => !ri.is_gift)
      .map((ri) => `${ri.item_name}x${ri.quantity}`)
      .join(', ');
  }

  const isPaid = existingRegistration?.payment_status === 'paid';
  const deadlinePassed = isDeadlinePassed(event.registration_deadline);
  const canRegister = event.status === 'active' && !deadlinePassed && !isPaid;

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
                  <span className="text-temple-gold text-sm font-medium whitespace-nowrap shrink-0 ml-3">{formatMoney(item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paid registration is read-only; show confirmation. */}
        {existingRegistration && isPaid && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-700 font-bold mb-2">✅ 您已完成報名</div>
            <div className="text-sm text-green-700 space-y-1">
              <div>項目：{existingRegistration.items_summary || '—'}</div>
              <div>金額：{formatMoney(existingRegistration.total_amount)}</div>
              <div>繳款狀態：✅ 已繳款</div>
              {existingRegistration.receipt_number && <div>收據號碼：{existingRegistration.receipt_number}</div>}
              {existingRegistration.notes && <div>備註：{existingRegistration.notes}</div>}
            </div>
          </div>
        )}

        {/* Unpaid registration — banner + edit-mode form. */}
        {existingRegistration && !isPaid && canRegister && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <div className="font-bold mb-1">⏳ 您已報名但尚未繳款</div>
            <div>可在下方修改報名項目；繳款後將無法再修改。</div>
          </div>
        )}

        {/* Registration / edit form */}
        {canRegister && (
          <RegistrationForm
            event={event}
            existingRegistration={existingRegistration && !isPaid ? existingRegistration : null}
          />
        )}

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
