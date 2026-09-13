import { site } from "@/lib/site"

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Robotic components you can install, theme, and control in your own app.
        </p>
        <div className="flex items-center gap-4">
          <a href={site.repository} className="hover:text-foreground" target="_blank" rel="noreferrer">
            Source
          </a>
          <a href="https://ui.shadcn.com/docs/registry" className="hover:text-foreground" target="_blank" rel="noreferrer">
            shadcn registry
          </a>
        </div>
      </div>
    </footer>
  )
}

export { SiteFooter }
