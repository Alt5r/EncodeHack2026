import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WATCHTOWER',
  description: 'Multi-agent LLM forest fire simulation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-sky">{children}</body>
    </html>
  );
}
