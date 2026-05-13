import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  loadEntriesForMember,
  loadEventQuestions,
  validateAttendeeFields,
  buildNormalizedAnswers,
  insertAnswers,
} from '@/lib/attendance-server';

export const GET = withAuth(async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  const memberId = request.session.sub;
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

  const event = await db
    .prepare('SELECT id, name, start_date, end_date, registration_deadline, banner_color FROM events WHERE id = ?')
    .get(eventId);
  if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

  const questions = await loadEventQuestions(eventId);
  const entries = await loadEntriesForMember(eventId, memberId);

  return NextResponse.json({ event, questions, entries });
});

// POST: create a new attendance entry (self or 親友).
// The "本人" uniqueness check + INSERT must be atomic — otherwise two
// concurrent tabs from the same member could both pass the "no existing self"
// check and produce two attendee_name=NULL rows. We wrap in a transaction
// and lock matching rows with SELECT … FOR UPDATE.
export const POST = withAuth(async (request, { params }) => {
  try {
    const eventId = parseInt(params.eventId);
    const memberId = request.session.sub;
    if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

    const event = await db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

    const body = await request.json();
    const f = validateAttendeeFields(body);
    if (!f.ok) return NextResponse.json({ error: f.error }, { status: 400 });

    const questions = await loadEventQuestions(eventId);
    const ans = buildNormalizedAnswers(questions, body.answers);
    if (!ans.ok) return NextResponse.json({ error: ans.error }, { status: 400 });
    const notes = body.notes == null ? null : String(body.notes).slice(0, 2000);

    const result = await db.transaction(async (tx) => {
      if (f.attendee_name == null) {
        const existing = await tx
          .prepare(
            'SELECT id FROM event_attendance WHERE event_id = ? AND member_id = ? AND attendee_name IS NULL FOR UPDATE'
          )
          .get(eventId, memberId);
        if (existing) {
          return { conflict: true };
        }
      }
      const r = await tx
        .prepare(
          'INSERT INTO event_attendance (event_id, member_id, attendee_name, attendee_relation, notes) VALUES (?, ?, ?, ?, ?)'
        )
        .run(eventId, memberId, f.attendee_name, f.attendee_relation, notes);
      await insertAnswers(r.lastInsertRowid, ans.normalized, tx);
      return { id: r.lastInsertRowid };
    });

    if (result.conflict) {
      return NextResponse.json({ error: '本人已登記，請使用編輯功能修改' }, { status: 409 });
    }
    return NextResponse.json({ success: true, id: result.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
