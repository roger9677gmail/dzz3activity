import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

// Duplicate an event into a fresh draft: copies the event row + event_items
// (preserving internal gift_event_item_id mappings) + event_attendance_questions.
// Does NOT copy registrations, registration_items, event_attendance, or any
// answers — admins always want a clean slate for the new run.
export const POST = withPermission('events:manage', async (request, { params }) => {
  try {
    const srcId = parseInt(params.eventId);
    if (!srcId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

    const src = await db.prepare('SELECT * FROM events WHERE id = ?').get(srcId);
    if (!src) return NextResponse.json({ error: '原活動不存在' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const newName = (body?.name && String(body.name).trim()) || `${src.name}（複本）`;

    const newId = await db.transaction(async (tx) => {
      // Copy the event itself as draft so admins can adjust dates before opening.
      const r = await tx
        .prepare(
          `INSERT INTO events (name, description, start_date, end_date, registration_deadline,
                               location, map_url, status, banner_color)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`
        )
        .run(
          newName,
          src.description || null,
          src.start_date,
          src.end_date,
          src.registration_deadline,
          src.location || null,
          src.map_url || null,
          src.banner_color || '#8B1A1A'
        );
      const nid = r.lastInsertRowid;

      // Items: two-pass so internal gift_event_item_id references survive
      const items = await tx
        .prepare('SELECT * FROM event_items WHERE event_id = ? ORDER BY sort_order, id')
        .all(srcId);
      const oldToNew = {};
      for (const [i, it] of items.entries()) {
        const ins = await tx
          .prepare(
            `INSERT INTO event_items (event_id, name, description, price, allow_custom_price,
                                      requires_name, requires_content, sort_order, gift_quantity)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            nid,
            it.name,
            it.description || null,
            it.price || 0,
            it.allow_custom_price ? 1 : 0,
            it.requires_name ? 1 : 0,
            it.requires_content ? 1 : 0,
            i,
            it.gift_quantity || 0
          );
        oldToNew[it.id] = ins.lastInsertRowid;
      }
      for (const it of items) {
        if (it.gift_event_item_id && oldToNew[it.gift_event_item_id] && oldToNew[it.id]) {
          await tx
            .prepare('UPDATE event_items SET gift_event_item_id = ? WHERE id = ?')
            .run(oldToNew[it.gift_event_item_id], oldToNew[it.id]);
        }
      }

      // Attendance questions
      const questions = await tx
        .prepare(
          `SELECT label, type, options, required, sort_order, active
             FROM event_attendance_questions
            WHERE event_id = ?
            ORDER BY sort_order, id`
        )
        .all(srcId);
      for (const q of questions) {
        await tx
          .prepare(
            `INSERT INTO event_attendance_questions (event_id, label, type, options, required, sort_order, active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            nid,
            q.label,
            q.type,
            typeof q.options === 'string' ? q.options : JSON.stringify(q.options || {}),
            q.required ? 1 : 0,
            q.sort_order || 0,
            q.active ? 1 : 0
          );
      }

      // Staff (法會工作人員): duplicate same roles + members. No push fires
      // here — the new event is a draft until the admin publishes; staff
      // will only see it once status flips to 'active'.
      const staffRows = await tx
        .prepare('SELECT role_name, member_id, sort_order FROM event_staff WHERE event_id = ?')
        .all(srcId);
      for (const s of staffRows) {
        try {
          await tx
            .prepare(
              'INSERT INTO event_staff (event_id, role_name, member_id, sort_order) VALUES (?, ?, ?, ?)'
            )
            .run(nid, s.role_name, s.member_id, s.sort_order || 0);
        } catch (err) {
          if (err.code !== 'ER_DUP_ENTRY') throw err;
        }
      }

      return nid;
    });

    return NextResponse.json({ success: true, id: newId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
