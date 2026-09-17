# robocn Studio

`/studio` is the hosted half of robocn: a multi-tenant workspace where a team poses, themes,
versions, reviews and publishes machines from the registry, and keeps every file that goes
with them. The workbench is one person and a checkout; Studio is a team and a database.

## What a design is

A **design** is a registry machine plus everything that was decided about it: the props
(the *pose*), the stage it is shown on, and the history of both. Nothing is compiled or
uploaded — a design is data, and the machine on screen is the real module from
`src/components/ui`, mounted through the workbench's own lazy registry and driven by the
workbench's own derived controls. A prop added to a machine is a knob in Studio with no
second file to update.

```
organization ─┬─ member (owner · admin · editor · viewer) / invitation
              ├─ project ── design ─┬─ design_version   pose + stage, numbered, immutable
              │                     ├─ comment           threaded, resolvable, pinned to a version
              │                     ├─ design_asset      reference files from the library
              │                     └─ share_link        tokened, expiring, view-only
              ├─ asset_folder ── asset ── asset_blob     bytes, when the driver is postgres
              ├─ palette                                  named colour sets, applied to any design
              ├─ label                                    coloured tags on designs
              ├─ workflow stages                          org-defined review states (json on org settings)
              └─ activity                                 who did what, to what, when
```

## Decisions

- **Auth** — better-auth, email + password, `organization` plugin with an access-control
  map adding `editor` and `viewer` to the stock roles. In development every origin is
  trusted and the base URL is taken from the request, so the app works on whatever port it
  lands on. Invitations are links: there is no mail provider, so the inviter copies the link
  (and the dev server logs it). Swapping in a mailer is one function in `src/lib/auth.ts`.
- **Two doors, one rule.** better-auth's own endpoints (`/api/auth/organization/*`) are a
  second way to write an organization row. `organizationHooks` in `src/lib/auth.ts` hold
  them to Studio's rules: a slug is never a reserved word, and `settings` is dropped from
  any client payload — only `updateSettings` writes it, after validating it and checking
  that the logo and palette it names belong to the organization.
- **Database** — Postgres through `postgres` + drizzle. Schema in `src/db/schema/`,
  migrations in `drizzle/`, `pnpm db:generate` / `pnpm db:migrate`. One pooled client cached
  on `globalThis` so Fast Refresh does not leak connections.
- **Authorization** — one pure function, `can(role, permission)`, in
  `src/lib/studio/permissions.ts`. Every server action and route handler resolves the
  session, the active organization and the member row through `requireMember()` and checks
  `can` before touching a row; every query is scoped by `organization_id`. Server actions
  are public POST endpoints and are written as such.
- **Versions are immutable.** Saving writes a new numbered `design_version`; restoring an
  old one writes a new version with the old pose. The editor autosaves nothing — a version
  is a decision, and it carries a note.
- **Publishing** freezes one version under a public slug: `/d/<slug>` (page),
  `/embed/<slug>` (chrome-less, for iframes), `/api/studio/published/<slug>` (JSON).
  Republishing moves the pointer; unpublishing clears it. Published designs can be forked
  into any workspace the visitor can edit. `/o/<org>` is the organization's public gallery.
- **Assets** — a real library, not an attachment field: nested folders, multi-file upload,
  rename, move, tag, search, filter by kind, sort, bulk select, trash with restore, permanent
  delete, replace-in-place, public links, usage ("where is this used"), per-org storage
  total. Bytes go through a `StorageDriver`: `postgres` (bytea, default — zero setup) or
  `vercel-blob` when `BLOB_READ_WRITE_TOKEN` is set. `sharp` reads dimensions and writes a
  WebP thumbnail on upload. Files are served from `/api/studio/assets/<id>/file` with
  `nosniff` and a sandboxing CSP, because an uploaded SVG is a document.
- **Thumbnails** — saving a version snapshots the stage with `src/lib/robocn/capture.ts` and
  stores it as WebP; cards show it and fall back to mounting the machine.
- **Customization** — per organization: workflow stages (names, colours, which one means
  "done"), labels, brand palettes (the six palette roles, applied to any machine), default
  stage background, public profile (logo asset, accent, tagline). Per design: every prop
  the machine has.

## Routes

```
/studio                         the pitch when signed out; otherwise onboarding or the active org
/studio/sign-in · /sign-up      auth
/studio/onboarding              create the first organization
/studio/invite/[id]             accept an invitation
/studio/[org]                   dashboard: recent designs, activity
/studio/[org]/designs           all designs: search, stage, label, project filters
/studio/[org]/designs/new       pick a machine (or a published design) to start from
/studio/[org]/designs/[id]      the editor
/studio/[org]/projects[/id]     projects
/studio/[org]/assets            the asset library
/studio/[org]/palettes          brand palettes
/studio/[org]/members           members, roles, invitations
/studio/[org]/settings          general, workflow, labels, public profile, danger zone
/studio/account                 profile, password, sessions
/d/[slug] · /embed/[slug]       published design
/s/[token]                      private share link
/o/[org]                        public gallery
/explore                        everything published, across organizations
```

## Layout of the code

```
src/db/                 client, schema, migrate
src/lib/auth.ts         better-auth server · src/lib/auth-client.ts  browser
src/lib/studio/         permissions, session, slugs, storage drivers, queries, validation
src/lib/studio/actions/ server actions: designs, assets, asset-browse, workspace
src/app/api/studio/     upload, file and thumbnail serving, published JSON
src/components/studio/  kit (shared parts), sidebar, editor/, assets/, admin/, public/
```

## Known limits

- No mail provider: invitations are links, email is unverified, there is no password reset
  mail. `sendInvitationEmail` in `src/lib/auth.ts` is the seam.
- `updateSettings` takes the whole settings object, so two admins saving different sections
  at the same moment can overwrite each other. The settings page guards against its own
  stale props; a per-section patch would close the rest.
- No billing or plan limits. Storage is metered and shown, not capped, beyond 25 MB a file.
- Published designs are not in `sitemap.xml` (it is built without a database); `/explore`
  links to all of them.

## Verification

Unit tests cover the pure parts: permissions, slugs, settings parsing, pose sanitizing and
diffing, asset kinds, activity sentences. `src/lib/studio/__tests__/data.int.test.ts` runs
the data layer against `DATABASE_URL_TEST` — tenancy scoping, search escaping, a file's
bytes following its row in and out of storage, folder and project counts, publishing — and
is skipped when that variable is unset. `server-only` is aliased to a stub under vitest.
The UI was verified in a browser against a running dev server on a non-default origin.
