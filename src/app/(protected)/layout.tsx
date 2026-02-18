import { getSession } from '@/lib/supabase/get-session';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await getSession(); // redirects to /login if not authenticated
  return <>{children}</>;
}
