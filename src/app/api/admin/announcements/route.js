import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { parseDateTime, validateImage, validateUrl } from '@/lib/announcements';

const MAX_TITLE = 200;

export const GET = withPermission('announcements:manage', async () => {
  const rows = await db
    .prepare(
      `SELECT a.id, a.title, a.pinned, a.starts_at, a.ends_at, a.created_at, a.updated_at,
              m.name AS created_by_name
         FROM announcements a
         LEFT JOIN members m ON m.id = a.created_by
        ORDER BY a.pinned DESC, a.created_at DESC`
    )
    .all();
  for (const r of rows) {
    r.groups = await db
      .prepare(
        `SELECT g.id, g.name, g.color
           FROM announcement_groups ag JOIN member_groups g ON g.id = ag.group_id
          WHERE ag.announcement_id = ?
          ORDER BY g.sort_order, g.id`
      )
      .all(r.id);
  }
  return NextResponse.json({ announcements: rows });
});

export const POST = withPermission('announcements:manage', async (request) => {
  try {
    const body = await request.json();
    const title = String(body.title || '').trim();
    if (!title) return NextResponse.json({ error: '請填寫標題' }, { status: 400 });
    if (title.length > MAX_TITLE) return NextResponse.json({ error: '標題過長' }, { status: 400 });
    const content = body.content == null ? null : String(body.content);

    const img = validateImage(body.image);
    if (!img.ok) return NextResponse.json({ error: img.error }, { status: 400 });
    const link = validateUrl(body.link_url, '外連連結');
    if (!link.ok) return NextResponse.json({ error: link.error }, { status: 400 });
    const att = validateUrl(body.attachment_url, '附件連結');
    if (!att.ok) return NextResponse.json({ error: att.error }, { status: 400 });
    const attName = body.attachment_name == null || body.attachment_name === ''
      ? null
      : String(body.attachment_name).trim().slice(0, 255);

    const startsAt = parseDateTime(body.starts_at);
    if (startsAt === undefined) return NextResponse.json({ error: '生效時間格式錯誤' }, { status: 400 });
    const endsAt = parseDateTime(body.ends_at);
    if (endsAt === undefined) return NextResponse.json({ error: '失效時間格式錯誤' }, { status: 400 });
    if (startsAt && endsAt && endsAt < startsAt) {
      return NextResponse.json({ error: '失效時間不可早於生效時間' }, { status: 400 });
    }

    const groupIds = Array.isArray(body.group_ids)
      ? [...new Set(body.group_ids.map((g) => parseInt(g)).filter((n) => Number.isInteger(n) && n > 0))]
      : [];
    if (groupIds.length === 0) {
      return NextResponse.json({ error: '請至少選擇一個群組' }, { status: 400 });
    }
    const placeholders = groupIds.map(() => '?').join(',');
    const found = await db
      .prepare(`SELECT id FROM member_groups WHERE id IN (${placeholders})`)
      .all(...groupIds);
    if (found.length !== groupIds.length) {
      return NextResponse.json({ error: '指定的群組不存在' }, { status: 400 });
    }

    const r = await db
      .prepare(
        `INSERT INTO announcements
           (title, content, image, link_url, attachment_url, attachment_name,
            pinned, starts_at, ends_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title, content, img.value, link.value, att.value, attName,
        body.pinned ? 1 : 0, startsAt, endsAt, request.session.sub
      );
    const annId = r.lastInsertRowid;
    for (const gid of groupIds) {
      await db
        .prepare('INSERT INTO announcement_groups (announcement_id, group_id) VALUES (?, ?)')
        .run(annId, gid);
    }
    return NextResponse.json({ success: true, id: annId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
