'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/utils';

export default function RegistrationForm({ event, existingRegistration }) {
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState({});
  const [names, setNames] = useState({});
  const [contents, setContents] = useState({});
  // Gift slots are keyed by the parent event_item id; arrays sized parent.qty * parent.gift_quantity.
  const [giftNames, setGiftNames] = useState({});
  const [giftContents, setGiftContents] = useState({});
  const [notes, setNotes] = useState('');
  const [receiptTitle, setReceiptTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const itemById = (id) => event.items.find((i) => i.id === parseInt(id));
  // Gifts don't add to the price. Only sum non-gift quantities.
  const total = Object.entries(selectedItems).reduce((sum, [itemId, qty]) => {
    const item = itemById(itemId);
    return sum + (item ? item.price * qty : 0);
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

    const items = Object.entries(selectedItems).map(([itemId, qty]) => ({
      eventItemId: parseInt(itemId),
      quantity: qty,
      names: names[itemId] || [],
      contents: contents[itemId] || [],
    }));

    if (items.length === 0) {
      setError('請至少選擇一個報名項目');
      return;
    }

    // Validate required names / contents on regular items.
    for (const item of items) {
      const eventItem = itemById(item.eventItemId);
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
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, items, notes, receipt_title: receiptTitle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '報名失敗，請稍後再試');
      } else {
        router.push(`/history?registered=${event.id}`);
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  if (existingRegistration) {
    return (
      <div className="card p-4 text-center">
        <div className="text-2xl mb-2">✅</div>
        <div className="font-bold text-temple-dark">您已完成報名</div>
        <div className="text-sm text-gray-500 mt-1">
          繳款狀態：{existingRegistration.payment_status === 'paid' ? '✅ 已繳款' : '⏳ 待繳款'}
        </div>
        {existingRegistration.receipt_number && (
          <div className="text-sm text-gray-500">收據號碼：{existingRegistration.receipt_number}</div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="card p-4">
        <h3 className="font-bold text-temple-dark mb-3">選擇報名項目</h3>
        <div className="space-y-4">
          {event.items.map((item) => {
            const qty = selectedItems[item.id] || 0;
            return (
              <div key={item.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{item.name}</div>
                    {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                    <div className="text-temple-gold text-sm font-medium">{formatMoney(item.price)}</div>
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

                {qty > 0 && item.requires_name ? (
                  <div className="mt-2 space-y-1.5">
                    {Array.from({ length: qty }).map((_, idx) => (
                      <input
                        key={idx}
                        type="text"
                        className="input-field text-sm"
                        placeholder={`第${idx + 1}位功德主(陽上)姓名`}
                        value={(names[item.id] || [])[idx] || ''}
                        onChange={(e) => updateName(item.id, idx, e.target.value)}
                        required
                      />
                    ))}
                  </div>
                ) : null}

                {qty > 0 && item.requires_content ? (
                  <div className="mt-2 space-y-1.5">
                    {Array.from({ length: qty }).map((_, idx) => (
                      <textarea
                        key={idx}
                        className="input-field text-sm resize-none"
                        rows={2}
                        placeholder={`第${idx + 1}位超渡內容（如：歷代祖先、冤親債主等）`}
                        value={(contents[item.id] || [])[idx] || ''}
                        onChange={(e) => updateContent(item.id, idx, e.target.value)}
                        required
                      />
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
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <div className="card p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="font-bold text-temple-dark">合計金額</span>
          <span className="text-xl font-bold text-temple-red">{formatMoney(total)}</span>
        </div>
        <button type="submit" disabled={loading || Object.keys(selectedItems).length === 0} className="w-full btn-primary py-3">
          {loading ? '報名中...' : '確認報名'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">繳款方式請洽大自在山服務台</p>
      </div>
    </form>
  );
}
