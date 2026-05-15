import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

// DELETE a single staff assignment row.
export const DELETE = withPermission('events:manage', async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  const staffId = parseInt(params.staffId);
  if (!eventId || !staffId) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  await db
    .prepare('DELETE FROM event_staff WHERE id = ? AND event_id = ?')
    .run(staffId, eventId);
  return NextResponse.json({ success: true });
});
