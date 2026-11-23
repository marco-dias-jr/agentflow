import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = "primary",
  className = "",
  style,
  type = "button",
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary"
      ? "af-btn-primary"
      : variant === "secondary"
        ? "af-btn-secondary"
        : "border transition-all duration-200 hover:opacity-90";

  const dangerStyle =
    variant === "danger"
      ? {
          backgroundColor: "var(--danger-bg)",
          borderColor: "var(--danger-border)",
          color: "var(--danger-text)",
          ...style,
        }
      : style;

  return (
    <button
      type={type}
      className={`${variantClass} rounded-[3px] disabled:opacity-50 ${className}`.trim()}
      style={dangerStyle}
      {...props}
    />
  );
}
