/**
 * A share link that is missing, expired or revoked. All three read the same on
 * purpose: the page should not confirm to a stranger that a token once worked.
 */

import Link from "next/link"

import { rail } from "@/components/site/rail"
import { eyebrow } from "@/components/studio/styles"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function SharedLinkGone() {
  return (
    <div className={cn(rail, "flex min-h-[60dvh] flex-col items-center justify-center py-16 text-center")}>
      <p className={eyebrow}>Share link</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        This link has expired or was revoked
      </h1>
      <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
        Share links are temporary. Ask whoever sent it for a new one, or see what teams have
        published for everyone.
      </p>
      <Link href="/explore" className={cn(buttonVariants({ variant: "outline" }), "mt-5")}>
        Explore published designs
      </Link>
    </div>
  )
}
