'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    href: '/events',
    label: '法會活動',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/announcements',
    label: '公告訊息',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 3.94c.36-1.25 2.13-1.25 2.49 0l.48 1.67c.13.45.47.81.92.94l1.69.49c1.24.36 1.24 2.12 0 2.49l-1.69.48a1.31 1.31 0 00-.92.94l-.48 1.7c-.36 1.24-2.13 1.24-2.49 0l-.48-1.7a1.31 1.31 0 00-.92-.94l-1.69-.48c-1.24-.37-1.24-2.13 0-2.49l1.69-.49a1.31 1.31 0 00.92-.94l.48-1.67zM18 14.25l.41 1.21c.06.18.2.32.39.37l1.21.42c.43.12.43.74 0 .86l-1.21.41a.62.62 0 00-.39.38L18 18.75l-.41-1.21a.62.62 0 00-.39-.38l-1.21-.41c-.43-.12-.43-.74 0-.86l1.21-.42a.62.62 0 00.39-.37L18 14.25z" />
      </svg>
    ),
  },
  {
    href: '/journal',
    label: '修行日誌',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: '個人資料',
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function MemberNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
      <div className="flex">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                active ? 'text-temple-red' : 'text-gray-400'
              }`}
            >
              {item.icon(active)}
              <span className={active ? 'font-medium' : ''}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
