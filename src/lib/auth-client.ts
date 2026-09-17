"use client"

/**
 * better-auth, browser side. No `baseURL`: it uses the page's own origin, which
 * is the only thing that is right on every port and every preview deployment.
 */

import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { ac, studioRoles } from "@/lib/studio/access"

export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles: studioRoles })],
})
