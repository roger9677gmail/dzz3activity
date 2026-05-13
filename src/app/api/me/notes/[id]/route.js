import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

const MAX_CONTENT = 5000;
const MAX_IMAGE = 1_400_000;
const URL_RE = /^https?:\/\/\S+$/i;

export const PUT = withAuth(async (request, { params }) => {
  const memberId = request.session.sub;
  try {
    const id = parseInt(params.id);
    if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    const note = await db.prepare('SELECT id, member_id FROM practice_notes WHERE id = ?').get(id);
    if (!note) return NextResponse.json({ error: '筆記不存在' }, { status: 404 });
    if (Number(note.member_id) !== Number(memberId)) {
      return NextResponse.json({ error: '無權限修改此筆記' }, { status: 403 });
    }

    const body = await request.json();
    const sets = [];
    const args = [];
    if (body.content !== undefined) {
      const text = String(body.content || '').trim();
      if (!text) return NextResponse.json({ error: '請輸入筆記內容' }, { status: 400 });
      if (text.length > MAX_CONTENT) {
        return NextResponse.json({ error: `筆記過長（上限 ${MAX_CONTENT} 字）` }, { status: 400 });
      }
      sets.push('content = ?');
      args.push(text);
    }
    if (body.image !== undefined) {
      if (body.image === null || body.image === '') {
        sets.push('image = ?'); args.push(null);
      } else {
        const v = String(body.image);
        if (!v.startsWith('data:image/')) return NextResponse.json({ error: '圖片格式不正確' }, { status: 400 });
        if (v.length > MAX_IMAGE) return NextResponse.json({ error: '圖片太大，請壓縮後再上傳' }, { status: 400 });
        sets.push('image = ?'); args.push(v);
      }
    }
    if (body.link_url !== undefined) {
      if (body.link_url === null || body.link_url === '') {
        sets.push('link_url = ?'); args.push(null);
      } else {
        const v = String(body.link_url).trim();
        if (!URL_RE.test(v)) return NextResponse.json({ error: '連結需以 http:// 或 https:// 開頭' }, { status: 400 });
        if (v.length > 500) return NextResponse.json({ error: '連結過長' }, { status: 400 });
        sets.push('link_url = ?'); args.push(v);
      }
    }
    if (body.is_public !== undefined) {
      sets.push('is_public = ?');
      args.push(body.is_public ? 1 : 0);
    }
    if (sets.length === 0) return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    args.push(id);
    await db.prepare(`UPDATE practice_notes SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, { params }) => {
  const memberId = request.session.sub;
  const id = parseInt(params.id);
  if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  const note = await db.prepare('SELECT id, member_id FROM practice_notes WHERE id = ?').get(id);
  if (!note) return NextResponse.json({ error: '筆記不存在' }, { status: 404 });
  if (Number(note.member_id) !== Number(memberId)) {
    return NextResponse.json({ error: '無權限刪除此筆記' }, { status: 403 });
  }
  await db.prepare('DELETE FROM practice_notes WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
});
