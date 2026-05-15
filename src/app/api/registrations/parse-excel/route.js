import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export const dynamic = 'force-dynamic';

// Normalize a cell value to a trimmed string. Excel cells can be number, Date,
// rich-text, formula result, etc.
function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((x) => x.text || '').join('').trim();
    if (v.text != null) return String(v.text).trim();
    if (v.result != null) return String(v.result).trim();
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

function cellNumber(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v.result != null) return Number(v.result) || 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// Match a header label to one of the known column roles.
function detectColumn(header) {
  const s = String(header || '').replace(/\s|（|）|\(|\)/g, '');
  if (s.includes('功德主') || s.includes('陽上')) return 'name';
  if (s.includes('超度') || s.includes('超渡')) return 'content';
  if (s === '金額' || s.includes('金額')) return 'amount';
  if (s === '項目' || s === '法會項目') return 'item';
  if (s.includes('收據抬頭')) return 'receipt_title';
  return null;
}

export const POST = withAuth(async (request) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const eventId = parseInt(formData.get('eventId'));

    if (!file || !eventId) {
      return NextResponse.json({ error: '請選擇檔案並指定活動' }, { status: 400 });
    }
    if (typeof file === 'string') {
      return NextResponse.json({ error: '請選擇檔案' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: '檔案過大（限 5 MB）' }, { status: 400 });
    }

    const event = await db.prepare("SELECT * FROM events WHERE id = ? AND status = 'active'").get(eventId);
    if (!event) return NextResponse.json({ error: '活動不存在或已結束' }, { status: 400 });
    if (new Date(event.registration_deadline) < new Date()) {
      return NextResponse.json({ error: '報名截止日期已過' }, { status: 400 });
    }

    const eventItems = await db.prepare(
      'SELECT id, name, price, allow_custom_price, requires_name, requires_content FROM event_items WHERE event_id = ?'
    ).all(eventId);

    if (eventItems.length === 0) {
      return NextResponse.json({ error: '此活動尚未設定報名項目' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer);
    } catch {
      return NextResponse.json({ error: '無法解析 Excel 檔案，請確認格式為 .xlsx' }, { status: 400 });
    }

    const ws = wb.worksheets[0];
    if (!ws || ws.rowCount < 2) {
      return NextResponse.json({ error: 'Excel 中沒有資料' }, { status: 400 });
    }

    // Detect column positions from the header row (row 1).
    const columnMap = {};
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNum) => {
      const role = detectColumn(cellText(cell.value));
      if (role && !columnMap[role]) columnMap[role] = colNum;
    });

    if (!columnMap.item) {
      return NextResponse.json({
        error: 'Excel 必須包含「項目」欄位',
      }, { status: 400 });
    }

    // Build event_item lookup: exact name → item, plus case-insensitive fallback.
    const itemByName = new Map();
    const itemByNameLc = new Map();
    for (const ei of eventItems) {
      const n = String(ei.name).trim();
      itemByName.set(n, ei);
      itemByNameLc.set(n.toLowerCase(), ei);
    }

    const result = {
      selectedItems: {},
      names: {},
      contents: {},
      customPrices: {},
      receiptTitles: {},
    };
    const unmatchedItems = new Map(); // name → count
    let parsedRows = 0;
    let skippedRows = 0;

    for (let i = 2; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      const itemNameStr = cellText(row.getCell(columnMap.item).value);
      if (!itemNameStr) continue;

      const ei = itemByName.get(itemNameStr) || itemByNameLc.get(itemNameStr.toLowerCase());
      if (!ei) {
        unmatchedItems.set(itemNameStr, (unmatchedItems.get(itemNameStr) || 0) + 1);
        skippedRows++;
        continue;
      }

      const sponsorName = columnMap.name ? cellText(row.getCell(columnMap.name).value) : '';
      const content = columnMap.content ? cellText(row.getCell(columnMap.content).value) : '';
      const amount = columnMap.amount ? cellNumber(row.getCell(columnMap.amount).value) : 0;
      const receiptTitle = columnMap.receipt_title ? cellText(row.getCell(columnMap.receipt_title).value) : '';

      const itemId = ei.id;
      result.selectedItems[itemId] = (result.selectedItems[itemId] || 0) + 1;
      result.names[itemId] = result.names[itemId] || [];
      result.contents[itemId] = result.contents[itemId] || [];
      result.receiptTitles[itemId] = result.receiptTitles[itemId] || [];
      result.names[itemId].push(sponsorName);
      result.contents[itemId].push(content);
      result.receiptTitles[itemId].push(receiptTitle);

      if (ei.allow_custom_price) {
        result.customPrices[itemId] = result.customPrices[itemId] || [];
        result.customPrices[itemId].push(amount > 0 ? String(Math.round(amount)) : '');
      }
      parsedRows++;
    }

    if (parsedRows === 0) {
      const summary = Array.from(unmatchedItems.entries())
        .map(([n, c]) => `「${n}」×${c}`).join('、');
      return NextResponse.json({
        error: summary
          ? `Excel 中沒有可匯入的資料；找不到對應的項目：${summary}`
          : 'Excel 中沒有可匯入的資料',
      }, { status: 400 });
    }

    const warnings = [];
    for (const [name, count] of unmatchedItems.entries()) {
      warnings.push(`「${name}」找不到對應項目，已略過 ${count} 筆`);
    }

    return NextResponse.json({ data: result, warnings, parsedRows, skippedRows });
  } catch (err) {
    console.error('POST /api/registrations/parse-excel failed:', err);
    return NextResponse.json({ error: err.message || '解析失敗' }, { status: 500 });
  }
});
