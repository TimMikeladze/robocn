"use client"

/**
 * better-auth's client answers `{ data, error }` rather than throwing, and its
 * errors are the only place a rule like "an organization keeps one owner" is
 * said out loud. This is `useAction` for that shape: toast the reason, return
 * the data or `null`.
 */

import * as React from "react"
import { toast } from "sonner"

interface AuthResult<T> {
  data: T | null
  error: { message?: string; statusText?: string } | null
}

export function useAuthCall() {
  const [pending, setPending] = React.useState(false)
  const call = React.useCallback(
    async <T,>(
      work: () => Promise<AuthResult<T>>,
      options: { success?: string; failure?: string } = {},
    ): Promise<T | null> => {
      setPending(true)
      try {
        const result = await work()
        if (result.error) {
          toast.error(
            result.error.message || options.failure || result.error.statusText || "That did not work. Try again.",
          )
          return null
        }
        if (options.success) toast.success(options.success)
        // Some endpoints succeed with an empty body; `null` must still mean failure.
        return result.data ?? ({} as T)
      } catch {
        toast.error(options.failure ?? "Something went wrong. Try again.")
        return null
      } finally {
        setPending(false)
      }
    },
    [],
  )
  return { pending, call }
}
