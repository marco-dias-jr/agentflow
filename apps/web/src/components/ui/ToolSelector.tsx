import { Check, Info, X } from "lucide-react";

export interface ToolOption {
  id: string;
  label: string;
}

interface ToolSelectorProps {
  label: string;
  tools: ToolOption[];
  selectedTools: string[];
  onToggle: (toolId: string) => void;
  keyPrefix?: string;
  inactiveSurface?: "tertiary" | "secondary";
  compact?: boolean;
}

export function ToolSelector({
  label,
  tools,
  selectedTools,
  onToggle,
  keyPrefix = "",
  inactiveSurface = "tertiary",
  compact = false,
}: ToolSelectorProps) {
  const inactiveBg =
    inactiveSurface === "secondary"
      ? "var(--bg-secondary)"
      : "var(--bg-tertiary)";

  return (
    <div>
      <span
        className={`${compact ? "mb-1" : "mb-1.5"} flex items-center gap-1.5 text-xs font-medium`}
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
        <span
          title="Click tags to enable or disable tools for this agent"
          className="inline-flex cursor-help items-center opacity-75 hover:opacity-100"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </span>
      <div className="flex flex-wrap gap-2">
        {tools.map((tool) => {
          const checked = selectedTools.includes(tool.id);
          return (
            <button
              key={`${keyPrefix}${tool.id}`}
              type="button"
              onClick={() => onToggle(tool.id)}
              className={`flex items-center gap-1.5 rounded-[3px] border px-3 ${compact ? "py-1" : "py-1.5"} text-xs font-medium transition-all duration-200`}
              style={
                checked
                  ? {
                      backgroundColor: "var(--badge-active-bg)",
                      borderColor: "var(--badge-active-border)",
                      color: "var(--badge-active-text)",
                    }
                  : {
                      backgroundColor: inactiveBg,
                      borderColor: "var(--border-default)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              {checked ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <X className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
              )}
              {tool.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
