"use client"

/**
 * Which pages get the site's header and footer.
 *
 * Studio is an app frame with its own navigation, so it keeps the header and
 * drops the footer; an embed is somebody else's page, so it gets neither.
 */

import { usePathname } from "next/navigation"

const isEmbed = (pathname: string | null) => !!pathname?.startsWith("/embed/")
const isApp = (pathname: string | null) => pathname === "/studio" || !!pathname?.startsWith("/studio/")

function HeaderSlot({ children }: { children: React.ReactNode }) {
  return isEmbed(usePathname()) ? null : children
}

function FooterSlot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return isEmbed(pathname) || isApp(pathname) ? null : children
}

export { FooterSlot, HeaderSlot, isApp, isEmbed }
