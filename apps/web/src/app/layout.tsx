import type { Metadata } from 'next';
import { JetBrains_Mono, Sora, Unbounded } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

const display = Unbounded({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '900'],
});

const body = Sora({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600', '700'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'QuestLine — Level Up Your Life',
  description:
    'A gamified habit tracker with XP, streaks, a living 3D crystal, and an AI coach that builds your 7-day roadmap.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-void font-body text-ink antialiased">
        <div className="bg-grid pointer-events-none fixed inset-0 z-0" aria-hidden />
        <div className="bg-orbs pointer-events-none fixed inset-0 z-0" aria-hidden />
        <div className="relative z-10">
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}
