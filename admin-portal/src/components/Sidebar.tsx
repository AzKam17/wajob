'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, Users, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  {
    name: 'Scrapped Jobs',
    href: '/jobs',
    icon: Briefcase,
  },
  {
    name: 'Bot Users',
    href: '/bot-users',
    icon: Users,
  },
  {
    name: 'Conversations',
    href: '/conversations',
    icon: MessageSquare,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold">Admin Portal</h1>
      </div>
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
