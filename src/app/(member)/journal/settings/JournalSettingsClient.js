'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { durationStringToMinutes, minutesToDurationString } from '@/lib/practices';

export default function JournalSettingsClient({ practices, subscriptions }) {
  const router = useRouter();
  const initialMap = {};
  for (const s of subscriptions) {
    initialMap[s.practice_id] = { active: !!s.active, daily_target: s.daily_target };
  }
  const [state, setState] = useState(() => {
    const out = {};
    for (const p of practices) {
      const sub = initialMap[p.id];
      out[p.id] = {
        subscribed: sub?.active || false,
        target: sub?.daily_target == null
          ? ''
          : p.type === 'duration'
            ? minutesToDurationString(sub.daily_target)
            : String(sub.daily_target),
      };
    }
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function update(id, patch) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save() {
    setError('');
    setMessage('');
    const subs = [];
    for (const p of practices) {
      const s = state[p.id];
      if (!s.subscribed) continue;
      let target = null;
      if (s.target !== '') {
        if (p.type === 'duration') {
          const m = durationStringToMinutes(s.target);
          if (m == null) {
            setError(`「${p.name}」目標格式應為 HH:MM`);
            return;
          }
          target = m;
        } else {
          const n = parseInt(s.target);
          if (!Number.isFinite(n) || n < 0) {
            setError(`「${p.name}」目標應為非負整數`);
            return;
          }
          target = n;
        }
      }
      subs.push({ practice_id: p.id, daily_target: target });
    }
    setSaving(true);
    try {
      const res = await fetch('/api/me/practices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptions: subs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '儲存失敗');
      } else {
        setMessage('已儲存');
        setTimeout(() => router.push('/journal'), 600);
      }
    } catch {
      setError('網路錯誤');
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="text-lg font-bold">修行日誌設定</h1>
      </div>

      <div className="p-4 space-y-3">
        <div className="card p-4 text-sm text-gray-600">
          勾選您要每日記錄的功課，可設定每日目標（選填）。日誌頁的圖表與排名會依您訂閱的功課顯示。
        </div>

        {practices.length === 0 && (
          <div className="card p-6 text-center text-gray-400">
            <p className="text-sm">管理員尚未建立功課項目</p>
          </div>
        )}

        <div className="card divide-y divide-gray-100">
          {practices.map((p) => {
            const s = state[p.id];
            const isDuration = p.type === 'duration';
            return (
              <div key={p.id} className="px-4 py-3 space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={s.subscribed}
                    onChange={(e) => update(p.id, { subscribed: e.target.checked })}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{p.name}</div>
                    <div className="text-[11px] text-gray-400">{isDuration ? '計時（時:分）' : `計次（${p.unit_label || '次'}）`}</div>
                  </div>
                </label>
                {s.subscribed && (
                  <div className="ml-7 flex items-center gap-2">
                    <span className="text-xs text-gray-500 shrink-0">每日目標</span>
                    <input
                      type={isDuration ? 'text' : 'number'}
                      inputMode={isDuration ? 'text' : 'numeric'}
                      placeholder={isDuration ? '例：0:30' : '例：108'}
                      className="input-field text-sm flex-1"
                      value={s.target}
                      onChange={(e) => update(p.id, { target: e.target.value })}
                    />
                    <span className="text-xs text-gray-400 shrink-0">{isDuration ? '時:分' : (p.unit_label || '次')}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        {message && <div className="text-sm text-green-700 text-center">{message}</div>}

        <div className="flex gap-2">
          <Link href="/journal" className="btn-secondary flex-1 text-sm text-center">取消</Link>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 text-sm">
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  );
}
