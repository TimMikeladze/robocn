import { Workbench } from "@/components/workbench/workbench"
import { ogImage } from "@/lib/og"
import { site } from "@/lib/site"

const description =
  "A Storybook for robots. Every robocn component, every prop on a knob, matrix views across two props at once — running from the repository's own source, so an edit lands on the stage through Fast Refresh."
const images = ogImage(
  "workbench",
  "Robot Workbench — a robot arm on a workbench stage beside its derived prop controls",
)

export const metadata = {
  title: "Robot Workbench",
  description,
  alternates: { canonical: "/workbench" },
  openGraph: {
    title: "Robot Workbench — robocn",
    description,
    url: `${site.url}/workbench`,
    images,
  },
  twitter: { card: "summary_large_image", images },
}

/** The pose is in the query string, and the query string is read per request. */
export const dynamic = "force-dynamic"

export default async function WorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  // `?component=` is what the docs pages used to link to; `?c=` is the short
  // form the workbench writes. Both open the same machine.
  const initialQuery = { ...query, c: query.c ?? query.component }
  return <Workbench initialQuery={initialQuery} />
}
