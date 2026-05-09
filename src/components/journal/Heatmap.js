'use client';
import { useMemo } from 'react';
import { addDays, dateRange, todayDateString } from '@/lib/practices';

// 7 rows × N weeks heatmap of last `days` days for a single practice.
// Color tiers (when dailyTarget is set):
//   無紀錄 → gray-200
//   ≤25%  → temple-red/20
//   ≤50%  → temple-red/40
//   ≤75%  → temple-red/60
//   <100% → temple-red/80
//   達標   → temple-red
// When no target: any value > 0 → full red, else gray.
function classifyValue(v, target) {
  if (v == null) return 'empty';
  if (target == null || target <= 0) return v > 0 ? 'hit' : 'empty';
  const pct = (v / target) * 100;
  if (pct >= 100) return 'hit';
  if (pct > 75) return 'p99';
  if (pct > 50) return 'p75';
  if (pct > 25) return 'p50';
  if (pct > 0) return 'p25';
  return 'empty';
}

const TIER_CLASS = {
  empty: 'bg-gray-200',
  p25: 'bg-temple-red/20',
  p50: 'bg-temple-red/40',
  p75: 'bg-temple-red/60',
  p99: 'bg-temple-red/80',
  hit: 'bg-temple-red',
};

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
    const tier = classifyValue(logsByDate[date], dailyTarget);
    return TIER_CLASS[tier];
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
      {dailyTarget != null && dailyTarget > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400 flex-wrap">
          <span className="w-3 h-3 rounded-sm bg-gray-200" /><span>無紀錄</span>
          <span className="w-3 h-3 rounded-sm bg-temple-red/20 ml-1" /><span>≤25%</span>
          <span className="w-3 h-3 rounded-sm bg-temple-red/40 ml-1" /><span>≤50%</span>
          <span className="w-3 h-3 rounded-sm bg-temple-red/60 ml-1" /><span>≤75%</span>
          <span className="w-3 h-3 rounded-sm bg-temple-red/80 ml-1" /><span>＜100%</span>
          <span className="w-3 h-3 rounded-sm bg-temple-red ml-1" /><span className="text-temple-red font-medium">達標</span>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-400">
          <span className="w-3 h-3 rounded-sm bg-gray-200" /><span>無紀錄</span>
          <span className="w-3 h-3 rounded-sm bg-temple-red ml-2" /><span>已修</span>
        </div>
      )}
    </div>
  );
}
