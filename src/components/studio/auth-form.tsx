"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Field, eyebrow, fieldClass } from "@/components/studio/kit"
import { authClient } from "@/lib/auth-client"

/** Only ever a path on this site: `next` comes from the URL. */
const safeNext = (next: string | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : "/studio"

function AuthForm({ mode, next, email }: { mode: "sign-in" | "sign-up"; next?: string; email?: string }) {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const signUp = mode === "sign-up"
  const other = signUp ? "sign-in" : "sign-up"
  const query = next ? `?next=${encodeURIComponent(next)}` : ""

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const credentials = {
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    }
    setPending(true)
    setError(null)
    const result = signUp
      ? await authClient.signUp.email({ ...credentials, name: String(form.get("name") ?? "").trim() })
      : await authClient.signIn.email(credentials)
    if (result.error) {
      setError(result.error.message ?? "That did not work. Check the details and try again.")
      setPending(false)
      return
    }
    router.push(safeNext(next))
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
      <div>
        <p className={eyebrow}>robocn Studio</p>
        <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">
          {signUp ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {signUp
            ? "One account, any number of organizations."
            : "Pick up where your team left off."}
        </p>
      </div>
      {signUp ? (
        <Field label="Name" htmlFor="name">
          <input id="name" name="name" required maxLength={80} autoComplete="name" className={fieldClass} />
        </Field>
      ) : null}
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={email}
          autoComplete="email"
          className={fieldClass}
        />
      </Field>
      <Field label="Password" htmlFor="password" hint={signUp ? "At least 8 characters." : undefined}>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={signUp ? "new-password" : "current-password"}
          className={fieldClass}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "One moment…" : signUp ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-[13px] text-muted-foreground">
        {signUp ? "Already have an account?" : "New here?"}{" "}
        <Link href={`/studio/${other}${query}`} className="font-medium text-foreground underline underline-offset-4">
          {signUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  )
}

export { AuthForm, safeNext }
