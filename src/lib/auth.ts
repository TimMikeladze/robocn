/**
 * better-auth, server side.
 *
 * Two house rules shape the config. It must work on *any* origin in
 * development — the dev server takes whatever port is free — so the base URL is
 * resolved per request and every origin is trusted there. And it must never
 * need a mail provider to be usable: an invitation is a link the inviter
 * copies. `sendInvitation` is the one function to replace when there is one.
 */

import "server-only"

import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { organization } from "better-auth/plugins"

import { db, schema } from "@/db"
import { ac, studioRoles } from "@/lib/studio/access"
import { isValidSlug } from "@/lib/studio/ids"
import { defaultSettings } from "@/lib/studio/settings"

const dev = process.env.NODE_ENV !== "production"

/** Hosts a production deployment may be reached on, beyond its own URL. */
const productionHosts = [
  "robocn.dev",
  "*.robocn.dev",
  "*.vercel.app",
  ...(process.env.STUDIO_ALLOWED_HOSTS?.split(",").map((host) => host.trim()) ?? []),
].filter(Boolean)

export const invitationPath = (id: string) => `/studio/invite/${id}`

export const auth = betterAuth({
  appName: "robocn Studio",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: dev
    ? { allowedHosts: ["*", "*:*"], fallback: "http://localhost:3000", protocol: "auto" }
    : {
        allowedHosts: productionHosts,
        fallback: process.env.BETTER_AUTH_URL ?? "https://robocn.dev",
        protocol: "https",
      },
  trustedOrigins: dev
    ? (request) => [request?.headers.get("origin"), "http://localhost:*", "http://127.0.0.1:*"]
    : productionHosts.map((host) => `https://${host}`),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // No mailer, so nothing could ever be verified. Turn on with one.
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 },
  },
  user: { deleteUser: { enabled: true } },
  advanced: { cookiePrefix: "robocn" },
  plugins: [
    organization({
      ac,
      roles: studioRoles,
      creatorRole: "owner",
      invitationExpiresIn: 60 * 60 * 24 * 7,
      cancelPendingInvitationsOnReInvite: true,
      schema: {
        organization: {
          additionalFields: { settings: { type: "string", required: false, input: true } },
        },
      },
      /**
       * better-auth's own endpoints are a second way in, and they only check
       * that a slug is free. These keep the two rules Studio relies on true
       * whichever door a request came through: a slug is never a reserved word,
       * and `settings` is only ever written by `updateSettings`, which validates
       * it and checks that the logo and palette it names belong to the organization.
       */
      organizationHooks: {
        async beforeCreateOrganization({ organization }) {
          if (!organization.slug || !isValidSlug(organization.slug)) {
            throw new APIError("BAD_REQUEST", { message: "That URL is reserved or not valid." })
          }
          return { data: { ...organization, settings: JSON.stringify(defaultSettings()) } }
        },
        async beforeUpdateOrganization({ organization }) {
          if (organization.slug !== undefined && !isValidSlug(organization.slug)) {
            throw new APIError("BAD_REQUEST", { message: "That URL is reserved or not valid." })
          }
          const data = { ...organization }
          delete data.settings
          return { data }
        },
      },
      async sendInvitationEmail(data) {
        // The members page shows the same link with a copy button.
        if (dev) {
          console.info(
            `[studio] invitation for ${data.email} to ${data.organization.name}: ${invitationPath(data.id)}`,
          )
        }
      },
    }),
    // Last, as better-auth asks: it has to see the cookies the others set.
    nextCookies(),
  ],
})

export type Session = typeof auth.$Infer.Session
