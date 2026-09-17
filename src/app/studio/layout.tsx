import type { Metadata } from "next"

import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s — robocn Studio" },
  description:
    "A workspace for teams building with robocn: pose, theme, version, review and publish machines, and keep every file that goes with them.",
  // A workspace is private; only what it publishes belongs in an index.
  robots: { index: false, follow: false },
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" />
    </>
  )
}
