import Link from 'next/link';
import {
  formatDate,
  formatMoney,
  daysUntil,
  isDeadlinePassed,
  getStatusLabel,
  getPaymentStatusLabel,
} from '@/lib/utils';

export default function EventCard({ event, isRegistered = false, registration = null }) {
  const deadlinePassed = isDeadlinePassed(event.registration_deadline);
  const daysLeft = daysUntil(event.registration_deadline);

  return (
    <div className="card overflow-hidden">
      {/* Header bar */}
      <div className="h-2" style={{ backgroundColor: event.banner_color || '#8B1A1A' }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-temple-dark text-base leading-tight">{event.name}</h3>
          {isRegistered && registration ? (
            <span className={`shrink-0 ${registration.payment_status === 'paid' ? 'badge-paid' : 'badge-unpaid'}`}>
              {getPaymentStatusLabel(registration.payment_status)}
            </span>
          ) : isRegistered ? (
            <span className="shrink-0 badge-confirmed">已報名</span>
          ) : event.status === 'closed' || deadlinePassed ? (
            <span className="shrink-0 badge-closed">已截止</span>
          ) : (
            <span className="shrink-0 badge-active">報名中</span>
          )}
        </div>

        {/* Description only shown when NOT registered (registered view is detail-focused) */}
        {!isRegistered && event.description && (
          <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{event.description}</p>
        )}

        <div className="mt-3 space-y-1.5 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <span>📅</span>
            <span>{formatDate(event.start_date)}{event.start_date !== event.end_date ? ` ～ ${formatDate(event.end_date)}` : ''}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-1.5">
              <span>📍</span>
              <span>{event.location}</span>
            </div>
          )}
          {!isRegistered && (
            <div className="flex items-center gap-1.5">
              <span>⏰</span>
              <span>
                報名截止：{formatDate(event.registration_deadline)}
                {!deadlinePassed && daysLeft <= 7 && (
                  <span className="ml-1 text-orange-600 font-medium">（剩{daysLeft}天）</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Registered: show the registration detail (mirrors /history) */}
        {isRegistered && registration && registration.items?.length > 0 && (
          <div className="mt-3 space-y-1">
            {registration.items.map((item) => {
              const names = item.names ? safeParse(item.names) : [];
              const contents = item.contents ? safeParse(item.contents) : [];
              return (
                <div key={item.id} className="text-sm">
                  <div>
                    <span className="text-gray-700">· {item.item_name} × {item.quantity}</span>
                    {item.is_gift ? (
                      <span className="text-temple-gold ml-1">（贈品）</span>
                    ) : null}
                    {names.length > 0 && (
                      <span className="text-gray-400 ml-1">（{names.join('、')}）</span>
                    )}
                  </div>
                  {contents.length > 0 && contents.some((c) => c && c.trim()) && (
                    <div className="text-xs text-gray-500 mt-0.5 pl-3">
                      超渡內容：{contents.filter((c) => c && c.trim()).join('；')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Not-registered: show item-name chips */}
        {!isRegistered && event.items && event.items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {event.items.slice(0, 4).map((item) => (
              <span key={item.id} className="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                {item.name}
              </span>
            ))}
            {event.items.length > 4 && (
              <span className="text-xs text-gray-400">+{event.items.length - 4} 項</span>
            )}
          </div>
        )}

        {/* Registered: total + status + receipt + notes */}
        {isRegistered && registration && (
          <>
            <div className="mt-3 flex items-center justify-between pt-2 border-t">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                registration.status === 'confirmed' ? 'badge-confirmed' :
                registration.status === 'cancelled' ? 'badge-cancelled' : 'badge-pending'
              }`}>
                {getStatusLabel(registration.status)}
              </span>
              <span className="font-bold text-temple-red">{formatMoney(registration.total_amount)}</span>
            </div>
            {registration.receipt_number && (
              <div className="mt-2 text-xs text-gray-400">
                收據：{registration.receipt_number}
                {registration.payment_date && ` ・ ${formatDate(registration.payment_date)}`}
              </div>
            )}
            {registration.notes && (
              <div className="mt-1 text-xs text-gray-400">備註：{registration.notes}</div>
            )}
          </>
        )}

        <div className="mt-4">
          {isRegistered ? (
            <Link href={`/events/${event.id}`} className="block text-center btn-secondary text-sm">
              查看報名內容
            </Link>
          ) : event.status === 'closed' || deadlinePassed ? (
            <div className="text-center text-gray-400 text-sm py-2">報名已截止</div>
          ) : (
            <Link href={`/events/${event.id}`} className="block text-center btn-primary text-sm">
              立即報名
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function safeParse(json) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
