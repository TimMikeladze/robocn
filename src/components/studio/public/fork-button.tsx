"use client"

/**
 * Fork to Studio: a published design copied into a workspace the visitor can
 * edit. The page decides server-side which workspaces those are; this only
 * asks which one when there is a choice. It sits outside `/studio`, so it
 * brings its own toaster for the action's errors.
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { GitFork } from "lucide-react"

import { Modal, useAction } from "@/components/studio/kit"
import { Button, buttonVariants } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { forkPublished } from "@/lib/studio/actions/designs"
import { cn } from "@/lib/utils"

export interface ForkTarget {
  slug: string
  name: string
}

function ForkButton({
  slug,
  signedIn,
  targets,
}: {
  slug: string
  signedIn: boolean
  /** Workspaces where the visitor may create designs. */
  targets: ForkTarget[]
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  const [choosing, setChoosing] = React.useState(false)

  if (!signedIn) {
    return (
      <Link
        href={`/studio/sign-in?next=${encodeURIComponent(`/d/${slug}`)}`}
        className={cn(buttonVariants(), "w-full")}
      >
        <GitFork />
        Sign in to fork
      </Link>
    )
  }

  if (!targets.length) {
    return (
      <div className="space-y-2">
        <Link href="/studio" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Open Studio
        </Link>
        <p className="text-[12px] text-muted-foreground">
          Forking needs a workspace where you can create designs.
        </p>
      </div>
    )
  }

  const fork = async (orgSlug: string) => {
    const result = await call(() => forkPublished(orgSlug, slug), { success: "Forked." })
    if (result) router.push(`/studio/${orgSlug}/designs/${result.id}`)
  }

  return (
    <>
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={() => (targets.length === 1 ? fork(targets[0].slug) : setChoosing(true))}
      >
        <GitFork />
        {targets.length === 1 ? `Fork to ${targets[0].name}` : "Fork to Studio"}
      </Button>
      <Modal
        open={choosing}
        onClose={() => setChoosing(false)}
        eyebrow="Fork to Studio"
        title="Which workspace?"
        size="sm"
      >
        <ul className="-mx-1 space-y-0.5">
          {targets.map((target) => (
            <li key={target.slug}>
              <button
                type="button"
                disabled={pending}
                onClick={() => fork(target.slug)}
                className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-left text-[13px] transition-colors hover:bg-accent disabled:opacity-50"
              >
                <span className="truncate">{target.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {target.slug}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
      <Toaster position="bottom-right" />
    </>
  )
}

export { ForkButton }
