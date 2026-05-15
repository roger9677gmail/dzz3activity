// Attendance (活動登記) question types + validation/formatting helpers.

export const QUESTION_TYPES = ['text', 'choice', 'multi_date', 'count', 'checkbox'];

export const TYPE_LABELS = {
  text: '單行文字',
  choice: '單選（可加自訂文字欄位）',
  multi_date: '多選清單（每行一個選項，可填日期或自訂文字）',
  count: '數字',
  checkbox: '是否參加',
};

export function isValidType(t) {
  return QUESTION_TYPES.includes(t);
}

// Defaults for new questions, also useful when admin first picks a type.
export function defaultOptions(type) {
  switch (type) {
    case 'text': return { maxLength: 200 };
    case 'choice': return { choices: ['', ''], allow_text: false, text_label: '備註' };
    case 'multi_date': return { dates: [] };
    case 'count': return { min: 0, max: 99 };
    case 'checkbox': return {};
    default: return {};
  }
}

// Normalize options coming from DB (parse JSON if string) and fill in defaults.
export function parseOptions(type, value) {
  let raw = value;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = null; }
  }
  return { ...defaultOptions(type), ...(raw || {}) };
}

// Validate & normalize a submitted answer for one question.
// Returns { ok, value, error? }
export function normalizeAnswer(question, raw) {
  const opts = parseOptions(question.type, question.options);
  switch (question.type) {
    case 'text': {
      const s = raw == null ? '' : String(raw.text ?? raw).trim();
      if (!s) {
        if (question.required) return { ok: false, error: `「${question.label}」必填` };
        return { ok: true, value: { text: '' } };
      }
      if (opts.maxLength && s.length > opts.maxLength) {
        return { ok: false, error: `「${question.label}」長度超過 ${opts.maxLength} 字` };
      }
      return { ok: true, value: { text: s } };
    }
    case 'choice': {
      const obj = raw && typeof raw === 'object' ? raw : { choice: raw };
      const choice = obj.choice == null ? '' : String(obj.choice).trim();
      const extra = obj.text == null ? '' : String(obj.text).trim();
      if (!choice && !extra) {
        if (question.required) return { ok: false, error: `「${question.label}」必填` };
        return { ok: true, value: { choice: '', text: '' } };
      }
      if (choice && Array.isArray(opts.choices) && opts.choices.length > 0
          && !opts.choices.includes(choice) && choice !== '__other__') {
        return { ok: false, error: `「${question.label}」選項不正確` };
      }
      const allowText = !!opts.allow_text;
      return { ok: true, value: { choice, text: allowText ? extra : '' } };
    }
    case 'multi_date': {
      // Despite the name, this type now accepts any text per option (dates
      // are just one common case). Storage key stays `dates` for back-compat.
      // We deliberately do NOT reject values outside opts.dates — admins
      // sometimes rename options after members submit, and subtle whitespace
      // / unicode differences would otherwise block legitimate submissions.
      // Trim + dedup is enough; the UI ensures the values come from opts.dates.
      const arr = raw && Array.isArray(raw.dates) ? raw.dates : (Array.isArray(raw) ? raw : []);
      const cleaned = [...new Set(arr.map((d) => String(d).trim()).filter(Boolean))];
      if (question.required && cleaned.length === 0) {
        return { ok: false, error: `「${question.label}」至少選一個` };
      }
      return { ok: true, value: { dates: cleaned } };
    }
    case 'count': {
      const num = raw && typeof raw === 'object' ? raw.count : raw;
      if (num == null || num === '') {
        if (question.required) return { ok: false, error: `「${question.label}」必填` };
        return { ok: true, value: { count: 0 } };
      }
      const n = parseInt(num);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: `「${question.label}」需為非負整數` };
      }
      if (opts.min != null && n < opts.min) return { ok: false, error: `「${question.label}」不可低於 ${opts.min}` };
      if (opts.max != null && n > opts.max) return { ok: false, error: `「${question.label}」不可高於 ${opts.max}` };
      return { ok: true, value: { count: n } };
    }
    case 'checkbox': {
      const checked = raw && typeof raw === 'object' ? !!raw.checked : !!raw;
      return { ok: true, value: { checked } };
    }
    default:
      return { ok: false, error: '未知題型' };
  }
}

// Render an answer as human-readable text (for admin list / Excel).
export function formatAnswer(question, value) {
  if (value == null) return '';
  let v = value;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return String(value); }
  }
  switch (question.type) {
    case 'text':    return v.text || '';
    case 'choice':  return [v.choice, v.text].filter(Boolean).join('｜');
    case 'multi_date': return Array.isArray(v.dates) ? v.dates.join('、') : '';
    case 'count':   return v.count != null ? String(v.count) : '';
    case 'checkbox': return v.checked ? '是' : '';
    default: return '';
  }
}

// Validate the OPTIONS payload coming from admin form save.
export function normalizeOptions(type, raw) {
  if (!isValidType(type)) return { ok: false, error: '未知題型' };
  const o = raw && typeof raw === 'object' ? raw : {};
  switch (type) {
    case 'text': {
      const maxLength = parseInt(o.maxLength) || 200;
      if (maxLength < 1 || maxLength > 2000) return { ok: false, error: '長度限制需在 1~2000' };
      return { ok: true, value: { maxLength } };
    }
    case 'choice': {
      const choices = Array.isArray(o.choices)
        ? o.choices.map((c) => String(c).trim()).filter(Boolean)
        : [];
      if (choices.length < 2) return { ok: false, error: '單選需至少 2 個選項' };
      const allow_text = !!o.allow_text;
      const text_label = o.text_label ? String(o.text_label).slice(0, 50) : '';
      return { ok: true, value: { choices, allow_text, text_label } };
    }
    case 'multi_date': {
      // Free-form list: each non-empty trimmed line becomes one option.
      // Order preserved (no sort) so admin can hand-arrange the sequence.
      const items = Array.isArray(o.dates)
        ? o.dates.map((d) => String(d).trim()).filter(Boolean)
        : [];
      const seen = new Set();
      const dates = [];
      for (const it of items) {
        if (!seen.has(it)) { seen.add(it); dates.push(it); }
      }
      if (dates.length < 1) return { ok: false, error: '請至少加入一個選項' };
      return { ok: true, value: { dates } };
    }
    case 'count': {
      const min = o.min == null ? 0 : parseInt(o.min) || 0;
      const max = o.max == null ? 99 : parseInt(o.max) || 99;
      if (max < min) return { ok: false, error: '最大值需 ≥ 最小值' };
      return { ok: true, value: { min, max } };
    }
    case 'checkbox':
      return { ok: true, value: {} };
  }
  return { ok: false, error: '未知題型' };
}
