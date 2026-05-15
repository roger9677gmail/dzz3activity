import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { loadAnnouncement, parseDateTime, validateImage, validateUrl } from '@/lib/announcements';

const MAX_TITLE = 200;

export const GET = withPermission('announcements:manage', async (request, { params }) => {
  const id = parseInt(params.id);
  if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  const a = await loadAnnouncement(id);
  if (!a) return NextResponse.json({ error: '公告不存在' }, { status: 404 });
  return NextResponse.json({ announcement: a });
});

export const PUT = withPermission('announcements:manage', async (request, { params }) => {
  try {
    const id = parseInt(params.id);
    if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    const a = await db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
    if (!a) return NextResponse.json({ error: '公告不存在' }, { status: 404 });

    const body = await request.json();
    const sets = [];
    const args = [];

    if (body.title !== undefined) {
      const t = String(body.title || '').trim();
      if (!t) return NextResponse.json({ error: '標題不可為空' }, { status: 400 });
      if (t.length > MAX_TITLE) return NextResponse.json({ error: '標題過長' }, { status: 400 });
      sets.push('title = ?'); args.push(t);
    }
    if (body.content !== undefined) {
      sets.push('content = ?'); args.push(body.content == null ? null : String(body.content));
    }
    if (body.image !== undefined) {
      const v = validateImage(body.image);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      sets.push('image = ?'); args.push(v.value);
    }
    if (body.link_url !== undefined) {
      const v = validateUrl(body.link_url, '外連連結');
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      sets.push('link_url = ?'); args.push(v.value);
    }
    if (body.attachment_url !== undefined) {
      const v = validateUrl(body.attachment_url, '附件連結');
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      sets.push('attachment_url = ?'); args.push(v.value);
    }
    if (body.attachment_name !== undefined) {
      const n = body.attachment_name == null || body.attachment_name === ''
        ? null
        : String(body.attachment_name).trim().slice(0, 255);
      sets.push('attachment_name = ?'); args.push(n);
    }
    if (body.pinned !== undefined) {
      sets.push('pinned = ?'); args.push(body.pinned ? 1 : 0);
    }
    if (body.starts_at !== undefined) {
      const v = parseDateTime(body.starts_at);
      if (v === undefined) return NextResponse.json({ error: '生效時間格式錯誤' }, { status: 400 });
      sets.push('starts_at = ?'); args.push(v);
    }
    if (body.ends_at !== undefined) {
      const v = parseDateTime(body.ends_at);
      if (v === undefined) return NextResponse.json({ error: '失效時間格式錯誤' }, { status: 400 });
      sets.push('ends_at = ?'); args.push(v);
    }

    // Cross-field check for the resulting window
    const cur = await db.prepare('SELECT starts_at, ends_at FROM announcements WHERE id = ?').get(id);
    const sIdx = sets.indexOf('starts_at = ?');
    const eIdx = sets.indexOf('ends_at = ?');
    const newStart = sIdx >= 0 ? args[sIdx] : cur.starts_at;
    const newEnd = eIdx >= 0 ? args[eIdx] : cur.ends_at;
    if (newStart && newEnd && new Date(newEnd) < new Date(newStart)) {
      return NextResponse.json({ error: '失效時間不可早於生效時間' }, { status: 400 });
    }

    const groupIds = Array.isArray(body.group_ids)
      ? [...new Set(body.group_ids.map((g) => parseInt(g)).filter((n) => Number.isInteger(n) && n > 0))]
      : null;
    if (groupIds !== null && groupIds.length === 0) {
      return NextResponse.json({ error: '請至少選擇一個群組' }, { status: 400 });
    }
    if (groupIds && groupIds.length > 0) {
      const placeholders = groupIds.map(() => '?').join(',');
      const found = await db
        .prepare(`SELECT id FROM member_groups WHERE id IN (${placeholders})`)
        .all(...groupIds);
      if (found.length !== groupIds.length) {
        return NextResponse.json({ error: '指定的群組不存在' }, { status: 400 });
      }
    }

    if (sets.length === 0 && groupIds === null) {
      return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    }

    if (sets.length > 0) {
      args.push(id);
      await db.prepare(`UPDATE announcements SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    }
    if (groupIds !== null) {
      await db.prepare('DELETE FROM announcement_groups WHERE announcement_id = ?').run(id);
      for (const gid of groupIds) {
        await db
          .prepare('INSERT INTO announcement_groups (announcement_id, group_id) VALUES (?, ?)')
          .run(id, gid);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withPermission('announcements:manage', async (request, { params }) => {
  const id = parseInt(params.id);
  if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  await db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
});
