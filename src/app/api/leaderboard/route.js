import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { RANKING_PERIOD_DAYS, daysAgoDateString, todayDateString } from '@/lib/practices';

const TOP_N = 20;

// /api/leaderboard?practice_id=<id>&scope=all|location
//   period: fixed at last 90 days; metric: SUM(value) per member.
export const GET = withAuth(async (request) => {
  const memberId = request.session.sub;
  const { searchParams } = new URL(request.url);
  const practiceId = parseInt(searchParams.get('practice_id') || '0');
  const scope = searchParams.get('scope') === 'location' ? 'location' : 'all';
  if (!practiceId) return NextResponse.json({ error: '請指定 practice_id' }, { status: 400 });

  const practice = await db
    .prepare('SELECT id, name, type, unit_label FROM practices WHERE id = ?')
    .get(practiceId);
  if (!practice) return NextResponse.json({ error: '功課不存在' }, { status: 404 });

  const from = daysAgoDateString(RANKING_PERIOD_DAYS - 1);
  const to = todayDateString();

  let locationId = null;
  if (scope === 'location') {
    const me = await db.prepare('SELECT location_id FROM members WHERE id = ?').get(memberId);
    locationId = me?.location_id || null;
  }

  const where = ['l.practice_id = ?', 'l.log_date BETWEEN ? AND ?', 'm.is_disabled = 0'];
  const args = [practiceId, from, to];
  if (scope === 'location') {
    if (!locationId) {
      return NextResponse.json({
        practice,
        scope,
        rows: [],
        myRank: null,
        myTotal: 0,
        message: '您尚未設定所屬道場',
      });
    }
    where.push('m.location_id = ?');
    args.push(locationId);
  }

  // Aggregate per member, then rank.
  const allRows = await db
    .prepare(
      `SELECT m.id AS member_id, m.name AS member_name, m.avatar AS member_avatar,
              loc.name AS location_name,
              SUM(l.value) AS total
         FROM practice_logs l
         JOIN members m ON m.id = l.member_id
    LEFT JOIN locations loc ON loc.id = m.location_id
        WHERE ${where.join(' AND ')}
        GROUP BY m.id
        ORDER BY total DESC, m.id`
    )
    .all(...args);

  const ranked = allRows.map((r, idx) => ({ ...r, rank: idx + 1, total: Number(r.total) }));
  const top = ranked.slice(0, TOP_N);
  const me = ranked.find((r) => Number(r.member_id) === Number(memberId));

  return NextResponse.json({
    practice,
    scope,
    period: { from, to, days: RANKING_PERIOD_DAYS },
    rows: top,
    myRank: me?.rank || null,
    myTotal: me?.total || 0,
    totalParticipants: ranked.length,
  });
});
