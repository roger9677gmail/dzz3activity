import db from './db';

export async function loadAnnouncement(id) {
  const row = await db
    .prepare(
      `SELECT a.id, a.title, a.content, a.image, a.link_url, a.attachment_url, a.attachment_name,
              a.pinned, a.starts_at, a.ends_at, a.created_by, a.created_at, a.updated_at,
              m.name AS created_by_name
         FROM announcements a
         LEFT JOIN members m ON m.id = a.created_by
        WHERE a.id = ?`
    )
    .get(id);
  if (!row) return null;
  const gs = await db
    .prepare(
      `SELECT g.id AS group_id, g.name, g.color
         FROM announcement_groups ag
         JOIN member_groups g ON g.id = ag.group_id
        WHERE ag.announcement_id = ?
        ORDER BY g.sort_order, g.id`
    )
    .all(id);
  row.groups = gs;
  return row;
}

const URL_MAX = 500;

export function parseDateTime(v) {
  if (v == null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export function validateImage(v, maxLen = 500 * 1024) {
  if (v == null || v === '') return { ok: true, value: null };
  const s = String(v);
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(s)) return { ok: false, error: '圖片格式不支援' };
  if (s.length > maxLen) return { ok: false, error: '圖片過大，請選小一點的圖' };
  return { ok: true, value: s };
}

export function validateUrl(v, label) {
  if (v == null || v === '') return { ok: true, value: null };
  const s = String(v).trim();
  if (s.length > URL_MAX) return { ok: false, error: `${label}過長` };
  if (!/^https?:\/\//i.test(s)) return { ok: false, error: `${label}必須以 http:// 或 https:// 開頭` };
  return { ok: true, value: s };
}
