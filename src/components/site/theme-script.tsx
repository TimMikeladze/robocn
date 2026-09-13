import { themeBootScript } from "@/lib/site-theme"

/**
 * The saved theme, applied before the body is parsed. Rendered first in
 * `<body>` and run synchronously, so nothing paints in the default palette
 * before the visitor's own one lands.
 */
function ThemeScript() {
  return (
    <script
      // Our own string, built from our own functions — no user input reaches it.
      dangerouslySetInnerHTML={{ __html: themeBootScript() }}
    />
  )
}

export { ThemeScript }
