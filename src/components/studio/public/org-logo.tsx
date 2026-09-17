"use client"

/**
 * An organization's logo on its public page. The file route only answers for
 * an asset its owner made public, so a private or deleted logo is a failed
 * image — and a failed image is simply not there.
 */

import * as React from "react"

function OrgLogo({ assetId, name }: { assetId: string; name: string }) {
  const [failed, setFailed] = React.useState(false)
  if (failed) return null
  return (
    // Already a thumbnail from the asset route: nothing for the optimizer to add.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/studio/assets/${encodeURIComponent(assetId)}/file?thumb=1`}
      alt={`${name} logo`}
      // An image that failed before hydration never fires `onError`; ask it directly.
      ref={(node) => {
        if (node?.complete && node.naturalWidth === 0) setFailed(true)
      }}
      onError={() => setFailed(true)}
      className="size-14 shrink-0 border border-border bg-panel object-contain p-1.5"
    />
  )
}

export { OrgLogo }
