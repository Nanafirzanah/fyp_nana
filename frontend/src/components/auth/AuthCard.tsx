import type { ReactNode } from "react";

/**
 * Shared frame for the login, forgot/reset password and onboarding pages:
 * the SafeFile blue background with soft dark-blue shapes, a wordmark and a
 * white card for the form.
 */
export default function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-blue-400 px-4 py-10">
      {/* Decorative shapes */}
      <div
        className="pointer-events-none absolute -left-24 -top-28 h-96 w-96 rounded-full bg-blue-800"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-blue-500"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-[45%] bg-blue-700"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm">
        <h1 className="mb-6 text-center text-5xl font-black tracking-wider text-blue-900 drop-shadow-sm">
          SAFE FILE
        </h1>
        <div className="rounded-2xl border border-white/40 bg-white/95 p-8 shadow-xl backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
