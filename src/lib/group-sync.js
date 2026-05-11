import db from './db';

// Re-aligns a member's mirror-group assignment with their current
// `members.location_id`:
//   - drops any mirror-group (member_groups.location_id NOT NULL) assignments
//     the member currently has
//   - inserts an assignment for the location they're now in (if any)
// Safe to call after any UPDATE that may have changed location_id, and at
// member creation time.
export async function syncMirrorGroup(memberId) {
  if (!memberId) return;
  // Wipe existing mirror assignments
  await db
    .prepare(
      `DELETE mga FROM member_group_assignments mga
         JOIN member_groups g ON g.id = mga.group_id
        WHERE mga.member_id = ? AND g.location_id IS NOT NULL`
    )
    .run(memberId);
  // Insert the current location's mirror group (no-op if member has no location)
  await db
    .prepare(
      `INSERT IGNORE INTO member_group_assignments (member_id, group_id)
         SELECT m.id, g.id
           FROM members m
           JOIN member_groups g ON g.location_id = m.location_id
          WHERE m.id = ?`
    )
    .run(memberId);
}
