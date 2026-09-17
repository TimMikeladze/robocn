import { redirect } from "next/navigation"

import { AuthForm } from "@/components/studio/auth-form"
import { getSession } from "@/lib/studio/session"

export const metadata = { title: "Sign in" }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string }>
}) {
  const { next, email } = await searchParams
  if (await getSession()) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/studio")
  return <AuthForm mode="sign-in" next={next} email={email} />
}
