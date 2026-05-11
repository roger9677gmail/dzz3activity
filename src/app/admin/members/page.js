import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import Link from 'next/link';
import AdminMembersClient from './AdminMembersClient';

export const dynamic = 'force-dynamic';

export default async function AdminMembersPage({ searchParams }) {
  const session = await getSession();
  if (!hasPermission(session, 'members:manage')) redirect('/admin');

  const search = searchParams.search || '';
  const showDisabled = searchParams.disabled === '1';
  const groupId = searchParams.group_id ? parseInt(searchParams.group_id) : null;

  const locations = await db
    .prepare('SELECT id, name FROM locations WHERE active=1 ORDER BY sort_order, id')
    .all();
  const allGroups = await db
    .prepare(
      'SELECT id, name, color, sort_order, location_id FROM member_groups WHERE active=1 ORDER BY (location_id IS NULL), sort_order, id'
    )
    .all();

  const disabledFilter = showDisabled ? '' : 'AND m.is_disabled = 0';
  const groupFilter = groupId
    ? `AND EXISTS (SELECT 1 FROM member_group_assignments mga
                    WHERE mga.member_id = m.id AND mga.group_id = ?)`
    : '';
  const args = [];
  if (groupId) args.push(groupId);
  if (search) args.push(`%${search}%`, `%${search}%`);

  const members = await db.prepare(`
    SELECT m.id, m.name, m.phone, m.email, m.address, m.location_id, m.is_disabled, m.is_admin, m.created_at,
           l.name AS location_name,
      (SELECT COUNT(*) FROM registrations r WHERE r.member_id = m.id AND r.status != 'cancelled') as reg_count
    FROM members m
    LEFT JOIN locations l ON l.id = m.location_id
    WHERE 1=1
      ${disabledFilter}
      ${groupFilter}
      ${search ? "AND (m.name LIKE ? OR m.phone LIKE ?)" : ""}
    ORDER BY m.is_admin DESC, m.name
  `).all(...args);

  // Batch-load every member's groups in a single query (avoids N+1).
  if (members.length > 0) {
    const memberIds = members.map((m) => m.id);
    const placeholders = memberIds.map(() => '?').join(',');
    const rows = await db.prepare(`
      SELECT a.member_id, g.id, g.name, g.color, g.location_id, g.sort_order
        FROM member_group_assignments a
        JOIN member_groups g ON g.id = a.group_id
       WHERE a.member_id IN (${placeholders})
       ORDER BY (g.location_id IS NULL), g.sort_order, g.id
    `).all(...memberIds);
    const byMember = new Map();
    for (const r of rows) {
      if (!byMember.has(r.member_id)) byMember.set(r.member_id, []);
      byMember.get(r.member_id).push({
        id: r.id, name: r.name, color: r.color, location_id: r.location_id,
      });
    }
    for (const m of members) m.groups = byMember.get(m.id) || [];
  }

  // Helper to build query string preserving the relevant filters.
  function qs(overrides = {}) {
    const merged = {
      group_id: groupId,
      disabled: showDisabled ? '1' : null,
      search: search || null,
      ...overrides,
    };
    const params = new URLSearchParams();
    if (merged.group_id) params.set('group_id', String(merged.group_id));
    if (merged.disabled) params.set('disabled', merged.disabled);
    if (merged.search) params.set('search', merged.search);
    const s = params.toString();
    return s ? `?${s}` : '';
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">師兄姐管理</h1>
        <span className="text-sm text-gray-500">{members.length} 位</span>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-3">
        {allGroups.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">群組標籤篩選</label>
            <div className="flex flex-wrap gap-2">
              <Link
                href={qs({ group_id: null })}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  !groupId ? 'bg-temple-red text-white border-temple-red' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >全部</Link>
              {allGroups.map((g) => {
                const active = groupId === g.id;
                return (
                  <Link
                    key={g.id}
                    href={qs({ group_id: g.id })}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      active ? 'text-white border-transparent' : 'text-gray-600 bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                    style={active ? { backgroundColor: g.color || '#8B1A1A' } : {}}
                  >
                    {g.location_id != null ? `🏯 ${g.name}` : g.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <form className="flex gap-2 items-center flex-wrap">
          {groupId && <input type="hidden" name="group_id" value={groupId} />}
          <input
            type="text" name="search" defaultValue={search}
            className="input-field text-sm flex-1 min-w-[12rem]"
            placeholder="搜尋姓名或電話..."
          />
          <button type="submit" className="btn-primary text-sm whitespace-nowrap">🔍 搜尋</button>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              name="disabled"
              value="1"
              defaultChecked={showDisabled}
              className="rounded border-gray-300 text-temple-red focus:ring-temple-red"
            />
            含已停用
          </label>
          {search && (
            <Link
              href={qs({ search: null })}
              className="btn-secondary text-sm whitespace-nowrap"
            >清除</Link>
          )}
        </form>
      </div>

      <AdminMembersClient
        members={members}
        locations={locations}
        groups={allGroups}
        canEdit={true}
        emptyMessage="無符合條件的師兄姐"
      />
    </div>
  );
}
