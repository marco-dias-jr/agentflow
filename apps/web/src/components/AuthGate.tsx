"use client";

import { ArrowLeft, BrainCircuit } from "lucide-react";
import { FormEvent, useState } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import {
  confirmPasswordReset,
  loginAccount,
  registerAccount,
  requestPasswordResetCode,
  UserProfileDTO,
} from "@/lib/api";

type AuthMode = "login" | "register" | "forgot" | "reset";

function formatCpfMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

interface AuthGateProps {
  onAuthenticated: (user: UserProfileDTO) => void;
  theme: "dark" | "light";
  onToggleTheme: (nextTheme: "dark" | "light") => void;
}

export function AuthGate({
  onAuthenticated,
  theme,
  onToggleTheme,
}: AuthGateProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isRecoveryMode = mode === "forgot" || mode === "reset";

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    if (nextMode === "login" || nextMode === "register") {
      setInfo(null);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      const user = await loginAccount({ email, password });
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      const user = await registerAccount({ fullName, email, cpf, password });
      onAuthenticated(user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create account."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      const message = await requestPasswordResetCode(email);
      setInfo(message);
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      const message = await confirmPasswordReset({ email, code, newPassword });
      setInfo(message);
      setCode("");
      setNewPassword("");
      setPassword("");
      setMode("login");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to reset password."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="af-card animate-fade-in-up rounded-none p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-md border font-display text-sm font-bold tracking-tighter shadow-sm transition-all duration-300"
              style={{
                backgroundColor: "var(--accent-bg)",
                color: "var(--accent-text)",
                borderColor: "var(--border-default)",
              }}
            >
              <BrainCircuit className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1
                className="font-display text-xl font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                AgentFlow
              </h1>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Secure AI Agent &amp; RAG Workspace
              </p>
            </div>
          </div>

          <ThemeSwitcher theme={theme} onToggleTheme={onToggleTheme} />
        </div>

        {!isRecoveryMode ? (
          <div className="af-surface-inset mt-5 grid grid-cols-2 gap-1 rounded-none p-1 text-xs">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="rounded-none py-1.5 font-medium transition-all duration-300"
              style={
                mode === "login"
                  ? {
                      backgroundColor: "var(--accent-bg)",
                      color: "var(--accent-text)",
                    }
                  : { color: "var(--text-secondary)" }
              }
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className="rounded-none py-1.5 font-medium transition-all duration-300"
              style={
                mode === "register"
                  ? {
                      backgroundColor: "var(--accent-bg)",
                      color: "var(--accent-text)",
                    }
                  : { color: "var(--text-secondary)" }
              }
            >
              Create Account
            </button>
          </div>
        ) : (
          <div className="animate-fade-in mt-5 flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Sign In</span>
            </button>
            <span
              className="font-mono-tech text-[10px] uppercase tracking-widest"
              style={{ color: "var(--text-muted)" }}
            >
              {mode === "forgot" ? "Step 1 / 2" : "Step 2 / 2"}
            </span>
          </div>
        )}

        {error && (
          <div
            className="animate-slide-reveal mt-4 rounded-none border px-3 py-2 text-xs"
            style={{
              backgroundColor: "var(--danger-bg)",
              borderColor: "var(--danger-border)",
              color: "var(--danger-text)",
            }}
          >
            {error}
          </div>
        )}

        {info && (
          <div
            className="animate-slide-reveal mt-4 rounded-none border px-3 py-2 text-xs"
            style={{
              backgroundColor: "var(--selection-bg)",
              borderColor: "var(--border-strong)",
              color: "var(--text-primary)",
            }}
          >
            {info}
          </div>
        )}

        {mode === "login" && (
          <form
            key="login-form"
            onSubmit={handleLogin}
            className="animate-slide-reveal mt-4 space-y-3"
          >
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="af-input w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="af-input w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="af-btn-primary w-full rounded-none py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="text-xs transition-opacity duration-200 hover:underline hover:opacity-100"
                style={{ color: "var(--text-muted)" }}
              >
                Forgot your password?
              </button>
            </div>
          </form>
        )}

        {mode === "register" && (
          <form
            key="register-form"
            onSubmit={handleRegister}
            className="animate-slide-reveal mt-4 space-y-3"
          >
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Marco Antonio Dias Junior"
                className="af-input w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="af-input w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                CPF
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCpfMask(e.target.value))}
                placeholder="000.000.000-00"
                className="af-input font-mono-tech w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Password (min 8 chars, letters + numbers)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="af-input w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="af-btn-primary w-full rounded-none py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form
            key="forgot-form"
            onSubmit={handleForgot}
            className="animate-slide-reveal mt-4 space-y-3"
          >
            <div>
              <h2
                className="font-display text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Password Recovery
              </h2>
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Enter your registered email to receive a 6-digit verification code.
              </p>
            </div>
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="af-input w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="af-btn-primary w-full rounded-none py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Sending code..." : "Send Verification Code"}
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form
            key="reset-form"
            onSubmit={handleReset}
            className="animate-slide-reveal mt-4 space-y-3"
          >
            <div>
              <h2
                className="font-display text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Set New Password
              </h2>
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Enter the 6-digit code sent to your email and choose a new password.
              </p>
            </div>
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="af-input w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                6-Digit Code
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="af-input font-mono-tech w-full rounded-none px-3 py-2 text-sm tracking-widest"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="af-input w-full rounded-none px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="af-btn-primary w-full rounded-none py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {isSubmitting ? "Updating password..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
