'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney, safeParseJSON } from '@/lib/utils';

function safeParseArray(v) {
  const p = safeParseJSON(v, []);
  return Array.isArray(p) ? p : [];
}

// Reconstruct form state from a saved registration so the user can edit it.
function buildInitialFromRegistration(reg, eventItems) {
  const init = { selectedItems: {}, names: {}, contents: {}, customPrices: {}, giftNames: {}, giftContents: {} };
  if (!reg || !Array.isArray(reg.items)) return init;
  for (const ri of reg.items) {
    const ei = eventItems.find((e) => Number(e.id) === Number(ri.event_item_id));
    if (!ei) continue;
    const ns = safeParseArray(ri.names);
    const cs = safeParseArray(ri.contents);
    if (ri.is_gift) {
      // Find the parent item that gifts to this event_item.
      const parent = eventItems.find((e) => Number(e.gift_event_item_id) === Number(ri.event_item_id) && (e.gift_quantity || 0) > 0);
      if (!parent) continue;
      init.giftNames[parent.id] = (init.giftNames[parent.id] || []).concat(ns);
      init.giftContents[parent.id] = (init.giftContents[parent.id] || []).concat(cs);
      continue;
    }
    if (ei.allow_custom_price) {
      // Custom-price was stored as one row per unit (qty=1, subtotal = unit price).
      // We may also have legacy rows with qty>1 and a single subtotal (split unit = subtotal/qty).
      const qty = ri.quantity || 1;
      const unit = qty > 0 ? Math.round((ri.subtotal || 0) / qty) : (ri.subtotal || 0);
      init.selectedItems[ri.event_item_id] = (init.selectedItems[ri.event_item_id] || 0) + qty;
      const cpArr = init.customPrices[ri.event_item_id] || [];
      const nArr = init.names[ri.event_item_id] || [];
      const cArr = init.contents[ri.event_item_id] || [];
      for (let i = 0; i < qty; i++) {
        cpArr.push(String(unit));
        nArr.push(ns[i] || '');
        cArr.push(cs[i] || '');
      }
      init.customPrices[ri.event_item_id] = cpArr;
      init.names[ri.event_item_id] = nArr;
      init.contents[ri.event_item_id] = cArr;
    } else {
      init.selectedItems[ri.event_item_id] = ri.quantity;
      init.names[ri.event_item_id] = ns;
      init.contents[ri.event_item_id] = cs;
    }
  }
  return init;
}

export default function RegistrationForm({ event, existingRegistration }) {
  const router = useRouter();
  const isEditMode = !!(existingRegistration && existingRegistration.payment_status !== 'paid' && Array.isArray(existingRegistration.items));
  const initial = isEditMode ? buildInitialFromRegistration(existingRegistration, event.items) : null;

  const [selectedItems, setSelectedItems] = useState(initial?.selectedItems || {});
  const [names, setNames] = useState(initial?.names || {});
  const [contents, setContents] = useState(initial?.contents || {});
  // Per-unit raw amounts (string) for items with allow_custom_price; array sized to match qty.
  const [customPrices, setCustomPrices] = useState(initial?.customPrices || {});
  // Gift slots are keyed by the parent event_item id; arrays sized parent.qty * parent.gift_quantity.
  const [giftNames, setGiftNames] = useState(initial?.giftNames || {});
  const [giftContents, setGiftContents] = useState(initial?.giftContents || {});
  const [notes, setNotes] = useState(isEditMode ? (existingRegistration.notes || '') : '');
  const [receiptTitle, setReceiptTitle] = useState(isEditMode ? (existingRegistration.receipt_title || '') : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const itemById = (id) => event.items.find((i) => i.id === parseInt(id));
  // Gifts don't add to the price. Custom-price items sum each unit's entered amount.
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
    } else {
      setSelectedItems((prev) => ({ ...prev, [itemId]: qty }));
      setNames((prev) => {
        const current = prev[itemId] || [];
        const adjusted = Array.from({ length: qty }, (_, i) => current[i] || '');
        return { ...prev, [itemId]: adjusted };
      });
      setContents((prev) => {
        const current = prev[itemId] || [];
        const adjusted = Array.from({ length: qty }, (_, i) => current[i] || '');
        return { ...prev, [itemId]: adjusted };
      });
      // Resize custom-price array to match qty (only meaningful when allow_custom_price).
      setCustomPrices((prev) => {
        const current = prev[itemId] || [];
        return { ...prev, [itemId]: Array.from({ length: qty }, (_, i) => current[i] ?? '') };
      });
      // Resize gift slot arrays to match qty * giftQty.
      const giftSlots = qty * giftQty;
      setGiftNames((prev) => {
        const current = prev[itemId] || [];
        return { ...prev, [itemId]: Array.from({ length: giftSlots }, (_, i) => current[i] || '') };
      });
      setGiftContents((prev) => {
        const current = prev[itemId] || [];
        return { ...prev, [itemId]: Array.from({ length: giftSlots }, (_, i) => current[i] || '') };
      });
    }
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const items = [];
    for (const [itemId, qty] of Object.entries(selectedItems)) {
      const ei = itemById(itemId);
      if (!ei) continue;
      if (ei.allow_custom_price) {
        // Each unit becomes its own row so the per-unit amount can be stored
        // in registration_items.subtotal and surfaced cleanly in the report.
        const arr = customPrices[itemId] || [];
        const ns = names[itemId] || [];
        const cs = contents[itemId] || [];
        for (let i = 0; i < qty; i++) {
          const v = parseInt(arr[i]);
          items.push({
            eventItemId: parseInt(itemId),
            quantity: 1,
            names: [ns[i] || ''],
            contents: [cs[i] || ''],
            unit_price: Number.isFinite(v) ? v : 0,
          });
        }
      } else {
        items.push({
          eventItemId: parseInt(itemId),
          quantity: qty,
          names: names[itemId] || [],
          contents: contents[itemId] || [],
        });
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
        const emptyNames = item.names.filter((n) => !n.trim());
        if (emptyNames.length > 0) {
          setError(`請填寫「${eventItem.name}」的功德主(陽上)姓名`);
          return;
        }
      }
      if (eventItem?.requires_content) {
        const emptyContents = item.contents.filter((c) => !c.trim());
        if (emptyContents.length > 0) {
          setError(`請填寫「${eventItem.name}」的超渡內容`);
          return;
        }
      }
    }

    // Append gift sub-rows for any selected parent that configures a gift.
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
      items.push({
        eventItemId: parent.gift_event_item_id,
        quantity: giftSlots,
        names: gNames,
        contents: gContents,
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
        ? { items, notes, receipt_title: receiptTitle }
        : { eventId: event.id, items, notes, receipt_title: receiptTitle };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isEditMode ? '修改失敗，請稍後再試' : '報名失敗，請稍後再試'));
      } else {
        // `/history` was removed when 報名歷史 moved into the event card
        // (see CLAUDE.md). Send the user back to the event detail page so
        // they immediately see the saved registration summary inline.
        router.push(`/events/${event.id}`);
        router.refresh();
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  // Paid registrations are read-only; the page handles this case but keep a
  // safety net here in case someone passes a paid registration to the form.
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
      <div className="card p-4">
        <h3 className="font-bold text-temple-dark mb-3">{isEditMode ? '修改報名項目' : '選擇報名項目'}</h3>
        <div className="space-y-4">
          {event.items.map((item) => {
            const qty = selectedItems[item.id] || 0;
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

                {qty > 0 && item.allow_custom_price ? (
                  <div className="mt-2 space-y-1.5">
                    <label className="block text-xs text-gray-500">每筆金額（元）</label>
                    {Array.from({ length: qty }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-12 shrink-0">第 {idx + 1} 筆</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          className="input-field text-sm flex-1"
                          min={item.price || 0}
                          placeholder={item.price > 0 ? `最低 ${item.price}` : '請輸入金額'}
                          value={(customPrices[item.id] || [])[idx] ?? ''}
                          onChange={(e) => updateCustomPrice(item.id, idx, e.target.value)}
                          required
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {qty > 0 && (item.requires_name || item.requires_content) ? (
                  <div className="mt-2 space-y-2">
                    {Array.from({ length: qty }).map((_, idx) => (
                      <div key={idx} className="space-y-1.5">
                        {item.requires_name && (
                          <input
                            type="text"
                            className="input-field text-sm"
                            placeholder={`第${idx + 1}位功德主(陽上)姓名`}
                            value={(names[item.id] || [])[idx] || ''}
                            onChange={(e) => updateName(item.id, idx, e.target.value)}
                            required
                          />
                        )}
                        {item.requires_content && (
                          <textarea
                            className="input-field text-sm resize-none"
                            rows={2}
                            placeholder={`第${idx + 1}位超渡內容（如：歷代祖先、冤親債主等）`}
                            value={(contents[item.id] || [])[idx] || ''}
                            onChange={(e) => updateContent(item.id, idx, e.target.value)}
                            required
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

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
                              placeholder="超渡內容"
                              value={(giftContents[item.id] || [])[idx] || ''}
                              onChange={(e) => updateGiftContent(item.id, idx, e.target.value)}
                              required
                            />
                          )}
                        </div>
                      ))}
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
          <label className="block font-medium text-sm mb-1.5">收據抬頭（選填）</label>
          <input
            type="text"
            maxLength={100}
            className="input-field"
            placeholder="不填預設用您的姓名；可填公司、捐贈者等"
            value={receiptTitle}
            onChange={(e) => setReceiptTitle(e.target.value)}
          />
        </div>
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
