"use client"

/** Studio's navigation: which organization, where in it, and who is asking. */

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Boxes,
  Check,
  ChevronsUpDown,
  FolderKanban,
  Globe,
  Images,
  LayoutDashboard,
  LogOut,
  Palette,
  Plus,
  Settings,
  UserRound,
  Users,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, eyebrow } from "@/components/studio/kit"
import { authClient } from "@/lib/auth-client"
import { parseRoles, roleLabels } from "@/lib/studio/permissions"
import { cn } from "@/lib/utils"

export interface SidebarProps {
  org: { name: string; slug: string }
  role: string
  user: { name: string; email: string }
  organizations: { name: string; slug: string }[]
  listed: boolean
}

const sections = (slug: string) => [
  { href: `/studio/${slug}`, label: "Overview", icon: LayoutDashboard, exact: true },
  { href: `/studio/${slug}/designs`, label: "Designs", icon: Boxes },
  { href: `/studio/${slug}/projects`, label: "Projects", icon: FolderKanban },
  { href: `/studio/${slug}/assets`, label: "Assets", icon: Images },
  { href: `/studio/${slug}/palettes`, label: "Palettes", icon: Palette },
  { href: `/studio/${slug}/members`, label: "Members", icon: Users },
  { href: `/studio/${slug}/settings`, label: "Settings", icon: Settings },
]

const item =
  "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground"

function Sidebar({ org, role, user, organizations, listed }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const held = parseRoles(role)[0]

  return (
    <aside className="flex shrink-0 flex-col border-b border-border bg-panel md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] md:w-56 md:border-b-0 md:border-r">
      <div className="border-b border-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Switch organization"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar name={org.name} className="size-7 rounded-md text-[10px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-tight">{org.name}</span>
              <span className={cn(eyebrow, "block truncate text-[9px]")}>
                {held ? roleLabels[held].label : "Member"}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              {organizations.map((entry) => (
                <DropdownMenuItem key={entry.slug} onClick={() => router.push(`/studio/${entry.slug}`)}>
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  {entry.slug === org.slug ? <Check className="size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/studio/onboarding")}>
              <Plus /> New organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav aria-label="Studio" className="flex gap-0.5 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-visible">
        {sections(org.slug).map(({ href, label, icon: Icon, exact }) => {
          const current = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link key={href} href={href} aria-current={current ? "page" : undefined} className={cn(item, "shrink-0")}>
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
        {listed ? (
          <Link href={`/o/${org.slug}`} className={cn(item, "shrink-0 md:mt-auto")}>
            <Globe className="size-4 shrink-0" />
            Public page
          </Link>
        ) : null}
      </nav>

      <div className="hidden border-t border-border p-2 md:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar name={user.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium leading-tight">{user.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52">
            <DropdownMenuItem onClick={() => router.push("/studio/account")}>
              <UserRound /> Account
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                await authClient.signOut()
                router.push("/studio/sign-in")
                router.refresh()
              }}
            >
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

export { Sidebar }
