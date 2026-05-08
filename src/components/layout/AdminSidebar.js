'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/admin', label: '總覽', exact: true, icon: '📊' },
  { href: '/admin/events', label: '法會管理', icon: '🏛️' },
  { href: '/admin/registrations', label: '報名管理', icon: '📋' },
  { href: '/admin/members', label: '師兄姐管理', icon: '👥' },
  { href: '/admin/admins', label: '管理員設定', icon: '🛡️' },
  { href: '/admin/reports', label: '報表匯出', icon: '📄' },
  { href: '/admin/notifications', label: '推播通知', icon: '🔔' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <aside className="w-56 bg-temple-red-dark min-h-screen flex flex-col shrink-0">
      <div className="p-4 border-b border-red-900">
        <div className="text-white font-bold text-base leading-tight">⛩️ 佛堂管理系統</div>
        <div className="text-red-200 text-xs mt-1">後台管理</div>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
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

      <div className="p-4 border-t border-red-900">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full text-left text-red-200 hover:text-white text-sm py-2 transition-colors"
        >
          {loggingOut ? '登出中...' : '🚪 登出'}
        </button>
      </div>
    </aside>
  );
}
