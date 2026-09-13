"use client"

import { cn } from "@/lib/utils"

export interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  className?: string
}

/** A row of small machine-panel buttons: one axis of a demo, set directly. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={option === value}
            className={cn(
              "border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground",
              option === value &&
                "border-foreground bg-foreground text-background hover:text-background",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

export { Segmented }
