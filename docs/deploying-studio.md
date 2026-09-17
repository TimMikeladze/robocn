# Deploying

One repository, one Vercel project, one rule: **main is production**. A push to `main`
builds, migrates and deploys; a pull request gets its own URL and its own database.

```
push to main ──▶ Vercel build ──▶ pnpm generate            the workbench manifest
                                  pnpm registry:build      the registry JSON
                                  node scripts/db-deploy   migrations, production only
                                  next build
                            └──▶ https://robocn.dev
open a PR    ──▶ preview build (no migration) ──▶ https://robocn-<hash>.vercel.app
```

## Migrations

`scripts/db-deploy.mjs` runs `drizzle-kit migrate` as part of the build, and refuses to run
anywhere but a production build:

| where | what it does |
| --- | --- |
| a developer's machine | nothing — `pnpm db:migrate` is the local command |
| a preview build | nothing, so a preview can never migrate production |
| a production build with no `DATABASE_URL` | nothing, and the build carries on: the marketing half needs no Postgres |
| a production build | applies `drizzle/*.sql`, and **fails the deployment** if a migration fails |

Migrating during the build means the schema lands before the new code serves traffic, and
it means the old code is briefly running against the new schema. Write migrations that both
versions can live with — add a column, backfill, then drop the old one in a later release —
rather than one that renames something out from under the deployment that is still up.

## Environments

| | database | secret |
| --- | --- | --- |
| production | `robocn_studio_production` | its own `BETTER_AUTH_SECRET` |
| preview | `robocn_studio` | a different one |
| development | `robocn_studio`, from `.env.local` | whatever is in `.env.local` |

All three are on the sandbox Postgres for now. Moving production to its real home is one
`vercel env` change and a `pg_dump | psql`; nothing in the app knows where it is.

Secrets are set with `vercel env add <NAME> <environment>` and are never in the repository.
`vercel env pull` writes `.env.local` for development.

Auth needs no URL configuration: `src/lib/auth.ts` takes the host from the request and
allows `robocn.dev`, its subdomains and `*.vercel.app`, so a preview signs in at its own
URL. `STUDIO_ALLOWED_HOSTS` adds more, comma-separated.

## The first deploy, and every one after

Once the Git connection exists, there is no deploy command. `git push origin main` is the
release. `vercel deploy --prod` still works and is the escape hatch when the connection is
the thing that is broken.

A bad release is one click: **Instant Rollback** in the project's deployment list puts the
previous build back without rebuilding. It does not roll the database back, which is the
other reason migrations are additive.

## What this shares with robocn.dev

The marketing site, the registry and Studio are one Next app and one deployment, so a
Studio failure is a robocn.dev failure. That is the trade accepted for one build and one
domain. The way out, when Studio has people relying on it, is a second Vercel project on
this same repository with its own domain and its own environment — no code moves.
