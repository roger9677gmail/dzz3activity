'use client';
import { useState } from 'react';

function fmt(v) {
  if (!v) return '';
  return String(v).slice(0, 16).replace('T', ' ');
}

export default function AnnouncementsClient({ announcements }) {
  const [openId, setOpenId] = useState(null);

  return (
    <div>
      <div className="page-header">
        <h1 className="text-lg font-bold">公告訊息</h1>
        <p className="text-red-200 text-sm">共 {announcements.length} 則</p>
      </div>

      <div className="p-4 space-y-3">
        {announcements.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p>目前沒有公告</p>
          </div>
        )}

        {announcements.map((a) => {
          const isOpen = openId === a.id;
          return (
            <div key={a.id} className="card overflow-hidden">
              <div
                className="p-4 cursor-pointer"
                onClick={() => setOpenId(isOpen ? null : a.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-temple-dark">
                      {a.pinned ? <span className="text-temple-red mr-1">📌</span> : null}
                      {a.title}
                    </h3>
                    <div className="text-xs text-gray-400 mt-1">{fmt(a.created_at)}</div>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">{isOpen ? '收合 ▲' : '展開 ▼'}</span>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {a.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image} alt="" className="w-full rounded-lg" />
                    )}
                    {a.content && (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">{a.content}</div>
                    )}
                    {(a.link_url || a.attachment_url) && (
                      <div className="flex flex-wrap gap-2">
                        {a.link_url && (
                          <a
                            href={a.link_url} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-sm text-temple-red underline"
                          >🔗 開啟連結</a>
                        )}
                        {a.attachment_url && (
                          <a
                            href={a.attachment_url} target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-sm text-temple-red underline"
                          >📎 {a.attachment_name || '附件'}</a>
                        )}
                      </div>
                    )}
                    {a.ends_at && (
                      <div className="text-[11px] text-gray-400">
                        有效至 {fmt(a.ends_at)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
