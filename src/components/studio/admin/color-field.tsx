"use client"

/**
 * A colour well with its hex beside it. The native picker is quick and the text
 * box is exact; a brand colour usually arrives as a string someone pasted.
 */

import * as React from "react"

import { fieldClass } from "@/components/studio/kit"
import { cn } from "@/lib/utils"

export const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value)

export function ColorField({
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  /** Names both inputs for a screen reader: "Accent colour", "Accent hex". */
  label: string
  disabled?: boolean
  className?: string
}) {
  // The text box holds whatever is being typed; only a whole hex is passed up.
  const [draft, setDraft] = React.useState<string | null>(null)
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <input
        type="color"
        aria-label={`${label} colour`}
        disabled={disabled}
        value={isHex(value) ? value : "#000000"}
        onChange={(event) => {
          setDraft(null)
          onChange(event.target.value)
        }}
        className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5 disabled:cursor-default disabled:opacity-50"
      />
      <input
        aria-label={`${label} hex`}
        disabled={disabled}
        value={draft ?? value}
        maxLength={7}
        spellCheck={false}
        onChange={(event) => {
          const next = event.target.value.trim()
          setDraft(next)
          if (isHex(next)) onChange(next.toLowerCase())
        }}
        onBlur={() => setDraft(null)}
        className={cn(fieldClass, "w-24 font-mono text-[12px]")}
      />
    </div>
  )
}
