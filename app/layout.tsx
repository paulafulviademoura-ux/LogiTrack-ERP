import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { SupabaseAuthProvider } from '@/components/SupabaseAuthProvider';

export const metadata: Metadata = {
  title: 'LogiTrack ERP',
  description: 'Gestão inteligente para sua logística',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        <SupabaseAuthProvider>
          {children}
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
