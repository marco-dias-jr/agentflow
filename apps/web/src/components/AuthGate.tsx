"use client";

import { ArrowLeft } from "lucide-react";
import { FormEvent, useState } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card, SurfaceInset } from "@/components/ui/Card";
import { FieldLabel, Input } from "@/components/ui/Input";
import {
  confirmPasswordReset,
  getUserFriendlyError,
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
      setError(
        getUserFriendlyError(
          err,
          "We couldn't sign you in right now. Please check your credentials and try again."
        )
      );
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
        getUserFriendlyError(
          err,
          "We couldn't create your account right now. Please verify your details and try again."
        )
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
      setError(
        getUserFriendlyError(
          err,
          "We couldn't send the verification code right now. Please try again in a moment."
        )
      );
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
        getUserFriendlyError(
          err,
          "We couldn't reset your password. Please verify your 6-digit code and try again."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Card className="animate-fade-in-up p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark />
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
          <SurfaceInset className="mt-5 grid grid-cols-2 gap-1 p-1 text-xs">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="rounded-[3px] py-1.5 font-medium transition-all duration-300"
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
              className="rounded-[3px] py-1.5 font-medium transition-all duration-300"
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
          </SurfaceInset>
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
          <AlertBanner variant="error" className="mt-4 px-3 py-2 text-xs">
            {error}
          </AlertBanner>
        )}

        {info && (
          <AlertBanner variant="info" className="mt-4 px-3 py-2 text-xs">
            {info}
          </AlertBanner>
        )}

        {mode === "login" && (
          <form
            key="login-form"
            onSubmit={handleLogin}
            className="animate-slide-reveal mt-4 space-y-3"
          >
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="px-3 py-2"
              />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-3 py-2"
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 text-sm font-semibold"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
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
              <FieldLabel>Full Name</FieldLabel>
              <Input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="px-3 py-2"
              />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="px-3 py-2"
              />
            </div>
            <div>
              <FieldLabel>CPF</FieldLabel>
              <Input
                type="text"
                required
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCpfMask(e.target.value))}
                placeholder="000.000.000-00"
                className="font-mono-tech px-3 py-2"
              />
            </div>
            <div>
              <FieldLabel>Password (min 8 chars, letters + numbers)</FieldLabel>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-3 py-2"
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 text-sm font-semibold"
            >
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
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
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="px-3 py-2"
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 text-sm font-semibold"
            >
              {isSubmitting ? "Sending code..." : "Send Verification Code"}
            </Button>
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
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2"
              />
            </div>
            <div>
              <FieldLabel>6-Digit Code</FieldLabel>
              <Input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="font-mono-tech px-3 py-2 tracking-widest"
              />
            </div>
            <div>
              <FieldLabel>New Password</FieldLabel>
              <Input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="px-3 py-2"
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 text-sm font-semibold"
            >
              {isSubmitting ? "Updating password..." : "Reset Password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
