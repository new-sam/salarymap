import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '../../lib/cn';
import { useT } from '../../lib/i18n';
import { supabase } from '../../lib/supabaseClient';
import { Briefcase, CheckSquare, Calendar, ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import Brand from './Brand';
import LangToggle from './LangToggle';
import Truncate from '../ui/truncate';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '../ui/dropdown-menu';

// Mobile-only top header + 3-tab nav for the company-side ATS.
// Visual matches the desktop sidebar (dark) so the recruiter knows they're in
// the workspace, not the candidate-facing site. The right chip mirrors the
// sidebar's "company + signed-in email" block; tap opens a logout menu.
export default function MobileNav({ active, companyName, userEmail }) {
  const router = useRouter();
  const { t } = useT();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/for-companies');
  };

  // Tab order: 해야 할 일 first (the recruiter's most frequent "what's next" check),
  // then 공고 확인 in the middle (the natural drill-down hub), then 인터뷰 일정.
  const tabs = [
    { key: 'todo',     href: '/company/todo',     icon: CheckSquare, label: t('company.sidebar.todo') },
    { key: 'home',     href: '/company',          icon: Briefcase,   label: t('company.mobileNav.jobs') },
    { key: 'calendar', href: '/company/calendar', icon: Calendar,    label: t('company.mobileNav.calendar') },
  ];

  return (
    <header className="md:hidden sticky top-0 z-30 -mx-4 bg-[#0A0A0A] border-b border-white/5">
      {/* Brand row — FYI logo (same /logo.png as desktop sidebar) left,
          company + email chip middle (tap → logout menu), language toggle right. */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Brand href="/company" size="md" />
        <div className="flex-1" />
        {(companyName || userEmail) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 max-w-[55%] min-w-0 h-8 px-2.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <Truncate
                  className="text-[12.5px] font-extrabold text-white tracking-tight"
                  stopPropagation={false}
                >
                  {companyName || userEmail}
                </Truncate>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[240px]">
              <div className="px-2 py-2">
                {companyName && (
                  <div className="text-[14px] font-extrabold text-gray-900 truncate">
                    {companyName}
                  </div>
                )}
                {userEmail && (
                  <div className="text-[12px] text-gray-600 font-semibold truncate mt-1 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                    {userEmail}
                  </div>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-700">
                <LogOut className="w-4 h-4 text-red-500" />
                {t('company.sidebar.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <LangToggle align="right" />
      </div>

      {/* Tab row */}
      <nav className="flex border-t border-white/5">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={cn(
                'flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 h-11 text-[12.5px] font-extrabold transition-colors border-b-2 px-1',
                isActive
                  ? 'text-primary-300 bg-primary-500/15 border-primary-400'
                  : 'text-gray-400 border-transparent hover:bg-white/5'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
