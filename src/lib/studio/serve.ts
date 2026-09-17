import "server-only"

import { mustDownload } from "@/lib/studio/asset-kinds"
import { StudioError } from "@/lib/studio/session"

/**
 * An uploaded file is somebody else's document served from our origin. So:
 * no sniffing, a CSP that sandboxes it and forbids every subresource (an SVG
 * with a `<script>` renders as a picture and runs nothing), and anything a
 * browser would execute goes out as a download.
 */
export function fileResponse(
  file: { bytes: Uint8Array; mime: string; name: string },
  options: { download?: boolean; cache: "private" | "public" | "immutable" },
) {
  const attachment = options.download || mustDownload(file.mime)
  const fallback = file.name.replace(/[^\x20-\x7e]|["\\]/g, "_")
  return new Response(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": attachment && mustDownload(file.mime) ? "application/octet-stream" : file.mime,
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `${attachment ? "attachment" : "inline"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cross-Origin-Resource-Policy": "same-site",
      "Cache-Control": {
        private: "private, max-age=300",
        public: "public, max-age=300",
        immutable: "public, max-age=31536000, immutable",
      }[options.cache],
    },
  })
}

export function errorResponse(error: unknown) {
  if (error instanceof StudioError) {
    return Response.json({ error: error.message }, { status: error.status })
  }
  console.error("[studio]", error)
  return Response.json({ error: "Something went wrong." }, { status: 500 })
}
