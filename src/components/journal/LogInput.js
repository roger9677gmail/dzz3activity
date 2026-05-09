'use client';
import { useEffect, useState } from 'react';
import { durationStringToMinutes, minutesToDurationString } from '@/lib/practices';

// Single-row input for one practice on a given day.
//   - count: numeric input
//   - duration: HH:MM input (stored as minutes)
export default function LogInput({ practice, value, onChange }) {
  const isDuration = practice.type === 'duration';
  const [text, setText] = useState(() =>
    value == null ? '' : isDuration ? minutesToDurationString(value) : String(value)
  );
  const [error, setError] = useState('');

  useEffect(() => {
    setText(value == null ? '' : isDuration ? minutesToDurationString(value) : String(value));
  }, [value, isDuration]);

  function handleBlur() {
    if (text === '') {
      setError('');
      onChange(null);
      return;
    }
    if (isDuration) {
      const minutes = durationStringToMinutes(text);
      if (minutes == null) {
        setError('格式應為 HH:MM');
        return;
      }
      setError('');
      onChange(minutes);
    } else {
      const n = parseInt(text);
      if (!Number.isFinite(n) || n < 0) {
        setError('請輸入非負整數');
        return;
      }
      setError('');
      onChange(n);
    }
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
          <div className="text-[11px] text-gray-400">
            目標 {isDuration ? minutesToDurationString(target) : target} {!isDuration && (practice.unit_label || '次')}
          </div>
        )}
        {error && <div className="text-[11px] text-red-600 mt-0.5">{error}</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <input
          type={isDuration ? 'text' : 'number'}
          inputMode={isDuration ? 'text' : 'numeric'}
          min={isDuration ? undefined : 0}
          placeholder={isDuration ? '0:00' : '0'}
          className="input-field text-sm w-20 text-right"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
        />
        <span className="text-xs text-gray-400 w-8">{isDuration ? '時:分' : (practice.unit_label || '次')}</span>
      </div>
    </div>
  );
}
