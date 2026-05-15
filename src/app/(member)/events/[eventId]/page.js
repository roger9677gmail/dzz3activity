import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import RegistrationForm from '@/components/events/RegistrationForm';
import { isDeadlinePassed, formatMoney, formatEventDateRange, formatDeadline, googleMapsUrl } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ params }) {
  const session = await getSession();
  const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(params.eventId);
  if (!event) notFound();

  event.items = await db.prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order').all(event.id);

  // Need name + receipt_title so the registration form can default each item's
  // 收據抬頭 to the logged-in member's value.
  const currentUser = await db.prepare('SELECT name, receipt_title FROM members WHERE id = ?').get(session.sub);

  // 是否有活動登記題目（決定要不要顯示「活動登記」入口）
  const attendanceRow = await db
    .prepare('SELECT COUNT(*) AS c FROM event_attendance_questions WHERE event_id = ? AND active = 1')
    .get(event.id);
  const hasAttendance = (attendanceRow?.c || 0) > 0;
  // Member can have multiple attendance rows now (self + 親友). Load just the
  // names so we can show a summary inline on the event detail card.
  const attendanceEntries = hasAttendance
    ? await db
        .prepare(
          `SELECT id, attendee_name, attendee_relation
             FROM event_attendance
            WHERE event_id = ? AND member_id = ?
            ORDER BY (attendee_name IS NOT NULL), id`
        )
        .all(event.id, session.sub)
    : [];
  const hasAnyEntry = attendanceEntries.length > 0;
  const attendanceSummary = attendanceEntries
    .map((e) => (e.attendee_name ? `${e.attendee_name}${e.attendee_relation ? `（${e.attendee_relation}）` : ''}` : '本人'))
    .join('、');

  // Am I staff for this event? (admins always see staff info too.)
  let myStaffRow = null;
  let staffList = [];
  let staffLoadError = '';
  try {
    myStaffRow = await db
      .prepare('SELECT 1 FROM event_staff WHERE event_id = ? AND member_id = ? LIMIT 1')
      .get(event.id, session.sub);
  } catch (err) {
    console.error(`[event detail eid=${event.id} uid=${session.sub}] staff lookup failed:`, err);
    staffLoadError = err?.code || err?.message || '工作人員查詢失敗';
  }
  const isStaff = !!myStaffRow || !!session.is_admin;
  if (isStaff) {
    try {
      staffList = await db
        .prepare(
          `SELECT s.id, s.role_name, s.member_id,
                  m.name AS member_name, m.phone AS member_phone, m.avatar AS member_avatar,
                  l.name AS location_name
             FROM event_staff s
             JOIN members m ON m.id = s.member_id
        LEFT JOIN locations l ON l.id = m.location_id
            WHERE s.event_id = ?
            ORDER BY s.sort_order, s.role_name, m.name`
        )
        .all(event.id);
    } catch (err) {
      console.error(`[event detail eid=${event.id}] staff list failed:`, err);
      staffLoadError = err?.code || err?.message || '工作人員名單載入失敗';
    }
  }

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
    // Backfill missing per-item receipt_title from the registration-level value
    // (or the member default) so older registrations behave consistently in edit mode.
    const fallbackTitle = existingRegistration.receipt_title || currentUser?.receipt_title || currentUser?.name || '';
    for (const ri of existingRegistration.items) {
      if (!ri.receipt_title) ri.receipt_title = fallbackTitle;
    }
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
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-sm font-medium text-white bg-black/25 hover:bg-black/40 active:bg-black/50 transition-colors rounded-full px-3 py-1.5 mb-2"
          aria-label="返回活動列表"
        >
          <span aria-hidden="true">←</span> 返回
        </Link>
        <h1 className="text-lg font-bold">{event.name}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Event Info */}
        <div className="card p-4">
          <div className="h-1 rounded mb-3" style={{ backgroundColor: event.banner_color || '#8B1A1A' }} />
          {event.description && <p className="text-gray-600 text-sm mb-3">{event.description}</p>}
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><span>📅</span><span>{formatEventDateRange(event.start_date, event.end_date)}</span></div>
            {event.location && (
              <div className="flex items-center gap-2 flex-wrap">
                <span>📍</span>
                <span className="text-gray-700">{event.location}</span>
                <a
                  href={event.map_url || googleMapsUrl(event.location)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 transition-colors"
                  aria-label={`在 Google 地圖開啟 ${event.location}`}
                >
                  打開地圖
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            )}
            <div className="flex gap-2">
              <span>⏰</span>
              <span>報名截止：{formatDeadline(event.registration_deadline)}
                {deadlinePassed && <span className="text-red-500 ml-1">（已截止）</span>}
              </span>
            </div>
          </div>
        </div>

        {/* 工作人員 (僅 staff/admin 可見) — load 失敗也要讓 admin 看到，避免靜默缺資料 */}
        {isStaff && (staffList.length > 0 || (staffLoadError && session.is_admin)) && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-gray-800">🛠️ 工作人員</div>
              <span className="text-[11px] text-gray-400">{staffList.length} 位</span>
            </div>
            {staffLoadError && session.is_admin && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-2 mb-2">
                ⚠ 工作人員名單載入失敗：{staffLoadError}
                <div className="text-[11px] text-amber-700 mt-1">
                  通常是 schema 還沒升級。請至 Cloud Shell 跑 <code>npm run db:migrate</code>。
                </div>
              </div>
            )}
            {staffList.length > 0 && <StaffByRole staffList={staffList} />}
            {staffList.length > 0 && (
              <Link
                href={`/events/${event.id}/staff-view`}
                className="mt-3 btn-secondary w-full text-center block text-sm"
              >📊 查看祈福 / 活動報名名單</Link>
            )}
          </div>
        )}

        {/* 活動登記入口（若主辦已建題目） */}
        {hasAttendance && (
          <div className="card p-4">
            <div className="text-sm font-bold text-gray-800 mb-1">📋 活動登記</div>
            {hasAnyEntry ? (
              <div className="text-xs text-gray-600 mb-3">
                <div>已登記 {attendanceEntries.length} 位：</div>
                <div className="mt-0.5 text-gray-800">{attendanceSummary}</div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 mb-3">
                本人 / 親友皆可登記（交通 / 住宿 / 用餐）
              </div>
            )}
            <Link
              href={`/events/${event.id}/attendance`}
              className="btn-primary w-full text-center block"
            >
              {hasAnyEntry ? '管理登記 / 新增親友' : '前往活動登記'}
            </Link>
          </div>
        )}

        {/* 報名祈福（功德主/蓮位）— only relevant when event has items.
            If no items, this whole event is "純活動登記" and we skip the
            entire registration UI. */}
        {event.items.length > 0 && (
          <>
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

            {existingRegistration && !isPaid && canRegister && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <div className="font-bold mb-1">⏳ 您已報名但尚未繳款</div>
                <div>可在下方修改報名項目；繳款後將無法再修改。</div>
              </div>
            )}

            {canRegister && (
              <RegistrationForm
                event={event}
                existingRegistration={existingRegistration && !isPaid ? existingRegistration : null}
                currentUser={currentUser}
              />
            )}

            {!canRegister && !existingRegistration && (
              <div className="text-center py-6 text-gray-400">
                <div className="text-3xl mb-2">🔒</div>
                <p className="text-sm">{deadlinePassed ? '報名已截止' : '此活動目前不開放報名'}</p>
              </div>
            )}
          </>
        )}

        {/* Event has neither items nor attendance — nothing for the member to do. */}
        {event.items.length === 0 && !hasAttendance && (
          <div className="text-center py-6 text-gray-400">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-sm">此活動目前無可登記或報名項目</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StaffByRole({ staffList }) {
  const byRole = new Map();
  for (const s of staffList) {
    if (!byRole.has(s.role_name)) byRole.set(s.role_name, []);
    byRole.get(s.role_name).push(s);
  }
  return (
    <div className="space-y-2">
      {[...byRole.entries()].map(([role, members]) => (
        <div key={role} className="text-xs">
          <span className="text-gray-500">{role}：</span>
          <span className="text-gray-800">
            {members.map((m) => m.member_name).join('、')}
          </span>
        </div>
      ))}
    </div>
  );
}
