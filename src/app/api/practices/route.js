import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

// Any signed-in user can read the active practice catalogue.
export const GET = withAuth(async () => {
  const practices = await db
    .prepare(
      'SELECT id, name, type, unit_label, sort_order FROM practices WHERE active = 1 ORDER BY sort_order, id'
    )
    .all();
  return NextResponse.json({ practices });
});
