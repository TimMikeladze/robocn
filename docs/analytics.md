# Analytics

The site reports to [Umami](https://umami.is) — a self-hosted, cookieless page-view
counter — and only when it is told where to report. No consent banner, because
nothing is stored on the visitor's machine and no identifier follows them off the
page.

## The switch is the environment

`src/components/site/analytics.tsx` renders nothing unless
`NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set. That is the whole of the enable/disable
story: a clone, a fork, a preview built from someone else's branch and every
`pnpm dev` without a `.env.local` ship the site with no third-party script in it.

| variable | required | what it is |
| --- | --- | --- |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | yes, or nothing loads | the site's id in the Umami dashboard |
| `NEXT_PUBLIC_UMAMI_URL` | no | the full URL of the tracker script; defaults to `https://cloud.umami.is/script.js` |

`NEXT_PUBLIC_UMAMI_URL` is the script's URL, not the host, so a self-hosted
instance that serves the file from somewhere other than `/script.js` needs no code
change:

```bash
NEXT_PUBLIC_UMAMI_URL=https://linesofcode-umami.vercel.app/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=7da11a8a-03cf-4019-b7cc-a6ac11087297
```

Both are read as literal `process.env.NEXT_PUBLIC_…` member expressions in the
component, because that is the form Next inlines at build time; the decision
itself lives in `umamiConfig()`, a pure function taking the two values, which is
what the test drives.

## Where it is mounted

First thing in `<body>` in `src/app/layout.tsx`, with `strategy="afterInteractive"`
— the counter is not worth a millisecond of the first paint, and the machines on
this site are doing real work in that time. Every route is under the root layout,
so one mount covers the landing page, the catalogue, every docs page and the
workbench.

Page views are what `script.js` sends by itself on load and on every client-side
navigation. Nothing here calls `umami.track()`; if a custom event is ever worth
having, it goes through `window.umami?.track(...)` guarded by that optional chain,
so a build with analytics off still runs.
