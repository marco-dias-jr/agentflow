import {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function FieldLabel({
  className = "",
  style,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1 block text-xs font-medium ${className}`.trim()}
      style={{ color: "var(--text-secondary)", ...style }}
      {...props}
    />
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`af-input w-full rounded-[4px] text-sm disabled:opacity-50 ${className}`.trim()}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`af-input w-full rounded-[4px] text-sm ${className}`.trim()}
      {...props}
    />
  );
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`af-input w-full rounded-[4px] text-sm disabled:opacity-50 ${className}`.trim()}
      {...props}
    />
  );
}
