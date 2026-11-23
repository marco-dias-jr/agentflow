import { ReactNode } from "react";

type AlertVariant = "error" | "info";

interface AlertBannerProps {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
}

export function AlertBanner({
  variant = "error",
  children,
  className = "",
  onDismiss,
}: AlertBannerProps) {
  const styles =
    variant === "error"
      ? {
          backgroundColor: "var(--danger-bg)",
          borderColor: "var(--danger-border)",
          color: "var(--danger-text)",
        }
      : {
          backgroundColor: "var(--selection-bg)",
          borderColor: "var(--selection-border)",
          color: "var(--text-primary)",
        };

  return (
    <div
      className={`animate-slide-reveal rounded-[3px] border ${className}`.trim()}
      style={styles}
    >
      {onDismiss ? (
        <div className="flex items-center justify-between gap-3">
          <span>{children}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
