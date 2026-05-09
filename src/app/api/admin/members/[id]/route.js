import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

// PATCH: edit member basic info AND/OR toggle suspension.
// Body fields (all optional): name, phone, location_id, address, is_disabled
// Admin accounts (is_admin=1) can be edited here too, but suspending an admin
// requires `admins:manage` and is blocked here to keep paths separate.
export const PATCH = withPermission('members:manage', async (request, { params }) => {
  try {
    const id = parseInt(params.id);
    if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    if (Number(request.session.sub) === id) {
      return NextResponse.json({ error: '不能編輯或停用自己的帳號' }, { status: 400 });
    }
    const target = await db.prepare('SELECT id, is_admin FROM members WHERE id = ?').get(id);
    if (!target) return NextResponse.json({ error: '師兄姐不存在' }, { status: 404 });

    const body = await request.json();
    const sets = [];
    const args = [];

    if (body.name !== undefined) {
      const trimmed = String(body.name || '').trim();
      if (!trimmed) return NextResponse.json({ error: '姓名不可為空' }, { status: 400 });
      if (trimmed.length > 100) return NextResponse.json({ error: '姓名過長' }, { status: 400 });
      sets.push('name = ?');
      args.push(trimmed);
    }
    if (body.phone !== undefined) {
      const v = body.phone === null || body.phone === '' ? null : String(body.phone).trim();
      sets.push('phone = ?');
      args.push(v);
    }
    if (body.location_id !== undefined) {
      const v = body.location_id === null || body.location_id === '' ? null : parseInt(body.location_id);
      if (v !== null && Number.isNaN(v)) {
        return NextResponse.json({ error: '無效的道場 ID' }, { status: 400 });
      }
      sets.push('location_id = ?');
      args.push(v);
    }
    if (body.address !== undefined) {
      const v = body.address === null || body.address === '' ? null : String(body.address).trim();
      if (v && v.length > 255) return NextResponse.json({ error: '地址過長' }, { status: 400 });
      sets.push('address = ?');
      args.push(v);
    }
    if (body.is_disabled !== undefined) {
      if (target.is_admin) {
        return NextResponse.json({ error: '不能停用管理員，請先撤銷管理員權限' }, { status: 400 });
      }
      sets.push('is_disabled = ?');
      args.push(body.is_disabled ? 1 : 0);
    }

    if (sets.length === 0) return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    args.push(id);

    try {
      await db.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '')) {
        return NextResponse.json({ error: '此電話號碼已被其他帳號使用' }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
