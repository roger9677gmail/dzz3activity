import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { syncMirrorGroup } from '@/lib/group-sync';

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

    // group_ids handled separately below.
    const groupIds = Array.isArray(body.group_ids) ? body.group_ids : null;

    if (sets.length === 0 && groupIds === null) {
      return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    }

    if (sets.length > 0) {
      args.push(id);
      try {
        await db.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`).run(...args);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '')) {
          return NextResponse.json({ error: '此電話號碼已被其他帳號使用' }, { status: 409 });
        }
        throw err;
      }
    }

    if (groupIds !== null) {
      const cleanIds = [...new Set(groupIds.map((g) => parseInt(g)).filter((n) => Number.isInteger(n) && n > 0))];
      // Validate IDs exist and filter out mirror groups (those are auto-managed
      // from members.location_id and can't be hand-picked by admin).
      let nonMirrorIds = [];
      if (cleanIds.length > 0) {
        const placeholders = cleanIds.map(() => '?').join(',');
        const rows = await db
          .prepare(`SELECT id, location_id FROM member_groups WHERE id IN (${placeholders})`)
          .all(...cleanIds);
        if (rows.length !== cleanIds.length) {
          return NextResponse.json({ error: '指定的群組不存在' }, { status: 400 });
        }
        nonMirrorIds = rows.filter((r) => !r.location_id).map((r) => r.id);
      }
      // Replace only the non-mirror assignments; keep the mirror one untouched
      // (it will be re-synced below if location_id changed).
      await db
        .prepare(
          `DELETE mga FROM member_group_assignments mga
             JOIN member_groups g ON g.id = mga.group_id
            WHERE mga.member_id = ? AND g.location_id IS NULL`
        )
        .run(id);
      for (const gid of nonMirrorIds) {
        await db
          .prepare('INSERT INTO member_group_assignments (member_id, group_id) VALUES (?, ?)')
          .run(id, gid);
      }
    }

    // Sync mirror group if location_id was touched.
    if (sets.some((s) => s.startsWith('location_id'))) {
      try { await syncMirrorGroup(id); }
      catch (err) { console.error('mirror sync failed:', err); }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
