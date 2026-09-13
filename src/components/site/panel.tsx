import { cn } from "@/lib/utils"

/**
 * A bordered panel with datum ticks at two corners — the frame marks on a
 * machine drawing. Used wherever a live machine is on show.
 */
function Panel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("datum-frame border border-border bg-panel", className)}
      {...props}
    />
  )
}

export { Panel }
