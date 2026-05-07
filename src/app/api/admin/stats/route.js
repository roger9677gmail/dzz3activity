import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export const GET = withAdminAuth(async () => {
  const totalMembers = (await db.prepare("SELECT COUNT(*) as count FROM members WHERE role='member'").get()).count;
  const totalEvents = (await db.prepare("SELECT COUNT(*) as count FROM events WHERE status='active'").get()).count;
  const totalRegistrations = (await db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status != 'cancelled'").get()).count;
  const totalRevenue = (await db.prepare("SELECT SUM(total_amount) as sum FROM registrations WHERE payment_status='paid'").get()).sum || 0;
  const unpaidCount = (await db.prepare("SELECT COUNT(*) as count FROM registrations WHERE payment_status='unpaid' AND status != 'cancelled'").get()).count;

  const eventStats = await db.prepare(`
    SELECT e.id, e.name, e.start_date, e.status, e.banner_color,
      COUNT(r.id) as reg_count,
      SUM(CASE WHEN r.payment_status='paid' THEN 1 ELSE 0 END) as paid_count,
      SUM(CASE WHEN r.payment_status='unpaid' AND r.status != 'cancelled' THEN 1 ELSE 0 END) as unpaid_count,
      SUM(r.total_amount) as total_amount,
      (SELECT COUNT(*) FROM members WHERE role='member') -
        COUNT(CASE WHEN r.status != 'cancelled' THEN 1 END) as unregistered_count
    FROM events e
    LEFT JOIN registrations r ON r.event_id = e.id
    WHERE e.status = 'active'
    GROUP BY e.id
    ORDER BY e.start_date
  `).all();

  return NextResponse.json({
    totalMembers, totalEvents, totalRegistrations, totalRevenue, unpaidCount, eventStats,
  });
});
