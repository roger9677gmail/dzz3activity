import Link from 'next/link';
import { formatDate, daysUntil, isDeadlinePassed } from '@/lib/utils';

export default function EventCard({ event, isRegistered = false }) {
  const deadlinePassed = isDeadlinePassed(event.registration_deadline);
  const daysLeft = daysUntil(event.registration_deadline);

  return (
    <div className="card overflow-hidden">
      {/* Header bar */}
      <div className="h-2" style={{ backgroundColor: event.banner_color || '#8B1A1A' }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-temple-dark text-base leading-tight">{event.name}</h3>
          {isRegistered ? (
            <span className="shrink-0 badge-confirmed">已報名</span>
          ) : event.status === 'closed' || deadlinePassed ? (
            <span className="shrink-0 badge-closed">已截止</span>
          ) : (
            <span className="shrink-0 badge-active">報名中</span>
          )}
        </div>

        {event.description && (
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
          <div className="flex items-center gap-1.5">
            <span>⏰</span>
            <span>
              報名截止：{formatDate(event.registration_deadline)}
              {!deadlinePassed && daysLeft <= 7 && (
                <span className="ml-1 text-orange-600 font-medium">（剩{daysLeft}天）</span>
              )}
            </span>
          </div>
        </div>

        {event.items && event.items.length > 0 && (
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
