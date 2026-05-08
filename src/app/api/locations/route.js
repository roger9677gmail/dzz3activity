import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const locations = await db.prepare(
    'SELECT id, name FROM locations WHERE active = 1 ORDER BY sort_order, id'
  ).all();
  return NextResponse.json({ locations });
}
