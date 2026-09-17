"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Field, eyebrow, fieldClass } from "@/components/studio/kit"
import { createOrganization } from "@/lib/studio/actions/workspace"
import { slugify } from "@/lib/studio/ids"

function OnboardingForm({ first }: { first: boolean }) {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const shown = slug ?? slugify(name)

  return (
    <form
      className="w-full max-w-md space-y-5"
      onSubmit={async (event) => {
        event.preventDefault()
        setPending(true)
        setError(null)
        const result = await createOrganization({ name, slug: slug ?? undefined })
        if (!result.ok) {
          setError(result.error)
          setPending(false)
          return
        }
        router.push(`/studio/${result.data.slug}`)
        router.refresh()
      }}
    >
      <div>
        <p className={eyebrow}>{first ? "Step 1 of 1" : "New organization"}</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">Name your organization</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          An organization holds designs, files and the people who work on them. You can belong to
          several and invite others once it exists.
        </p>
      </div>
      <Field label="Name" htmlFor="org-name">
        <input
          id="org-name"
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Acme Robotics"
          className={fieldClass}
        />
      </Field>
      <Field label="URL" htmlFor="org-slug" hint="Lowercase letters, numbers and dashes.">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[12px] text-muted-foreground">/studio/</span>
          <input
            id="org-slug"
            value={shown}
            maxLength={48}
            onChange={(event) => setSlug(slugify(event.target.value))}
            className={fieldClass}
          />
        </div>
      </Field>
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {pending ? "Creating…" : "Create organization"}
      </Button>
    </form>
  )
}

export { OnboardingForm }
