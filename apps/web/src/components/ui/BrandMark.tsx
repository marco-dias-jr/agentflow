import { BrainCircuit } from "lucide-react";

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className = "" }: BrandMarkProps) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border font-display text-sm font-bold tracking-tighter shadow-sm transition-all duration-300 ${className}`.trim()}
      style={{
        backgroundColor: "var(--accent-bg)",
        color: "var(--accent-text)",
        borderColor: "var(--border-default)",
      }}
    >
      <BrainCircuit className="h-5 w-5" aria-hidden="true" />
    </div>
  );
}
