'use client';
import { useMemo } from 'react';
import { addDays, dateRange, todayDateString } from '@/lib/practices';

// 7 rows × N weeks heatmap of last `days` days for a single practice.
// Rows: Mon..Sun. Cols: oldest week → newest week.
// Cell colors: bg-temple-red (hit goal), bg-temple-red/40 (logged but didn't hit),
//              bg-gray-200 (no log), bg-transparent (future).
export default function Heatmap({ days = 90, logsByDate = {}, dailyTarget = null, onCellClick }) {
  const today = todayDateString();
  const start = useMemo(() => addDays(today, -(days - 1)), [today, days]);
  const range = useMemo(() => dateRange(start, today), [start, today]);

  // Pad start to align on Monday for clean columns.
  const firstDate = new Date(start + 'T00:00:00Z');
  const dow = (firstDate.getUTCDay() + 6) % 7; // 0 = Mon
  const padded = Array(dow).fill(null).concat(range);

  const cols = Math.ceil(padded.length / 7);
  const grid = Array.from({ length: cols }, (_, c) =>
    Array.from({ length: 7 }, (_, r) => padded[c * 7 + r] || null)
  );

  function cellClass(date) {
    if (!date) return 'bg-transparent';
    const v = logsByDate[date];
    if (v == null) return 'bg-gray-200';
    if (dailyTarget != null && dailyTarget > 0) {
      return v >= dailyTarget ? 'bg-temple-red' : 'bg-temple-red/40';
    }
    return v > 0 ? 'bg-temple-red' : 'bg-gray-200';
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <div className="inline-grid gap-0.5 px-1" style={{ gridTemplateColumns: `repeat(${cols}, 12px)` }}>
        {grid.map((col, ci) => (
          <div key={ci} className="grid grid-rows-7 gap-0.5">
            {col.map((d, ri) => (
              <button
                key={ri}
                type="button"
                disabled={!d || !onCellClick}
                onClick={() => d && onCellClick && onCellClick(d)}
                className={`w-3 h-3 rounded-sm ${cellClass(d)} ${d && onCellClick ? 'hover:ring-1 hover:ring-temple-red' : ''}`}
                aria-label={d ? `${d}：${logsByDate[d] != null ? logsByDate[d] : '無紀錄'}` : ''}
                title={d ? `${d}：${logsByDate[d] != null ? logsByDate[d] : '無紀錄'}` : ''}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
        <span>少</span>
        <span className="w-3 h-3 rounded-sm bg-gray-200" />
        <span className="w-3 h-3 rounded-sm bg-temple-red/40" />
        <span className="w-3 h-3 rounded-sm bg-temple-red" />
        <span>多</span>
      </div>
    </div>
  );
}
