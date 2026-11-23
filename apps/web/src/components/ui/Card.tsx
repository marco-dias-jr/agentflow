import { HTMLAttributes } from "react";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`af-card rounded-[3px] ${className}`.trim()}
      {...props}
    />
  );
}

export function SurfaceInset({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`af-surface-inset rounded-[3px] ${className}`.trim()}
      {...props}
    />
  );
}
