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

// POST: create a new attendance entry (self or 親友)
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

    // Enforce "本人" at most one
    if (f.attendee_name == null) {
      const existing = await db
        .prepare(
          'SELECT id FROM event_attendance WHERE event_id = ? AND member_id = ? AND attendee_name IS NULL'
        )
        .get(eventId, memberId);
      if (existing) {
        return NextResponse.json({ error: '本人已登記，請使用編輯功能修改' }, { status: 409 });
      }
    }

    const questions = await loadEventQuestions(eventId);
    const ans = buildNormalizedAnswers(questions, body.answers);
    if (!ans.ok) return NextResponse.json({ error: ans.error }, { status: 400 });

    const notes = body.notes == null ? null : String(body.notes).slice(0, 2000);
    const r = await db
      .prepare(
        'INSERT INTO event_attendance (event_id, member_id, attendee_name, attendee_relation, notes) VALUES (?, ?, ?, ?, ?)'
      )
      .run(eventId, memberId, f.attendee_name, f.attendee_relation, notes);
    await insertAnswers(r.lastInsertRowid, ans.normalized);

    return NextResponse.json({ success: true, id: r.lastInsertRowid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
