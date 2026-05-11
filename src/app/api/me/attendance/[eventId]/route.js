import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { normalizeAnswer, parseOptions } from '@/lib/attendance';

async function loadQuestions(eventId) {
  return await db
    .prepare(
      `SELECT id, label, type, options, required, sort_order
         FROM event_attendance_questions
        WHERE event_id = ? AND active = 1
        ORDER BY sort_order, id`
    )
    .all(eventId);
}

export const GET = withAuth(async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  const memberId = request.session.sub;
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

  const event = await db
    .prepare('SELECT id, name, start_date, end_date, registration_deadline FROM events WHERE id = ?')
    .get(eventId);
  if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

  const questions = (await loadQuestions(eventId)).map((q) => ({
    ...q,
    options: parseOptions(q.type, q.options),
  }));

  const attendance = await db
    .prepare('SELECT id, notes, created_at, updated_at FROM event_attendance WHERE event_id = ? AND member_id = ?')
    .get(eventId, memberId);
  let answers = {};
  if (attendance) {
    const rows = await db
      .prepare('SELECT question_id, value FROM event_attendance_answers WHERE attendance_id = ?')
      .all(attendance.id);
    for (const r of rows) {
      let v = r.value;
      if (typeof v === 'string') {
        try { v = JSON.parse(v); } catch {}
      }
      answers[r.question_id] = v;
    }
  }

  return NextResponse.json({ event, questions, attendance, answers });
});

// PUT body: { answers: { [question_id]: value }, notes }
export const PUT = withAuth(async (request, { params }) => {
  try {
    const eventId = parseInt(params.eventId);
    const memberId = request.session.sub;
    if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

    const event = await db
      .prepare('SELECT id, registration_deadline, status FROM events WHERE id = ?')
      .get(eventId);
    if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

    const body = await request.json();
    const incoming = body.answers && typeof body.answers === 'object' ? body.answers : {};
    const notes = body.notes == null ? null : String(body.notes).slice(0, 2000);

    const questions = await loadQuestions(eventId);
    const normalized = [];
    for (const q of questions) {
      const raw = incoming[q.id];
      const r = normalizeAnswer({ ...q, options: parseOptions(q.type, q.options) }, raw);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      normalized.push({ question_id: q.id, value: r.value });
    }

    // Upsert attendance row, then replace answers
    let attendance = await db
      .prepare('SELECT id FROM event_attendance WHERE event_id = ? AND member_id = ?')
      .get(eventId, memberId);
    if (!attendance) {
      const r = await db
        .prepare('INSERT INTO event_attendance (event_id, member_id, notes) VALUES (?, ?, ?)')
        .run(eventId, memberId, notes);
      attendance = { id: r.lastInsertRowid };
    } else {
      await db
        .prepare('UPDATE event_attendance SET notes = ? WHERE id = ?')
        .run(notes, attendance.id);
    }
    // Wipe + reinsert (simpler than upsert when a question gets dropped)
    await db.prepare('DELETE FROM event_attendance_answers WHERE attendance_id = ?').run(attendance.id);
    for (const a of normalized) {
      await db
        .prepare('INSERT INTO event_attendance_answers (attendance_id, question_id, value) VALUES (?, ?, ?)')
        .run(attendance.id, a.question_id, JSON.stringify(a.value));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  const memberId = request.session.sub;
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });
  await db
    .prepare('DELETE FROM event_attendance WHERE event_id = ? AND member_id = ?')
    .run(eventId, memberId);
  return NextResponse.json({ success: true });
});
