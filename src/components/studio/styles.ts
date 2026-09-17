/**
 * The class strings Studio shares between server and client components.
 *
 * They live outside `kit.tsx` on purpose. The kit is a client module, and to a
 * server component a client module's *string* export is a reference, not a
 * string: `cn(eyebrow, …)` drops it without a word. Anything a server page
 * needs as a plain value is here; the kit re-exports it for client callers.
 */

export const eyebrow = "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"

export const fieldClass =
  "h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
