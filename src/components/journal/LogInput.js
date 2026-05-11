'use client';
import { useEffect, useState } from 'react';
import { minutesToDurationString } from '@/lib/practices';

// Single-row input for one practice on a given day.
//   - count: numeric input (single field)
//   - duration: two fields, 小時 + 分鐘 — much easier on mobile than typing HH:MM
export default function LogInput({ practice, value, onChange }) {
  const isDuration = practice.type === 'duration';

  if (isDuration) {
    return <DurationInput practice={practice} value={value} onChange={onChange} />;
  }
  return <CountInput practice={practice} value={value} onChange={onChange} />;
}

function CountInput({ practice, value, onChange }) {
  const [text, setText] = useState(() => value == null ? '' : String(value));
  const [error, setError] = useState('');

  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  function commit() {
    if (text === '') { setError(''); onChange(null); return; }
    const n = parseInt(text);
    if (!Number.isFinite(n) || n < 0) {
      setError('請輸入非負整數');
      return;
    }
    setError('');
    onChange(n);
  }

  const target = practice.daily_target;
  const hit = target != null && target > 0 && (value || 0) >= target;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
          {practice.name}
          {hit && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">已達標</span>}
        </div>
        {target != null && target > 0 && (
          <div className="text-[11px] text-gray-400">目標 {target} {practice.unit_label || '次'}</div>
        )}
        {error && <div className="text-[11px] text-red-600 mt-0.5">{error}</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number" inputMode="numeric" min={0}
          placeholder="0"
          className="input-field text-sm w-20 text-right"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
        />
        <span className="text-xs text-gray-400 w-8">{practice.unit_label || '次'}</span>
      </div>
    </div>
  );
}

// Two-field 小時 + 分鐘 with quick-tap presets — fixes the painful HH:MM typing.
function DurationInput({ practice, value, onChange }) {
  const initial = splitMinutes(value);
  const [hours, setHours] = useState(initial.h);
  const [mins, setMins] = useState(initial.m);

  useEffect(() => {
    const s = splitMinutes(value);
    setHours(s.h);
    setMins(s.m);
  }, [value]);

  function commit(nextH, nextM) {
    const total = (nextH * 60) + nextM;
    onChange(total === 0 ? null : total);
  }

  function setH(v) {
    const n = clampInt(v, 0, 23);
    setHours(n);
    commit(n, mins);
  }
  function setM(v) {
    const n = clampInt(v, 0, 59);
    setMins(n);
    commit(hours, n);
  }
  function bump(deltaMin) {
    const total = Math.max(0, (hours * 60) + mins + deltaMin);
    const h = Math.floor(total / 60);
    const m = total % 60;
    setHours(h);
    setMins(m);
    commit(h, m);
  }

  const target = practice.daily_target;
  const hit = target != null && target > 0 && (value || 0) >= target;

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 flex items-center gap-2 flex-wrap">
            {practice.name}
            {hit && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">已達標</span>}
          </div>
          {target != null && target > 0 && (
            <div className="text-[11px] text-gray-400">目標 {minutesToDurationString(target)}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number" inputMode="numeric" min={0} max={23}
            className="input-field text-sm w-12 text-center px-1"
            value={hours}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setHours(clampInt(e.target.value, 0, 23))}
            onBlur={() => commit(hours, mins)}
            aria-label="小時"
          />
          <span className="text-xs text-gray-500">小時</span>
          <input
            type="number" inputMode="numeric" min={0} max={59}
            className="input-field text-sm w-12 text-center px-1 ml-1"
            value={mins}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setMins(clampInt(e.target.value, 0, 59))}
            onBlur={() => commit(hours, mins)}
            aria-label="分鐘"
          />
          <span className="text-xs text-gray-500">分</span>
        </div>
      </div>
      {/* Quick presets for common meditation increments */}
      <div className="flex gap-1.5 mt-2 flex-wrap">
        <button type="button" onClick={() => bump(10)}
          className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200">+10 分</button>
        <button type="button" onClick={() => bump(30)}
          className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200">+30 分</button>
        <button type="button" onClick={() => bump(60)}
          className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200">+1 時</button>
        {(hours > 0 || mins > 0) && (
          <button type="button" onClick={() => { setHours(0); setMins(0); commit(0, 0); }}
            className="text-[11px] px-2 py-1 rounded-full text-gray-400 hover:text-red-500 ml-auto">清除</button>
        )}
      </div>
    </div>
  );
}

function splitMinutes(v) {
  const n = Number.isFinite(v) ? v : 0;
  return { h: Math.floor(n / 60), m: n % 60 };
}

function clampInt(raw, min, max) {
  const n = parseInt(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}
