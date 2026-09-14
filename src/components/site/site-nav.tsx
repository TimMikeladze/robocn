"use client"

/**
 * The primary nav, split out of the header so it can read `usePathname` without
 * dragging the whole header — logo lockup, social links, theme toggle — across
 * the server/client boundary.
 */

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

interface NavLink {
  href: string
  label: string
}

const links: NavLink[] = [
  { href: "/docs", label: "Components" },
  { href: "/workbench", label: "Workbench" },
  { href: "/docs/installation", label: "Install" },
]

/**
 * The longest matching href wins, so `/docs/installation` lights *Install*
 * rather than lighting both it and *Components*.
 */
function activeHref(pathname: string | null) {
  if (!pathname) return null
  const matches = links
    .map((link) => link.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
  return matches.sort((a, b) => b.length - a.length)[0] ?? null
}

function SiteNav({ className }: { className?: string }) {
  const active = activeHref(usePathname())

  return (
    <nav className={cn("flex items-center gap-4 text-[13px] font-medium sm:gap-5", className)}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active === link.href ? "page" : undefined}
          className={cn(
            "rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            active === link.href ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

export { SiteNav, activeHref }
