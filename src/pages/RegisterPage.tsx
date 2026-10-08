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

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await register(email, name, password);
    if (success) navigate('/dashboard');
  };

  return (
    <AuthLayout
      title="Publish your first asset"
      description="Create a studio account to upload GLB and GLTF files, generate studio previews, and manage your own model library."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="rounded-sm font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:text-ink focus-ring"
          >
            Login
          </Link>
        </>
      }
    >
      <AuthProductName />
      <AuthCardTitle>Register</AuthCardTitle>

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
          <label htmlFor="register-name" className={labelClass}>
            Name
          </label>
          <input
            id="register-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="register-email" className={labelClass}>
            Email
          </label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="register-password" className={labelClass}>
            Password
          </label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
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
              Creating account.
            </>
          ) : (
            'Register'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
