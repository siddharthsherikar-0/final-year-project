import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { Spinner } from '@/components/ui/Spinner';
import {
  AuthLayout,
  AuthCardTitle,
  AuthProductName,
} from '@/components/auth/AuthLayout';

const labelClass = 'mb-1.5 block text-sm font-medium text-ink-muted';

const inputClass =
  'w-full rounded-md border border-control bg-elevated px-3 py-2 text-sm text-ink placeholder-ink-faint transition-colors duration-fast focus-ring';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await login(email, password);
    if (success) navigate('/dashboard');
  };

  return (
    <AuthLayout
      title="Your 3D assets, in one studio"
      description="Sign in to publish models, save assets to your library, and open any GLB or GLTF file in the real-time viewer."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="rounded-sm font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:text-ink focus-ring"
          >
            Create one
          </Link>
        </>
      }
    >
      <AuthProductName />
      <AuthCardTitle>Login</AuthCardTitle>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="login-email" className={labelClass}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={labelClass}>
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-[background-color,transform] duration-base hover:bg-accent-hover active:translate-y-px focus-ring disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" className="mr-2 !text-on-accent" />
              Signing in.
            </>
          ) : (
            'Login'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}

