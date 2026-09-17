import { RobotFace } from "@/components/ui/robot-face"

/** Sign-in and sign-up share a frame: the form on the left, a machine keeping watch on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex items-center justify-center px-5 py-12">{children}</div>
      <div className="hidden items-center justify-center border-l border-border bg-panel lg:flex">
        <div className="text-center">
          <RobotFace size="xl" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Pose · version · review · publish
          </p>
        </div>
      </div>
    </div>
  )
}
