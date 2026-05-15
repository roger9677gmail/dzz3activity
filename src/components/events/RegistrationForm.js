'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, safeParseJSON } from '@/lib/utils';

function safeParseArray(v) {
  const p = safeParseJSON(v, []);
  return Array.isArray(p) ? p : [];
}

// Reconstruct form state from a saved registration so the user can edit it.
// Each registration_item contributes (quantity) entries to the per-unit arrays;
// when a single event_item has multiple registration_items (different receipt
// titles), they are concatenated in DB order.
function buildInitialFromRegistration(reg, eventItems) {
  const init = {
    selectedItems: {}, names: {}, contents: {}, customPrices: {},
    giftNames: {}, giftContents: {},
    receiptTitles: {}, giftReceiptTitles: {},
  };
  if (!reg || !Array.isArray(reg.items)) return init;
  const registeredParentIds = new Set(
    reg.items.filter((r) => !r.is_gift).map((r) => Number(r.event_item_id))
  );
  for (const ri of reg.items) {
    const ei = eventItems.find((e) => Number(e.id) === Number(ri.event_item_id));
    if (!ei) continue;
    const ns = safeParseArray(ri.names);
    const cs = safeParseArray(ri.contents);
    const rt = ri.receipt_title || '';
    if (ri.is_gift) {
      const matchingParents = eventItems.filter(
        (e) => Number(e.gift_event_item_id) === Number(ri.event_item_id) && (e.gift_quantity || 0) > 0
      );
      const parent =
        matchingParents.find((e) => registeredParentIds.has(Number(e.id))) ||
        matchingParents[0];
      if (!parent) continue;
      init.giftNames[parent.id] = (init.giftNames[parent.id] || []).concat(ns);
      init.giftContents[parent.id] = (init.giftContents[parent.id] || []).concat(cs);
      if (!init.giftReceiptTitles[parent.id]) init.giftReceiptTitles[parent.id] = rt;
      continue;
    }
    const id = ri.event_item_id;
    const qty = ri.quantity || 1;
    const unit = ei.allow_custom_price && qty > 0
      ? Math.round((ri.subtotal || 0) / qty)
      : null;
    init.selectedItems[id] = (init.selectedItems[id] || 0) + qty;
    init.names[id] = init.names[id] || [];
    init.contents[id] = init.contents[id] || [];
    init.receiptTitles[id] = init.receiptTitles[id] || [];
    if (ei.allow_custom_price) init.customPrices[id] = init.customPrices[id] || [];
    for (let i = 0; i < qty; i++) {
      init.names[id].push(ns[i] || '');
      init.contents[id].push(cs[i] || '');
      init.receiptTitles[id].push(rt);
      if (ei.allow_custom_price) init.customPrices[id].push(String(unit ?? ''));
    }
  }
  return init;
}

export default function RegistrationForm({ event, existingRegistration, currentUser }) {
  const router = useRouter();
  const isEditMode = !!(existingRegistration && existingRegistration.payment_status !== 'paid' && Array.isArray(existingRegistration.items));
  const initial = isEditMode ? buildInitialFromRegistration(existingRegistration, event.items) : null;
  const memberDefaultTitle = (currentUser?.receipt_title || currentUser?.name || '').trim();

  const [selectedItems, setSelectedItems] = useState(initial?.selectedItems || {});
  const [names, setNames] = useState(initial?.names || {});
  const [contents, setContents] = useState(initial?.contents || {});
  const [customPrices, setCustomPrices] = useState(initial?.customPrices || {});
  const [giftNames, setGiftNames] = useState(initial?.giftNames || {});
  const [giftContents, setGiftContents] = useState(initial?.giftContents || {});
  // Per-unit receipt titles: receiptTitles[itemId] = [t1, t2, ...] (length = qty).
  // Empty string at any slot means "use member default" (substituted on submit).
  const [receiptTitles, setReceiptTitles] = useState(initial?.receiptTitles || {});
  const [giftReceiptTitles, setGiftReceiptTitles] = useState(initial?.giftReceiptTitles || {});
  const [notes, setNotes] = useState(isEditMode ? (existingRegistration.notes || '') : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelWarnings, setExcelWarnings] = useState([]);
  const [excelNotice, setExcelNotice] = useState('');

  const itemById = (id) => event.items.find((i) => i.id === parseInt(id));
  const total = Object.entries(selectedItems).reduce((sum, [itemId, qty]) => {
    const item = itemById(itemId);
    if (!item) return sum;
    if (item.allow_custom_price) {
      const arr = customPrices[itemId] || [];
      return sum + arr.reduce((s, v) => {
        const n = parseInt(v);
        return s + (Number.isFinite(n) ? n : 0);
      }, 0);
    }
    return sum + item.price * qty;
  }, 0);

  function updateQty(itemId, qty) {
    const item = itemById(itemId);
    const giftQty = item && item.gift_quantity > 0 && item.gift_event_item_id ? item.gift_quantity : 0;
    if (qty === 0) {
      const next = { ...selectedItems };
      delete next[itemId];
      setSelectedItems(next);
      const nextNames = { ...names };
      delete nextNames[itemId];
      setNames(nextNames);
      const nextContents = { ...contents };
      delete nextContents[itemId];
      setContents(nextContents);
      const nextGN = { ...giftNames };
      delete nextGN[itemId];
      setGiftNames(nextGN);
      const nextGC = { ...giftContents };
      delete nextGC[itemId];
      setGiftContents(nextGC);
      const nextCP = { ...customPrices };
      delete nextCP[itemId];
      setCustomPrices(nextCP);
      const nextRT = { ...receiptTitles };
      delete nextRT[itemId];
      setReceiptTitles(nextRT);
      const nextGRT = { ...giftReceiptTitles };
      delete nextGRT[itemId];
      setGiftReceiptTitles(nextGRT);
    } else {
      setSelectedItems((prev) => ({ ...prev, [itemId]: qty }));
      setNames((prev) => {
        const current = prev[itemId] || [];
        return { ...prev, [itemId]: Array.from({ length: qty }, (_, i) => current[i] || '') };
      });
      setContents((prev) => {
        const current = prev[itemId] || [];
        return { ...prev, [itemId]: Array.from({ length: qty }, (_, i) => current[i] || '') };
      });
      setCustomPrices((prev) => {
        const current = prev[itemId] || [];
        return { ...prev, [itemId]: Array.from({ length: qty }, (_, i) => current[i] ?? '') };
      });
      // Per-unit receipt titles: seed new slots with member default; preserve existing edits.
      setReceiptTitles((prev) => {
        const current = prev[itemId] || [];
        return { ...prev, [itemId]: Array.from({ length: qty }, (_, i) => current[i] ?? memberDefaultTitle) };
      });
      const giftSlots = qty * giftQty;
      setGiftNames((prev) => {
        const current = prev[itemId] || [];
        return { ...prev, [itemId]: Array.from({ length: giftSlots }, (_, i) => current[i] || '') };
      });
      setGiftContents((prev) => {
        const current = prev[itemId] || [];
        return { ...prev, [itemId]: Array.from({ length: giftSlots }, (_, i) => current[i] || '') };
      });
      if (giftSlots > 0) {
        setGiftReceiptTitles((prev) => (
          prev[itemId] !== undefined ? prev : { ...prev, [itemId]: memberDefaultTitle }
        ));
      }
    }
  }

  function updateReceiptTitle(itemId, idx, val) {
    setReceiptTitles((prev) => {
      const current = [...(prev[itemId] || [])];
      current[idx] = val;
      return { ...prev, [itemId]: current };
    });
  }

  function applyFirstTitleToAll(itemId) {
    setReceiptTitles((prev) => {
      const current = prev[itemId] || [];
      if (current.length <= 1) return prev;
      const first = current[0] ?? memberDefaultTitle;
      return { ...prev, [itemId]: current.map(() => first) };
    });
  }

  function updateGiftReceiptTitle(parentId, val) {
    setGiftReceiptTitles((prev) => ({ ...prev, [parentId]: val }));
  }

  function updateGiftName(parentId, idx, val) {
    setGiftNames((prev) => {
      const current = [...(prev[parentId] || [])];
      current[idx] = val;
      return { ...prev, [parentId]: current };
    });
  }

  function updateGiftContent(parentId, idx, val) {
    setGiftContents((prev) => {
      const current = [...(prev[parentId] || [])];
      current[idx] = val;
      return { ...prev, [parentId]: current };
    });
  }

  function updateCustomPrice(itemId, idx, val) {
    setCustomPrices((prev) => {
      const current = [...(prev[itemId] || [])];
      current[idx] = val;
      return { ...prev, [itemId]: current };
    });
  }

  function updateName(itemId, idx, val) {
    setNames((prev) => {
      const current = [...(prev[itemId] || [])];
      current[idx] = val;
      return { ...prev, [itemId]: current };
    });
  }

  function updateContent(itemId, idx, val) {
    setContents((prev) => {
      const current = [...(prev[itemId] || [])];
      current[idx] = val;
      return { ...prev, [itemId]: current };
    });
  }

  async function handleExcelUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-upload of same file
    if (!file) return;
    setExcelLoading(true);
    setExcelWarnings([]);
    setExcelNotice('');
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('eventId', String(event.id));
      const res = await fetch('/api/registrations/parse-excel', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Excel 解析失敗');
      } else {
        const { selectedItems: si, names: nn, contents: cc, customPrices: cp, receiptTitles: rt } = data.data || {};
        setSelectedItems(si || {});
        setNames(nn || {});
        setContents(cc || {});
        setCustomPrices(cp || {});
        setReceiptTitles(rt || {});
        setGiftNames({});
        setGiftContents({});
        setGiftReceiptTitles({});
        setExcelWarnings(data.warnings || []);
        const totalUnits = Object.values(si || {}).reduce((s, q) => s + Number(q || 0), 0);
        setExcelNotice(`已匯入 ${totalUnits} 筆資料，請檢查後再送出。`);
      }
    } catch {
      setError('上傳失敗，請稍後再試');
    }
    setExcelLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const items = [];
    for (const [itemId, qty] of Object.entries(selectedItems)) {
      const ei = itemById(itemId);
      if (!ei) continue;
      const ns = names[itemId] || [];
      const cs = contents[itemId] || [];
      const rts = receiptTitles[itemId] || [];
      const normRt = (i) => {
        const v = rts[i];
        const s = v == null ? '' : String(v).trim();
        return s || memberDefaultTitle;
      };

      if (ei.allow_custom_price) {
        // Each unit becomes its own row so the per-unit amount + title can be stored.
        const arr = customPrices[itemId] || [];
        for (let i = 0; i < qty; i++) {
          const v = parseInt(arr[i]);
          items.push({
            eventItemId: parseInt(itemId),
            quantity: 1,
            names: [ns[i] || ''],
            contents: [cs[i] || ''],
            receipt_title: normRt(i),
            unit_price: Number.isFinite(v) ? v : 0,
          });
        }
      } else {
        // Group consecutive units with the same receipt_title into one row, so
        // members entering one title still get one DB row (current behavior),
        // but mixed titles get split into separate rows.
        let start = 0;
        while (start < qty) {
          const groupTitle = normRt(start);
          let end = start + 1;
          while (end < qty && normRt(end) === groupTitle) end++;
          items.push({
            eventItemId: parseInt(itemId),
            quantity: end - start,
            names: Array.from({ length: end - start }, (_, i) => ns[start + i] || ''),
            contents: Array.from({ length: end - start }, (_, i) => cs[start + i] || ''),
            receipt_title: groupTitle,
          });
          start = end;
        }
      }
    }

    if (items.length === 0) {
      setError('請至少選擇一個報名項目');
      return;
    }

    // Validate names / contents / custom-price min.
    for (const item of items) {
      const eventItem = itemById(item.eventItemId);
      if (eventItem?.allow_custom_price) {
        const v = item.unit_price;
        if (!Number.isFinite(v) || v <= 0) {
          setError(`請填寫「${eventItem.name}」的金額`);
          return;
        }
        if (eventItem.price > 0 && v < eventItem.price) {
          setError(`「${eventItem.name}」每筆最低金額為 ${eventItem.price} 元`);
          return;
        }
      }
      if (eventItem?.requires_name) {
        if (item.names.length !== item.quantity || item.names.some((n) => !n.trim())) {
          setError(`請填寫「${eventItem.name}」的功德主(陽上)姓名（共 ${item.quantity} 位）`);
          return;
        }
      }
      if (eventItem?.requires_content) {
        if (item.contents.length !== item.quantity || item.contents.some((c) => !c.trim())) {
          setError(`請填寫「${eventItem.name}」的超渡內容（共 ${item.quantity} 筆）`);
          return;
        }
      }
    }

    for (const [itemId, qty] of Object.entries(selectedItems)) {
      const parent = itemById(itemId);
      if (!parent || !parent.gift_event_item_id || !parent.gift_quantity) continue;
      const gift = itemById(parent.gift_event_item_id);
      if (!gift) continue;
      const giftSlots = qty * parent.gift_quantity;
      const gNames = (giftNames[itemId] || []).slice(0, giftSlots);
      const gContents = (giftContents[itemId] || []).slice(0, giftSlots);
      if (gift.requires_name) {
        const empty = gNames.filter((n) => !n.trim());
        if (empty.length > 0 || gNames.length < giftSlots) {
          setError(`請填寫「${parent.name}」贈送之「${gift.name}」的功德主(陽上)姓名`);
          return;
        }
      }
      if (gift.requires_content) {
        const empty = gContents.filter((c) => !c.trim());
        if (empty.length > 0 || gContents.length < giftSlots) {
          setError(`請填寫「${parent.name}」贈送之「${gift.name}」的超渡內容`);
          return;
        }
      }
      const grtRaw = giftReceiptTitles[itemId];
      const grt = (grtRaw == null ? memberDefaultTitle : String(grtRaw).trim()) || memberDefaultTitle;
      items.push({
        eventItemId: parent.gift_event_item_id,
        quantity: giftSlots,
        names: gNames,
        contents: gContents,
        receipt_title: grt,
        is_gift: true,
        source_event_item_id: parent.id,
      });
    }

    setLoading(true);
    try {
      const url = isEditMode
        ? `/api/registrations/${existingRegistration.id}`
        : '/api/registrations';
      const method = isEditMode ? 'PATCH' : 'POST';
      const body = isEditMode
        ? { items, notes }
        : { eventId: event.id, items, notes };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isEditMode ? '修改失敗，請稍後再試' : '報名失敗，請稍後再試'));
      } else {
        router.push(`/events/${event.id}`);
        router.refresh();
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  if (existingRegistration && existingRegistration.payment_status === 'paid') {
    return (
      <div className="card p-4 text-center">
        <div className="text-2xl mb-2">✅</div>
        <div className="font-bold text-temple-dark">您已完成報名</div>
        <div className="text-sm text-gray-500 mt-1">繳款狀態：✅ 已繳款</div>
        {existingRegistration.receipt_number && (
          <div className="text-sm text-gray-500">收據號碼：{existingRegistration.receipt_number}</div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Excel import */}
      <div className="card p-3 bg-blue-50 border border-blue-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-blue-900">📊 從 Excel 匯入報名</div>
            <div className="text-xs text-blue-700 mt-0.5">
              支援欄位：功德主、超度內容、金額、項目、收據抬頭
            </div>
          </div>
          <label className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer ${
            excelLoading ? 'bg-gray-200 text-gray-500' : 'bg-temple-red text-white hover:opacity-90'
          }`}>
            {excelLoading ? '解析中...' : '選擇 Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              disabled={excelLoading}
              className="hidden"
            />
          </label>
        </div>
        {excelNotice && (
          <div className="mt-2 text-xs text-green-700">{excelNotice}</div>
        )}
        {excelWarnings.length > 0 && (
          <div className="mt-2 space-y-1 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
            <div className="text-xs font-medium text-yellow-800">⚠️ 注意</div>
            {excelWarnings.map((w, i) => (
              <div key={i} className="text-xs text-yellow-700">• {w}</div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4">
        <h3 className="font-bold text-temple-dark mb-3">{isEditMode ? '修改報名項目' : '選擇報名項目'}</h3>
        <div className="space-y-4">
          {event.items.map((item) => {
            const qty = selectedItems[item.id] || 0;
            const titlesArr = receiptTitles[item.id] || [];
            const hasMixedTitles = qty > 1 && titlesArr.slice(0, qty).some((t, i, arr) => i > 0 && (t ?? '') !== (arr[0] ?? ''));
            return (
              <div key={item.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{item.name}</div>
                    {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                    <div className="text-temple-gold text-sm font-medium">
                      {item.allow_custom_price
                        ? (item.price > 0 ? `隨喜功德（每筆最低 ${formatMoney(item.price)}）` : '隨喜功德')
                        : formatMoney(item.price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, Math.max(0, qty - 1))}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 active:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-medium">{qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, Math.min(99, qty + 1))}
                      className="w-8 h-8 rounded-full border border-temple-red text-temple-red flex items-center justify-center active:bg-red-50"
                    >
                      +
                    </button>
                  </div>
                </div>

                {qty > 0 && (
                  <div className="mt-2 space-y-2">
                    {qty > 1 && hasMixedTitles && (
                      <button
                        type="button"
                        onClick={() => applyFirstTitleToAll(item.id)}
                        className="text-xs text-temple-red hover:underline"
                      >
                        🧾 全部套用第 1 筆收據抬頭
                      </button>
                    )}
                    {Array.from({ length: qty }).map((_, idx) => (
                      <div key={idx} className="space-y-1.5 bg-gray-50 rounded-lg p-2">
                        <div className="text-xs text-gray-500 font-medium">第 {idx + 1} 筆</div>
                        {item.allow_custom_price && (
                          <input
                            type="number"
                            inputMode="numeric"
                            className="input-field text-sm"
                            min={item.price || 0}
                            placeholder={item.price > 0 ? `金額（最低 ${item.price}）` : '金額'}
                            value={(customPrices[item.id] || [])[idx] ?? ''}
                            onChange={(e) => updateCustomPrice(item.id, idx, e.target.value)}
                            required
                          />
                        )}
                        {item.requires_name && (
                          <input
                            type="text"
                            className="input-field text-sm"
                            placeholder={`功德主(陽上)姓名`}
                            value={(names[item.id] || [])[idx] || ''}
                            onChange={(e) => updateName(item.id, idx, e.target.value)}
                            required
                          />
                        )}
                        {item.requires_content && (
                          <textarea
                            className="input-field text-sm resize-none"
                            rows={2}
                            placeholder={item.content_example || `超渡內容（如：歷代祖先、冤親債主等）`}
                            value={(contents[item.id] || [])[idx] || ''}
                            onChange={(e) => updateContent(item.id, idx, e.target.value)}
                            required
                          />
                        )}
                        <input
                          type="text"
                          maxLength={100}
                          className="input-field text-xs"
                          placeholder={`收據抬頭${memberDefaultTitle ? `（預設：${memberDefaultTitle}）` : ''}`}
                          value={(receiptTitles[item.id] || [])[idx] ?? ''}
                          onChange={(e) => updateReceiptTitle(item.id, idx, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {qty > 0 && item.gift_event_item_id && item.gift_quantity > 0 ? (() => {
                  const gift = itemById(item.gift_event_item_id);
                  if (!gift) return null;
                  const giftSlots = qty * item.gift_quantity;
                  return (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                      <div className="text-xs text-amber-800 font-medium">
                        🎁 加贈 {giftSlots} 個「{gift.name}」（免費）
                      </div>
                      {Array.from({ length: giftSlots }).map((_, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="text-xs text-amber-700">贈送 {idx + 1}</div>
                          {gift.requires_name && (
                            <input
                              type="text"
                              className="input-field text-sm"
                              placeholder="功德主(陽上)姓名"
                              value={(giftNames[item.id] || [])[idx] || ''}
                              onChange={(e) => updateGiftName(item.id, idx, e.target.value)}
                              required
                            />
                          )}
                          {gift.requires_content && (
                            <textarea
                              className="input-field text-sm resize-none"
                              rows={2}
                              placeholder={gift.content_example || '超渡內容'}
                              value={(giftContents[item.id] || [])[idx] || ''}
                              onChange={(e) => updateGiftContent(item.id, idx, e.target.value)}
                              required
                            />
                          )}
                        </div>
                      ))}
                      <div>
                        <label className="block text-xs text-amber-700 mb-1">贈送收據抬頭</label>
                        <input
                          type="text"
                          maxLength={100}
                          className="input-field text-sm"
                          placeholder={memberDefaultTitle ? `預設：${memberDefaultTitle}` : '請輸入收據抬頭'}
                          value={giftReceiptTitles[item.id] ?? memberDefaultTitle}
                          onChange={(e) => updateGiftReceiptTitle(item.id, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })() : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div>
          <label className="block font-medium text-sm mb-1.5">備註（選填）</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            placeholder="如有特殊需求請填寫..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="card p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="font-bold text-temple-dark">合計金額</span>
          <span className="text-xl font-bold text-temple-red">{formatMoney(total)}</span>
        </div>
        <button type="submit" disabled={loading || Object.keys(selectedItems).length === 0} className="w-full btn-primary py-3">
          {loading ? (isEditMode ? '儲存中...' : '報名中...') : (isEditMode ? '儲存修改' : '確認報名')}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">繳款方式請洽大自在山服務台</p>
      </div>
    </form>
  );
}
