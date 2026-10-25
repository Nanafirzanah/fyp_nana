import { useState, type FormEvent } from "react";
import { Eye, EyeOff, User, Lock } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import AuthCard from "../components/auth/AuthCard";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please check your email and password.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <h2 className="text-center text-2xl font-bold text-slate-900">Login</h2>
      <p className="mb-6 mt-1 text-center text-sm text-slate-500">
        Please enter your Email and your Password
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <User
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-full border border-slate-300 py-2.5 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Email"
          />
        </div>

        <div className="relative">
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <Lock
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-full border border-slate-300 py-2.5 pl-9 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="text-right">
          <a
            href="/forgot-password"
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Forgot password?
          </a>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-blue-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Signing in..." : "Login"}
        </button>

        <p className="pt-1 text-center text-xs text-slate-500">
          Please contact your admin to register.
        </p>
      </form>
    </AuthCard>
  );
}
