'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/');
      }
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Vortex
          </h1>
          <p className="text-zinc-400 mt-2 text-sm">AI-powered knowledge base</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl shadow-black/20">
          <h2 className="text-xl font-semibold text-zinc-100 mb-6">Log in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-950/50 border border-red-800/50 text-red-300 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-300 mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-300 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
