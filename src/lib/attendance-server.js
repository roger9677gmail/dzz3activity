import db from './db';
import { normalizeAnswer, parseOptions } from './attendance';

export const ATTENDEE_RELATIONS = ['配偶', '子女', '父母', '兄弟姊妹', '其他'];

export async function loadEventQuestions(eventId) {
  const rows = await db
    .prepare(
      `SELECT id, label, type, options, required, sort_order
         FROM event_attendance_questions
        WHERE event_id = ? AND active = 1
        ORDER BY sort_order, id`
    )
    .all(eventId);
  return rows.map((q) => ({ ...q, options: parseOptions(q.type, q.options) }));
}

export async function loadEntriesForMember(eventId, memberId) {
  const entries = await db
    .prepare(
      `SELECT id, attendee_name, attendee_relation, notes, created_at, updated_at
         FROM event_attendance
        WHERE event_id = ? AND member_id = ?
        ORDER BY (attendee_name IS NOT NULL), id`
    )
    .all(eventId, memberId);
  for (const e of entries) e.answers = {};
  if (entries.length > 0) {
    const ids = entries.map((e) => e.id);
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db
      .prepare(
        `SELECT attendance_id, question_id, value
           FROM event_attendance_answers
          WHERE attendance_id IN (${placeholders})`
      )
      .all(...ids);
    const byId = new Map(entries.map((e) => [e.id, e]));
    for (const r of rows) {
      let v = r.value;
      if (typeof v === 'string') {
        try { v = JSON.parse(v); } catch {}
      }
      const entry = byId.get(r.attendance_id);
      if (entry) entry.answers[r.question_id] = v;
    }
  }
  return entries;
}

export function validateAttendeeFields(body) {
  const rawName = body?.attendee_name;
  let attendee_name = null;
  let attendee_relation = null;
  if (rawName != null && String(rawName).trim() !== '') {
    attendee_name = String(rawName).trim().slice(0, 100);
    const rel = body?.attendee_relation;
    if (rel == null || String(rel).trim() === '') {
      return { ok: false, error: '請選擇親友關係' };
    }
    attendee_relation = String(rel).trim().slice(0, 20);
  }
  return { ok: true, attendee_name, attendee_relation };
}

export function buildNormalizedAnswers(questions, incoming) {
  const ans = incoming && typeof incoming === 'object' ? incoming : {};
  const normalized = [];
  for (const q of questions) {
    const r = normalizeAnswer(q, ans[q.id]);
    if (!r.ok) return { ok: false, error: r.error };
    normalized.push({ question_id: q.id, value: r.value });
  }
  return { ok: true, normalized };
}

export async function insertAnswers(attendanceId, normalized) {
  for (const a of normalized) {
    await db
      .prepare('INSERT INTO event_attendance_answers (attendance_id, question_id, value) VALUES (?, ?, ?)')
      .run(attendanceId, a.question_id, JSON.stringify(a.value));
  }
}
