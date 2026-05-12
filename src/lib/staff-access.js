import db from './db';

// Returns true if the caller is staff for this event OR is a system admin.
// Used to gate staff-only data (registration / attendance lists + exports).
export async function isStaffOrAdmin(session, eventId) {
  if (!session) return false;
  if (session.is_admin) return true;
  const row = await db
    .prepare('SELECT 1 FROM event_staff WHERE event_id = ? AND member_id = ? LIMIT 1')
    .get(eventId, session.sub);
  return !!row;
}
