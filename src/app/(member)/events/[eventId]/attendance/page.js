import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { loadEventQuestions, loadEntriesForMember, ATTENDEE_RELATIONS } from '@/lib/attendance-server';
import AttendanceFormClient from './AttendanceFormClient';

export const dynamic = 'force-dynamic';

export default async function MemberAttendancePage({ params }) {
  const session = await getSession();
  const memberId = session.sub;
  const eventId = parseInt(params.eventId);
  const event = await db
    .prepare('SELECT id, name, start_date, end_date, registration_deadline, banner_color FROM events WHERE id = ?')
    .get(eventId);
  if (!event) notFound();

  const questions = await loadEventQuestions(eventId);
  const entries = await loadEntriesForMember(eventId, memberId);

  return (
    <AttendanceFormClient
      event={event}
      questions={questions}
      entries={entries}
      relations={ATTENDEE_RELATIONS}
    />
  );
}
