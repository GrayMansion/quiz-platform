'use client';

import { ThemeProvider } from '@/components/ThemeProvider';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
