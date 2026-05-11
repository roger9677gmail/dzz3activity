import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  loadEventQuestions,
  validateAttendeeFields,
  buildNormalizedAnswers,
  insertAnswers,
} from '@/lib/attendance-server';

async function loadOwnedEntry(eventId, attendanceId, memberId) {
  const row = await db
    .prepare(
      'SELECT id, event_id, member_id, attendee_name FROM event_attendance WHERE id = ?'
    )
    .get(attendanceId);
  if (!row) return { error: '登記不存在', status: 404 };
  if (row.event_id !== eventId) return { error: '活動不符', status: 400 };
  if (row.member_id !== memberId) return { error: '無權限修改此筆登記', status: 403 };
  return { row };
}

export const PUT = withAuth(async (request, { params }) => {
  try {
    const eventId = parseInt(params.eventId);
    const attendanceId = parseInt(params.attendanceId);
    const memberId = request.session.sub;
    if (!eventId || !attendanceId) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    }
    const owned = await loadOwnedEntry(eventId, attendanceId, memberId);
    if (owned.error) return NextResponse.json({ error: owned.error }, { status: owned.status });

    const body = await request.json();
    const f = validateAttendeeFields(body);
    if (!f.ok) return NextResponse.json({ error: f.error }, { status: 400 });

    // If this entry is being set as "本人" (attendee_name=NULL) ensure no other
    // self entry exists for this member+event.
    if (f.attendee_name == null) {
      const other = await db
        .prepare(
          'SELECT id FROM event_attendance WHERE event_id = ? AND member_id = ? AND attendee_name IS NULL AND id != ?'
        )
        .get(eventId, memberId, attendanceId);
      if (other) {
        return NextResponse.json({ error: '本人已有登記' }, { status: 409 });
      }
    }

    const questions = await loadEventQuestions(eventId);
    const ans = buildNormalizedAnswers(questions, body.answers);
    if (!ans.ok) return NextResponse.json({ error: ans.error }, { status: 400 });

    const notes = body.notes == null ? null : String(body.notes).slice(0, 2000);

    // Atomic: re-lock the uniqueness check inside the tx so a concurrent POST
    // can't race ahead of us and steal the "本人" slot.
    const result = await db.transaction(async (tx) => {
      if (f.attendee_name == null) {
        const other = await tx
          .prepare(
            'SELECT id FROM event_attendance WHERE event_id = ? AND member_id = ? AND attendee_name IS NULL AND id != ? FOR UPDATE'
          )
          .get(eventId, memberId, attendanceId);
        if (other) return { conflict: true };
      }
      await tx
        .prepare(
          'UPDATE event_attendance SET attendee_name = ?, attendee_relation = ?, notes = ? WHERE id = ?'
        )
        .run(f.attendee_name, f.attendee_relation, notes, attendanceId);
      await tx
        .prepare('DELETE FROM event_attendance_answers WHERE attendance_id = ?')
        .run(attendanceId);
      await insertAnswers(attendanceId, ans.normalized, tx);
      return {};
    });

    if (result.conflict) {
      return NextResponse.json({ error: '本人已有登記' }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  const attendanceId = parseInt(params.attendanceId);
  const memberId = request.session.sub;
  if (!eventId || !attendanceId) {
    return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  }
  const owned = await loadOwnedEntry(eventId, attendanceId, memberId);
  if (owned.error) return NextResponse.json({ error: owned.error }, { status: owned.status });

  await db.prepare('DELETE FROM event_attendance WHERE id = ?').run(attendanceId);
  return NextResponse.json({ success: true });
});
