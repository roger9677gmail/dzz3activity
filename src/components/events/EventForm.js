'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toDateTimeLocalValue } from '@/lib/utils';

const DEFAULT_COLORS = ['#8B1A1A', '#1A4A8B', '#1A6B2A', '#7A1A8B', '#8B5E1A'];

export default function EventForm({ event = null }) {
  const router = useRouter();
  const isEdit = !!event;

  const [form, setForm] = useState({
    name: event?.name || '',
    description: event?.description || '',
    start_date: toDateTimeLocalValue(event?.start_date),
    end_date: toDateTimeLocalValue(event?.end_date),
    registration_deadline: toDateTimeLocalValue(event?.registration_deadline),
    location: event?.location || '',
    map_url: event?.map_url || '',
    status: event?.status || 'active',
    banner_color: event?.banner_color || '#8B1A1A',
  });

  // Stable per-item uid so gift target references survive reordering and edit/save round-trips.
  const uidCounter = useRef(0);
  function newUid() { uidCounter.current += 1; return `c${uidCounter.current}`; }
  // Default to no items so admins can create pure attendance-only events
  // (the existing event's items override this on edit).
  const initialItems = (event?.items || [])
    .map((it) => ({
      _uid: it.id ? `db${it.id}` : newUid(),
      ...it,
      gift_quantity: it.gift_quantity || 0,
      // Translate existing gift_event_item_id (DB id) to gift_uid (db<id>) so the dropdown can match.
      gift_uid: it.gift_event_item_id ? `db${it.gift_event_item_id}` : '',
    }));
  const [items, setItems] = useState(initialItems);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragSrcRef = useRef(null);

  function updateItem(idx, field, val) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { _uid: newUid(), name: '', description: '', price: 0, allow_custom_price: false, requires_name: true, requires_content: false, content_example: '', gift_quantity: 0, gift_uid: '' }]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveItem(from, to) {
    if (from === to || from < 0 || to < 0) return;
    setItems((prev) => {
      if (from >= prev.length || to >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleDragStart(idx) {
    return (e) => {
      dragSrcRef.current = idx;
      setDragIndex(idx);
      e.dataTransfer.effectAllowed = 'move';
      // Firefox needs data set on the transfer to fire drag events.
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch {}
    };
  }

  function handleDragOver(idx) {
    return (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverIndex !== idx) setDragOverIndex(idx);
    };
  }

  function handleDrop(idx) {
    return (e) => {
      e.preventDefault();
      const from = dragSrcRef.current;
      if (from != null && from !== idx) moveItem(from, idx);
      dragSrcRef.current = null;
      setDragIndex(null);
      setDragOverIndex(null);
    };
  }

  function handleDragEnd() {
    dragSrcRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (items.some((item) => !item.name.trim())) {
      setError('請填寫所有項目名稱');
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/events/${event.id}` : '/api/events';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '操作失敗');
      } else {
        if (isEdit) {
          // Update items separately. Surface failures so a silent FK violation
          // doesn't leave the admin thinking the price/隨喜功德 changes saved.
          const itemsRes = await fetch(`/api/events/${event.id}/items`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          });
          if (!itemsRes.ok) {
            const itemsData = await itemsRes.json().catch(() => ({}));
            setError(itemsData.error || '報名項目更新失敗');
            setLoading(false);
            return;
          }
        }
        router.push('/admin/events');
        router.refresh();
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-temple-dark border-b pb-2">基本資訊</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">活動名稱 *</label>
          <input type="text" required className="input-field" placeholder="例：中元普渡法會"
            value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">活動說明</label>
          <textarea className="input-field resize-none" rows={3} placeholder="活動說明（選填）"
            value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始時間 *</label>
            <input type="datetime-local" required className="input-field"
              value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">結束時間 *</label>
            <input type="datetime-local" required className="input-field"
              value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">報名截止時間 *</label>
          <input type="datetime-local" required className="input-field"
            value={form.registration_deadline} onChange={(e) => setForm((p) => ({ ...p, registration_deadline: e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">含時間點，師兄姐介面會顯示完整截止時間。</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">地點</label>
          <input type="text" className="input-field" placeholder="活動地點（選填）"
            value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Google 地圖連結</label>
          <input
            type="url"
            className="input-field"
            placeholder="https://maps.app.goo.gl/... 或完整 Google Maps 連結"
            value={form.map_url}
            onChange={(e) => setForm((p) => ({ ...p, map_url: e.target.value }))}
            maxLength={1000}
          />
          <p className="text-xs text-gray-400 mt-1">
            Google Maps → 找到地點 → 分享 → 複製連結，貼到這裡。師兄姐端點地點會直接打開這個 pin。留空則自動用上方「地點」文字當搜尋。
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
          <select className="input-field" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
            <option value="active">報名中</option>
            <option value="draft">草稿</option>
            <option value="closed">已截止</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">主題顏色</label>
          <div className="flex gap-2">
            {DEFAULT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm((p) => ({ ...p, banner_color: c }))}
                className={`w-8 h-8 rounded-full border-2 transition-all ${form.banner_color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3 border-b pb-2">
          <h3 className="font-bold text-temple-dark">報名項目</h3>
          <button type="button" onClick={addItem} className="text-sm text-temple-red font-medium">+ 新增項目</button>
        </div>

        {items.length === 0 && (
          <div className="text-xs text-gray-400 mb-3">
            （未新增任何報名項目；此活動將為「純活動登記」模式，師兄姐只能透過「活動登記」題目參加，沒有報名祈福項目）
          </div>
        )}

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div
              key={item._uid || idx}
              draggable
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver(idx)}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={`border rounded-lg p-3 space-y-2 transition-all ${
                dragIndex === idx ? 'opacity-40' : ''
              } ${
                dragOverIndex === idx && dragIndex !== idx
                  ? 'border-temple-red border-2'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span
                    className="text-gray-400 cursor-move select-none text-base leading-none"
                    title="拖移以調整次序"
                    aria-label="拖移以調整次序"
                  >⋮⋮</span>
                  <span className="text-sm font-medium text-gray-500">項目 {idx + 1}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => moveItem(idx, idx - 1)}
                    disabled={idx === 0}
                    className="text-gray-500 text-sm disabled:opacity-30"
                    aria-label="上移"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, idx + 1)}
                    disabled={idx === items.length - 1}
                    className="text-gray-500 text-sm disabled:opacity-30"
                    aria-label="下移"
                  >↓</button>
                  {items.length >= 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-500 text-sm">移除</button>
                  )}
                </div>
              </div>
              <input type="text" required className="input-field text-sm" placeholder="項目名稱（如：光明燈）"
                value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} />
              <input type="text" className="input-field text-sm" placeholder="項目說明（選填）"
                value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
              <div>
                <label className="text-xs text-gray-500">
                  {item.allow_custom_price ? '最低金額（元，0 = 不限）' : '金額（元）'}
                </label>
                <input type="number" inputMode="numeric" className="input-field text-sm" min={0}
                  value={item.price === '' || item.price == null ? '' : item.price}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateItem(idx, 'price', v === '' ? '' : (parseInt(v, 10) || 0));
                  }} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!item.allow_custom_price}
                  onChange={(e) => updateItem(idx, 'allow_custom_price', e.target.checked)} />
                金額由報名者自填（隨喜功德）
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={item.requires_name}
                  onChange={(e) => updateItem(idx, 'requires_name', e.target.checked)} />
                需要填寫功德主(陽上)姓名
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!item.requires_content}
                  onChange={(e) => updateItem(idx, 'requires_content', e.target.checked)} />
                需要填寫超渡內容
              </label>
              {item.requires_content && (
                <div className="ml-6 pt-1 pb-2 border-l-2 border-amber-200 pl-3">
                  <label className="text-xs text-gray-600 mb-1 block">超渡內容範例（選填）</label>
                  <textarea
                    className="input-field text-sm resize-none"
                    rows={2}
                    placeholder="例如：亡者名字、生卒年月&#10;或其他提示文字..."
                    value={item.content_example || ''}
                    onChange={(e) => updateItem(idx, 'content_example', e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">會在報名表以 placeholder 的方式提示師兄姐。</p>
                </div>
              )}

              {/* Gift / 贈送設定 */}
              <div className="pt-2 mt-2 border-t border-dashed border-gray-200 space-y-2">
                <div className="text-xs text-gray-500">🎁 贈送設定（選填）</div>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <div>
                    <label className="text-xs text-gray-500">贈送項目</label>
                    <select
                      className="input-field text-sm"
                      value={item.gift_uid || ''}
                      onChange={(e) => updateItem(idx, 'gift_uid', e.target.value)}
                    >
                      <option value="">無</option>
                      {items.map((other, oi) => (
                        oi !== idx && other._uid ? (
                          <option key={other._uid} value={other._uid}>
                            {other.name?.trim() || `項目 ${oi + 1}`}
                          </option>
                        ) : null
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500">數量</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="input-field text-sm"
                      min={0}
                      max={20}
                      value={item.gift_quantity === '' || item.gift_quantity == null ? '' : item.gift_quantity}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateItem(idx, 'gift_quantity', v === '' ? '' : Math.max(0, parseInt(v, 10) || 0));
                      }}
                      disabled={!item.gift_uid}
                    />
                  </div>
                </div>
                {item.gift_uid && item.gift_quantity > 0 && (
                  <div className="text-xs text-gray-400">
                    每報名 1 個本項目，加贈 {item.gift_quantity} 個「
                    {items.find((o) => o._uid === item.gift_uid)?.name?.trim() || '其他項目'}
                    」。
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <div role="alert" aria-live="polite" className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="flex-1 btn-secondary">取消</button>
        <button type="submit" disabled={loading} className="flex-1 btn-primary">
          {loading ? '儲存中...' : isEdit ? '更新活動' : '建立活動'}
        </button>
      </div>
    </form>
  );
}
