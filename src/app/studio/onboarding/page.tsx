import { OnboardingForm } from "@/components/studio/onboarding-form"
import { listMemberships, requireUser } from "@/lib/studio/session"

export const metadata = { title: "New organization" }

export default async function OnboardingPage() {
  const user = await requireUser("/studio/onboarding")
  const memberships = await listMemberships(user.id)
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-5 py-12">
      <OnboardingForm first={memberships.length === 0} />
    </div>
  )
}
