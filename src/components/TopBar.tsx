import React, { useState } from 'react';
import { BookOpen, Menu, X } from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'topics'
  | 'player'
  | 'mock'
  | 'tables'
  | 'mistakes';

interface TopBarProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  dueMistakeCount: number;
}

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'topics', label: 'Topics' },
  { id: 'player', label: 'Question Bank' },
  { id: 'mock', label: 'Mock Exam' },
  { id: 'tables', label: 'Tax Tables' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onNavigate,
  dueMistakeCount,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (tab: NavTab) => {
    onNavigate(tab);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 h-14 sm:h-16 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-3 sm:gap-6 sm:px-6 lg:px-8">
        {/* Zone 1: Clean single-line brand wordmark */}
        <button
          type="button"
          onClick={() => handleNav('overview')}
          className="flex shrink-0 items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
        >
          <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <BookOpen className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            TX Mastercoach{' '}
            <span className="font-mono text-xs font-semibold text-blue-700">FA25</span>
          </span>
        </button>

        {/* Zone 2: Max 5 concise single-line links with clean underline active indicator */}
        <nav
          aria-label="Primary navigation"
          className="hidden h-full items-center gap-5 lg:gap-7 md:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`relative flex h-full items-center whitespace-nowrap shrink-0 border-b-2 px-1 text-sm transition-colors focus-visible:outline-none ${
                  active
                    ? 'border-blue-700 font-semibold text-slate-900'
                    : 'border-transparent font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action CTA + mobile drawer toggle */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => handleNav('mistakes')}
            className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs sm:px-3.5 sm:py-2 sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              activeTab === 'mistakes'
                ? 'bg-slate-900 text-white'
                : 'bg-blue-700 text-white hover:bg-blue-800'
            }`}
          >
            Mistake Bank{dueMistakeCount > 0 ? ` (${dueMistakeCount})` : ''}
          </button>

          <button
            type="button"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileOpen((o) => !o)}
            className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 md:hidden"
          >
            {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Panel */}
      {mobileOpen && (
        <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`rounded-md px-3 py-2.5 text-left text-sm ${
                    active
                      ? 'bg-blue-50 font-semibold text-blue-900'
                      : 'font-medium text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
};
