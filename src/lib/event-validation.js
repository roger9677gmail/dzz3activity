// Server-side validation for event create/update payloads. Returns either
// { ok: true, value: <normalized fields> } or { ok: false, error: <msg> }
// so route handlers can return a clean 400 without scattering the same
// regex / Date checks across two endpoints.
import { sanitizeAdminUrl } from './utils';

// Accept either MySQL DATETIME 'YYYY-MM-DD HH:mm[:ss]' or HTML5
// datetime-local 'YYYY-MM-DDTHH:mm'. Both parse via new Date() once we
// canonicalize the separator.
function parseEventDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.replace(' ', 'T');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function validateEventPayload(body) {
  const name = body?.name ? String(body.name).trim() : '';
  if (!name) return { ok: false, error: '活動名稱為必填' };

  const start = parseEventDate(body?.start_date);
  const end = parseEventDate(body?.end_date);
  const deadline = parseEventDate(body?.registration_deadline);
  if (!start) return { ok: false, error: '開始時間格式不正確' };
  if (!end) return { ok: false, error: '結束時間格式不正確' };
  if (!deadline) return { ok: false, error: '報名截止時間格式不正確' };
  if (end < start) return { ok: false, error: '結束時間不可早於開始時間' };
  if (deadline > start) {
    return { ok: false, error: '報名截止時間必須在開始時間之前（含同一刻）' };
  }

  let mapUrl = null;
  try {
    mapUrl = sanitizeAdminUrl(body?.map_url, { fieldName: 'Google 地圖連結' });
  } catch (err) {
    return { ok: false, error: err.message || 'Google 地圖連結無效' };
  }

  const status = ['active', 'draft', 'closed'].includes(body?.status)
    ? body.status
    : 'active';

  return {
    ok: true,
    value: {
      name,
      description: body?.description ? String(body.description) : null,
      start_date: body.start_date,
      end_date: body.end_date,
      registration_deadline: body.registration_deadline,
      location: body?.location ? String(body.location).trim() || null : null,
      map_url: mapUrl,
      status,
      banner_color: body?.banner_color || '#8B1A1A',
    },
  };
}
