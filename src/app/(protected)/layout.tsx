import { getSession } from '@/lib/supabase/get-session';
import { ErrorBoundary } from '@/components/error-boundary';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getSession(); // redirects to /login if not authenticated
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
