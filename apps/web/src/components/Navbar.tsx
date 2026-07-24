'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

interface NavbarProps {
  children?: React.ReactNode;
}

export default function Navbar({ children }: NavbarProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => { if (d.data) setUser(d.data); })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [dropdownOpen]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setDropdownOpen(false);
    router.push('/');
    router.refresh();
  };

  const initial = user?.displayName?.[0]?.toUpperCase() || '?';

  return (
    <header className="border-b border-border bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-primary-600">Quiz Platform</Link>
        </div>

        {/* Center: page-specific content */}
        {children && <div className="flex items-center gap-3">{children}</div>}

        {/* Right: Profile dropdown */}
        <div ref={dropdownRef} className="relative">
          {user ? (
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-8 hover:bg-gray-100 transition-colors"
              aria-label="Account menu"
            >
              <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-bold">
                {initial}
              </span>
              <div className="text-left hidden sm:block">
                <div className="text-label font-medium leading-tight">{user.displayName}</div>
                <div className="text-xs text-text-secondary leading-tight">{user.role === 'ORGANIZER' ? 'Organizer' : 'Participant'}</div>
              </div>
              <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-8 hover:bg-gray-100 transition-colors"
              aria-label="Account menu"
            >
              <span className="w-7 h-7 rounded-full bg-gray-200 text-text-secondary flex items-center justify-center text-sm font-bold">?</span>
              <span className="text-label hidden sm:inline">Profile</span>
              <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-12 shadow-lg z-50 py-1 overflow-hidden"
              role="menu">
              {user ? (
                <>
                  <Link href="/dashboard" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-label hover:bg-gray-50 transition-colors"
                    role="menuitem">
                    📊 Dashboard
                  </Link>
                  <button onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2.5 text-label hover:bg-gray-50 transition-colors w-full text-left"
                    role="menuitem">
                    🚪 Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-label hover:bg-gray-50 transition-colors"
                    role="menuitem">
                    🔐 Log in
                  </Link>
                  <Link href="/register" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-label hover:bg-gray-50 transition-colors"
                    role="menuitem">
                    ✨ Create account
                  </Link>
                </>
              )}
              <div className="border-t border-border my-1" />
              <button onClick={() => { toggleTheme(); setDropdownOpen(false); }}
                className="flex items-center gap-2 px-4 py-2.5 text-label hover:bg-gray-50 transition-colors w-full text-left"
                role="menuitem">
                {theme === 'light' ? '🌙 Dark theme' : '☀️ Light theme'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
