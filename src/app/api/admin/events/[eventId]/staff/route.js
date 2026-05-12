import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { broadcastPush } from '@/lib/push';

const MAX_ROLE_NAME = 50;

// GET — admin: list every staff assignment for the event, plus the
// "role suggestions" list (top distinct role names this admin has used
// across the most recent 5 events for the datalist autocomplete).
export const GET = withPermission('events:manage', async (request, { params }) => {
  try {
    const eventId = parseInt(params.eventId);
    if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

    let rows = [];
    try {
      rows = await db
        .prepare(
          `SELECT s.id, s.event_id, s.role_name, s.member_id, s.sort_order,
                  m.name AS member_name, m.email AS member_email, m.phone AS member_phone,
                  l.name AS location_name
             FROM event_staff s
             JOIN members m ON m.id = s.member_id
        LEFT JOIN locations l ON l.id = m.location_id
            WHERE s.event_id = ?
            ORDER BY s.sort_order, s.id`
        )
        .all(eventId);
    } catch (err) {
      console.error('[staff GET] list query failed:', err);
    }

    // Role name suggestions: distinct role_name across the most recent 5 events.
    // Two-step (rather than `IN (SELECT ... LIMIT 5)`) — some MySQL 8 builds
    // still choke on LIMIT inside a subquery used with IN.
    let suggestions = [];
    try {
      const recentEvents = await db
        .prepare('SELECT id FROM events ORDER BY created_at DESC LIMIT 5')
        .all();
      if (recentEvents.length > 0) {
        const ids = recentEvents.map((r) => r.id);
        const placeholders = ids.map(() => '?').join(',');
        const suggestionRows = await db
          .prepare(
            `SELECT DISTINCT role_name FROM event_staff
              WHERE event_id IN (${placeholders})
              ORDER BY role_name`
          )
          .all(...ids);
        suggestions = suggestionRows.map((r) => r.role_name);
      }
    } catch (err) {
      console.error('[staff GET] suggestions query failed:', err);
    }

    return NextResponse.json({ staff: rows, suggestions });
  } catch (err) {
    console.error('[staff GET] unexpected:', err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

// POST — admin: bulk-add members to a role for this event.
// Body: { role_name, member_ids: number[], notify?: boolean (default true) }
// Skips duplicates via INSERT IGNORE. Fires a push to newly-added members
// unless notify=false.
export const POST = withPermission('events:manage', async (request, { params }) => {
  try {
    const eventId = parseInt(params.eventId);
    if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

    const event = await db
      .prepare('SELECT id, name FROM events WHERE id = ?')
      .get(eventId);
    if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

    const body = await request.json();
    const roleName = String(body.role_name || '').trim();
    if (!roleName) return NextResponse.json({ error: '請輸入工作組名稱' }, { status: 400 });
    if (roleName.length > MAX_ROLE_NAME) {
      return NextResponse.json({ error: '工作組名稱過長' }, { status: 400 });
    }
    const memberIds = Array.isArray(body.member_ids)
      ? [...new Set(body.member_ids.map((v) => parseInt(v)).filter((n) => Number.isInteger(n) && n > 0))]
      : [];
    if (memberIds.length === 0) {
      return NextResponse.json({ error: '請選擇要加入的師兄姐' }, { status: 400 });
    }

    // Validate members exist & not disabled
    const placeholders = memberIds.map(() => '?').join(',');
    const members = await db
      .prepare(`SELECT id, name FROM members WHERE id IN (${placeholders}) AND is_disabled = 0`)
      .all(...memberIds);
    if (members.length !== memberIds.length) {
      return NextResponse.json({ error: '部分師兄姐不存在或已停用' }, { status: 400 });
    }

    // Detect which are newly-assigned (i.e. not already in event_staff with this role)
    const existing = await db
      .prepare(
        `SELECT member_id FROM event_staff
          WHERE event_id = ? AND role_name = ? AND member_id IN (${placeholders})`
      )
      .all(eventId, roleName, ...memberIds);
    const existingSet = new Set(existing.map((r) => r.member_id));
    const newlyAddedIds = memberIds.filter((id) => !existingSet.has(id));

    for (const mid of memberIds) {
      try {
        await db
          .prepare('INSERT INTO event_staff (event_id, role_name, member_id) VALUES (?, ?, ?)')
          .run(eventId, roleName, mid);
      } catch (err) {
        // UNIQUE collision = already there → ignore
        if (err.code !== 'ER_DUP_ENTRY') throw err;
      }
    }

    // Push notification to newly-added staff (default on; skip if notify=false).
    let pushReport = null;
    if (body.notify !== false && newlyAddedIds.length > 0) {
      try {
        const subPlaceholders = newlyAddedIds.map(() => '?').join(',');
        const subs = await db
          .prepare(
            `SELECT ps.* FROM push_subscriptions ps
               JOIN members m ON m.id = ps.member_id
              WHERE ps.member_id IN (${subPlaceholders}) AND m.is_disabled = 0`
          )
          .all(...newlyAddedIds);
        if (subs.length > 0) {
          const results = await broadcastPush(subs, {
            title: `📋 ${event.name}`,
            body: `您已被指派為「${roleName}」工作人員`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            url: `/events/${eventId}`,
            tag: `staff-${eventId}-${Date.now()}`,
          });
          const expired = results.filter((x) => x.expired);
          for (const e of expired) {
            await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(e.endpoint);
          }
          pushReport = { sent: results.filter((x) => x.success).length, total: subs.length };
        } else {
          pushReport = { sent: 0, total: 0 };
        }
      } catch (pushErr) {
        console.error('staff assignment push failed:', pushErr);
        pushReport = { error: '推播發送失敗（但指派已完成）' };
      }
    }

    return NextResponse.json({ success: true, added: newlyAddedIds.length, push: pushReport });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

// PUT — rename or delete an entire role for this event.
//   Body: { old_role_name, new_role_name }    → rename
//   Body: { old_role_name, delete: true }     → delete the whole role
export const PUT = withPermission('events:manage', async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });
  const body = await request.json();
  const oldName = String(body.old_role_name || '').trim();
  if (!oldName) return NextResponse.json({ error: '缺少 old_role_name' }, { status: 400 });
  if (body.delete) {
    await db
      .prepare('DELETE FROM event_staff WHERE event_id = ? AND role_name = ?')
      .run(eventId, oldName);
    return NextResponse.json({ success: true });
  }
  const newName = String(body.new_role_name || '').trim();
  if (!newName) return NextResponse.json({ error: '缺少 new_role_name' }, { status: 400 });
  if (newName.length > MAX_ROLE_NAME) return NextResponse.json({ error: '工作組名稱過長' }, { status: 400 });
  await db
    .prepare('UPDATE event_staff SET role_name = ? WHERE event_id = ? AND role_name = ?')
    .run(newName, eventId, oldName);
  return NextResponse.json({ success: true });
});
