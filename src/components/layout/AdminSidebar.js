'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { APP_VERSION } from '@/lib/version';

const navItems = [
  { href: '/admin', label: '總覽', exact: true, icon: '📊' },
  { href: '/admin/events', label: '活動管理', icon: '🏛️', perm: 'events:manage' },
  { href: '/admin/registrations', label: '繳款收據登錄', icon: '📋', perm: 'registrations:manage' },
  { href: '/admin/members', label: '師兄姐管理', icon: '👥', perm: 'members:manage' },
  { href: '/admin/locations', label: '道場管理', icon: '🏯', perm: 'locations:manage' },
  { href: '/admin/groups', label: '群組標籤', icon: '🏷️', perm: 'groups:manage' },
  { href: '/admin/practices', label: '功課項目', icon: '📿', perm: 'practices:manage' },
  { href: '/admin/announcements', label: '公告訊息', icon: '📢', perm: 'announcements:manage' },
  { href: '/admin/admins', label: '管理員設定', icon: '🛡️', perm: 'admins:manage' },
  { href: '/admin/reports', label: '報名查詢', icon: '🔍', perm: 'reports:view' },
  { href: '/admin/notifications', label: '推播通知', icon: '🔔', perm: 'notifications:send' },
];

export default function AdminSidebar({ permissions = [] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [open, setOpen] = useState(false);

  const visibleItems = useMemo(() => {
    const wildcard = permissions.includes('*');
    return navItems.filter((item) => !item.perm || wildcard || permissions.includes(item.perm));
  }, [permissions]);

  // Auto-close the mobile drawer on route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
    return undefined;
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <>
      {/* Mobile top bar — only below md */}
      <header className="md:hidden sticky top-0 z-30 bg-temple-red-dark text-white flex items-center px-4 h-12 shadow">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="開啟選單"
          className="p-1 -ml-1"
        >
          <span className="block w-6 h-0.5 bg-white mb-1.5" />
          <span className="block w-6 h-0.5 bg-white mb-1.5" />
          <span className="block w-6 h-0.5 bg-white" />
        </button>
        <div className="ml-3 font-bold text-sm">⛩️ 大自在山管理系統</div>
      </header>

      {/* Backdrop on mobile when open */}
      {open && (
        <button
          type="button"
          aria-label="關閉選單"
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-40"
        />
      )}

      {/* Sidebar — drawer on mobile, static column on md+ */}
      <aside
        className={`
          bg-temple-red-dark flex flex-col w-56 shrink-0
          fixed md:static top-0 left-0 z-50 overflow-y-auto
          h-[100dvh] md:h-auto md:min-h-screen
          transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}
      >
        <div className="p-4 border-b border-red-900 flex items-start justify-between gap-2">
          <div>
            <div className="text-white font-bold text-base leading-tight">⛩️ 大自在山管理系統</div>
            <div className="text-red-200 text-xs mt-1">後台管理 ・ {APP_VERSION}</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="關閉選單"
            className="md:hidden text-white text-xl leading-none px-1"
          >✕</button>
        </div>

        <nav className="flex-1 py-2">
          {visibleItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  active
                    ? 'bg-temple-red text-white font-medium'
                    : 'text-red-100 hover:bg-red-900'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          className="p-4 border-t border-red-900 space-y-2"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <Link
            href="/events"
            className="block w-full text-left text-red-200 hover:text-white text-sm py-1 transition-colors"
          >
            🙏 回師兄姐介面
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-left text-red-200 hover:text-white text-sm py-2 transition-colors"
          >
            {loggingOut ? '登出中...' : '🚪 登出'}
          </button>
        </div>
      </aside>
    </>
  );
}
