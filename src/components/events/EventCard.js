import Link from 'next/link';
import {
  formatDate,
  formatMoney,
  daysUntil,
  isDeadlinePassed,
  getStatusLabel,
  getPaymentStatusLabel,
  safeParseJSON,
  formatEventDateRange,
  formatDeadline,
  googleMapsUrl,
} from '@/lib/utils';

export default function EventCard({ event, isRegistered = false, registration = null, attendance = [], isStaff = false }) {
  const deadlinePassed = isDeadlinePassed(event.registration_deadline);
  const daysLeft = daysUntil(event.registration_deadline);
  const hasAttendance = attendance.length > 0;
  const attendanceSummary = attendance
    .map((a) => (a.attendee_name ? `${a.attendee_name}${a.attendee_relation ? `（${a.attendee_relation}）` : ''}` : '本人'))
    .join('、');
  const noItems = !event.items || event.items.length === 0;

  return (
    <div className="card overflow-hidden">
      {/* Header bar */}
      <div className="h-2" style={{ backgroundColor: event.banner_color || '#8B1A1A' }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-temple-dark text-base leading-tight">{event.name}</h3>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isStaff && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                🛠️ 工作人員
              </span>
            )}
            {isRegistered && registration ? (
              <span className={`${registration.payment_status === 'paid' ? 'badge-paid' : 'badge-unpaid'}`}>
                {getPaymentStatusLabel(registration.payment_status)}
              </span>
            ) : isRegistered ? (
              <span className="badge-confirmed">已報名</span>
            ) : event.status === 'closed' || deadlinePassed ? (
              <span className="badge-closed">已截止</span>
            ) : (
              <span className="badge-active">報名中</span>
            )}
          </div>
        </div>

        {/* Description only shown when NOT registered (registered view is detail-focused) */}
        {!isRegistered && event.description && (
          <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{event.description}</p>
        )}

        <div className="mt-3 space-y-1.5 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <span>📅</span>
            <span>{formatEventDateRange(event.start_date, event.end_date)}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>📍</span>
              <span className="text-gray-700">{event.location}</span>
              <a
                href={event.map_url || googleMapsUrl(event.location)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-xs bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 transition-colors"
                aria-label={`在 Google 地圖開啟 ${event.location}`}
              >
                打開地圖
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          )}
          {!isRegistered && (
            <div className="flex items-center gap-1.5">
              <span>⏰</span>
              <span>
                報名截止：{formatDeadline(event.registration_deadline)}
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
              const names = safeParseJSON(item.names);
              const contents = safeParseJSON(item.contents);
              const itemTitle = item.receipt_title || registration.receipt_title || '';
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
                  {itemTitle && (
                    <div className="text-xs text-gray-500 mt-0.5 pl-3">
                      收據抬頭：{itemTitle}
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

        {/* Attendance (活動登記) summary — 本人 + 親友 */}
        {hasAttendance && (
          <div className="mt-3 text-xs text-gray-600">
            <span className="text-gray-400">📋 活動登記 {attendance.length} 位：</span>
            <span className="text-gray-800 ml-1">{attendanceSummary}</span>
          </div>
        )}

        <div className="mt-4">
          {isRegistered ? (
            <Link href={`/events/${event.id}`} className="block text-center btn-secondary text-sm">
              查看報名內容
            </Link>
          ) : event.status === 'closed' || deadlinePassed ? (
            // 截止後仍可進去看／管理活動登記
            hasAttendance ? (
              <Link href={`/events/${event.id}`} className="block text-center btn-secondary text-sm">
                查看活動內容
              </Link>
            ) : (
              <div className="text-center text-gray-400 text-sm py-2">報名已截止</div>
            )
          ) : noItems ? (
            // 純活動登記模式（沒有報名項目）
            <Link href={`/events/${event.id}`} className={`block text-center text-sm ${hasAttendance ? 'btn-secondary' : 'btn-primary'}`}>
              {hasAttendance ? '管理活動登記' : '前往活動登記'}
            </Link>
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

