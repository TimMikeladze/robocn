import type { PropRow } from "@/lib/docs"

function PropsTable({ rows, caption }: { rows: PropRow[]; caption?: string }) {
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full border-collapse text-left text-[13px]">
        {caption ? (
          <caption className="border-b border-border px-3 py-1.5 text-left font-mono text-[11px] text-muted-foreground">
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr className="border-b border-border text-[11px] text-muted-foreground">
            <th className="px-3 py-2 font-medium">Prop</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Default</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-border/70 last:border-0 align-top">
              <td className="px-3 py-2.5 font-mono text-[12px] whitespace-nowrap">
                {row.name}
              </td>
              <td className="max-w-56 px-3 py-2.5 font-mono text-[11.5px] break-words text-muted-foreground">
                {row.type}
              </td>
              <td className="px-3 py-2.5 font-mono text-[11.5px] whitespace-nowrap text-muted-foreground">
                {row.default ?? "—"}
              </td>
              <td className="px-3 py-2.5">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { PropsTable }
