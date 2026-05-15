'use client';
import { useEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;

// Full-screen image viewer with zoom + pan. Supports:
//   • Buttons: − / 重置 / + / ✕（一律可用，不挑裝置）
//   • 滑鼠滾輪縮放（桌機）
//   • 單指拖曳平移（縮放後）
//   • 雙指 pinch 縮放（手機 / 平板）
//   • Esc 關閉、點背景關閉
//
// Design note: we own the touch gestures with `touch-action: none` so
// the browser doesn't try to scroll or do its own pinch — otherwise on
// iOS Safari the modal would jump around mid-gesture.
export default function ImageLightbox({ src, alt = '', onClose }) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragStateRef = useRef(null); // { x, y, tx, ty } — single-pointer pan
  const pinchStateRef = useRef(null); // { dist, scale } — two-pointer zoom
  const pointersRef = useRef(new Map()); // id → {x, y}

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-' || e.key === '_') zoomOut();
      if (e.key === '0') reset();
    }
    document.addEventListener('keydown', onKey);
    // Prevent body scroll while open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clampScale(s) {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
  }

  function reset() {
    setScale(1);
    setTx(0);
    setTy(0);
  }
  function zoomIn() {
    setScale((s) => clampScale(s * 1.25));
  }
  function zoomOut() {
    setScale((s) => {
      const n = clampScale(s / 1.25);
      if (n <= 1) { setTx(0); setTy(0); }
      return n;
    });
  }

  function onWheel(e) {
    // Only intercept wheel inside the viewer; fine to preventDefault since
    // the surrounding layout is already overflow-hidden.
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  }

  function distanceBetween(pts) {
    const arr = [...pts.values()];
    const [a, b] = arr;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function onPointerDown(e) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointersRef.current.size === 2) {
      pinchStateRef.current = {
        dist: distanceBetween(pointersRef.current),
        scale,
      };
      dragStateRef.current = null;
    } else if (pointersRef.current.size === 1 && scale > 1) {
      dragStateRef.current = { x: e.clientX, y: e.clientY, tx, ty };
    }
  }
  function onPointerMove(e) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchStateRef.current && pointersRef.current.size === 2) {
      const next = distanceBetween(pointersRef.current);
      const ratio = next / pinchStateRef.current.dist;
      setScale(clampScale(pinchStateRef.current.scale * ratio));
      return;
    }
    if (dragStateRef.current) {
      const dx = e.clientX - dragStateRef.current.x;
      const dy = e.clientY - dragStateRef.current.y;
      setTx(dragStateRef.current.tx + dx);
      setTy(dragStateRef.current.ty + dy);
    }
  }
  function onPointerEnd(e) {
    pointersRef.current.delete(e.pointerId);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    if (pointersRef.current.size < 2) pinchStateRef.current = null;
    if (pointersRef.current.size === 0) dragStateRef.current = null;
  }

  // Click-to-close only on the surrounding backdrop, not on the image.
  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const isDragging = !!dragStateRef.current || !!pinchStateRef.current;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/95 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="圖片檢視"
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 text-white text-sm bg-black/50 shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            aria-label="縮小"
            className="w-9 h-9 rounded bg-white/10 hover:bg-white/20 active:bg-white/30 text-lg leading-none"
          >−</button>
          <span className="tabular-nums w-14 text-center text-xs text-white/90">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            aria-label="放大"
            className="w-9 h-9 rounded bg-white/10 hover:bg-white/20 active:bg-white/30 text-lg leading-none"
          >+</button>
          <button
            type="button"
            onClick={reset}
            className="ml-1 px-3 h-9 rounded bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs"
          >重置</button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="w-9 h-9 rounded bg-white/10 hover:bg-white/20 active:bg-white/30 text-base leading-none"
        >✕</button>
      </div>

      {/* Stage */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center select-none"
        onWheel={onWheel}
        onClick={onBackdropClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        style={{
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          touchAction: 'none',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-w-full max-h-full pointer-events-none"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        />
      </div>

      {/* Hint */}
      <div className="text-[11px] text-white/60 text-center py-1 bg-black/50 shrink-0">
        滾輪 / 雙指縮放 ・ 拖曳平移 ・ Esc 或點背景關閉
      </div>
    </div>
  );
}
