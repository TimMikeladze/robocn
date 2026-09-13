import { cn } from "@/lib/utils"

/** A two-link arm reaching for the dot: the registry's mark. */
function Logo({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("size-5", className)}
      {...props}
    >
      <path
        d="M4 21h7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7.5 21V14L13.5 9.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="14" r="1.9" fill="currentColor" />
      <circle cx="13.5" cy="9.5" r="1.9" fill="currentColor" />
      <path d="M15 8.5 19 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="19.5" cy="4.5" r="2.4" className="fill-signal" />
    </svg>
  )
}

export { Logo }
