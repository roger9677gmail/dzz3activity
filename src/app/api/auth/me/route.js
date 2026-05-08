import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';

const ME_QUERY = `
  SELECT m.id, m.name, m.phone, m.email, m.role, m.avatar, m.created_at,
         m.location_id, m.address,
         l.name AS location_name
  FROM members m
  LEFT JOIN locations l ON l.id = m.location_id
  WHERE m.id = ?
`;

export async function GET() {
  const session = await getSession(false);
  if (!session) return NextResponse.json({ user: null });

  const member = await db.prepare(ME_QUERY).get(session.sub);
  if (!member) return NextResponse.json({ user: null });
  return NextResponse.json({ user: member });
}

export async function PUT(request) {
  const session = await getSession(false);
  if (!session) return NextResponse.json({ error: '請先登入' }, { status: 401 });

  try {
    const { name, phone, location_id, address, avatar } = await request.json();
    const sets = [];
    const args = [];

    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (!trimmed) return NextResponse.json({ error: '姓名不可為空' }, { status: 400 });
      sets.push('name = ?');
      args.push(trimmed);
    }
    if (phone !== undefined) {
      const v = phone === null || phone === '' ? null : String(phone).trim();
      sets.push('phone = ?');
      args.push(v);
    }
    if (location_id !== undefined) {
      const v = location_id === null || location_id === '' ? null : parseInt(location_id);
      if (v !== null && Number.isNaN(v)) {
        return NextResponse.json({ error: '無效的道場 ID' }, { status: 400 });
      }
      sets.push('location_id = ?');
      args.push(v);
    }
    if (address !== undefined) {
      const v = address === null || address === '' ? null : String(address).trim();
      if (v && v.length > 255) {
        return NextResponse.json({ error: '地址過長' }, { status: 400 });
      }
      sets.push('address = ?');
      args.push(v);
    }
    if (avatar !== undefined) {
      const v = avatar === null || avatar === '' ? null : String(avatar);
      if (v) {
        if (!/^data:image\/(png|jpe?g|webp);base64,/.test(v)) {
          return NextResponse.json({ error: '頭像格式不支援' }, { status: 400 });
        }
        // Cap at ~500 KB after base64 (≈ 350 KB raw); the client should resize first.
        if (v.length > 500 * 1024) {
          return NextResponse.json({ error: '頭像檔案過大，請選較小的圖片' }, { status: 413 });
        }
      }
      sets.push('avatar = ?');
      args.push(v);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    }

    args.push(session.sub);
    try {
      await db.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '')) {
        return NextResponse.json({ error: '此電話號碼已被其他帳號使用' }, { status: 409 });
      }
      throw err;
    }

    const user = await db.prepare(ME_QUERY).get(session.sub);
    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
}
