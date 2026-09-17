"use client"

/** Review: threads pinned to the version that was on the stage, one reply deep, resolvable. */

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, CornerDownRight, RotateCcw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, TimeAgo, fieldClass, useAction } from "@/components/studio/kit"
import { addComment, deleteComment, setCommentResolved } from "@/lib/studio/actions/designs"
import { can } from "@/lib/studio/permissions"
import { cn } from "@/lib/utils"

export interface CommentRow {
  id: string
  parentId: string | null
  body: string
  resolvedAt: Date | string | null
  createdAt: Date | string
  authorId: string | null
  authorName: string | null
  versionNumber: number | null
}

function Composer({
  placeholder,
  onSubmit,
  pending,
  compact,
}: {
  placeholder: string
  onSubmit: (body: string) => Promise<boolean>
  pending: boolean
  compact?: boolean
}) {
  const [body, setBody] = React.useState("")
  const submit = async () => {
    if (!body.trim()) return
    if (await onSubmit(body)) setBody("")
  }
  return (
    <form
      className="space-y-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <textarea
        value={body}
        rows={compact ? 2 : 3}
        maxLength={4000}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void submit()
        }}
        className={cn(fieldClass, "h-auto resize-none py-1.5")}
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">⌘↵ to send</span>
        <Button type="submit" size="xs" disabled={pending || !body.trim()}>
          {compact ? "Reply" : "Comment"}
        </Button>
      </div>
    </form>
  )
}

function CommentsPanel({
  orgSlug,
  role,
  userId,
  designId,
  versionId,
  comments,
}: {
  orgSlug: string
  role: string
  userId: string
  designId: string
  versionId: string | null
  comments: CommentRow[]
}) {
  const router = useRouter()
  const { pending, call } = useAction()
  const [showResolved, setShowResolved] = React.useState(false)
  const [replyTo, setReplyTo] = React.useState<string | null>(null)
  const canComment = can(role, "comment:create")

  const threads = comments.filter((row) => !row.parentId)
  const open = threads.filter((row) => !row.resolvedAt)
  const resolved = threads.filter((row) => row.resolvedAt)
  const shown = showResolved ? threads : open
  const repliesTo = (id: string) => comments.filter((row) => row.parentId === id)

  const post = async (body: string, parentId: string | null) => {
    const ok = await call(() => addComment(orgSlug, designId, { body, parentId, versionId }))
    if (ok) router.refresh()
    return !!ok
  }

  const Entry = ({ row, reply }: { row: CommentRow; reply?: boolean }) => (
    <div className={cn("flex gap-2", reply && "pl-4")}>
      {reply ? <CornerDownRight className="mt-1 size-3 shrink-0 text-muted-foreground" /> : null}
      <Avatar name={row.authorName ?? "?"} className="mt-0.5 size-5 text-[8px]" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{row.authorName ?? "Someone"}</span> ·{" "}
          <TimeAgo date={row.createdAt} />
          {!reply && row.versionNumber ? ` · on v${row.versionNumber}` : ""}
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px]">{row.body}</p>
      </div>
      {row.authorId === userId || can(role, "settings:update") ? (
        <button
          type="button"
          aria-label="Delete comment"
          onClick={async () => {
            const ok = await call(() => deleteComment(orgSlug, row.id))
            if (ok !== null) router.refresh()
          }}
          className="h-fit rounded-sm p-1 text-muted-foreground opacity-60 transition hover:bg-accent hover:text-destructive hover:opacity-100"
        >
          <Trash2 className="size-3" />
        </button>
      ) : null}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">
        <span>
          {open.length} open{resolved.length ? ` · ${resolved.length} resolved` : ""}
        </span>
        {resolved.length ? (
          <button type="button" onClick={() => setShowResolved((value) => !value)} className="hover:text-foreground">
            {showResolved ? "Hide resolved" : "Show resolved"}
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-0 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
            {threads.length ? "Every thread is resolved." : "No review comments yet."}
          </p>
        ) : null}
        {shown.map((thread) => (
          <div
            key={thread.id}
            className={cn("space-y-2.5 border-b border-border/60 px-3 py-3", thread.resolvedAt && "opacity-60")}
          >
            <Entry row={thread} />
            {repliesTo(thread.id).map((row) => (
              <Entry key={row.id} row={row} reply />
            ))}
            {canComment ? (
              <div className="flex items-center gap-1.5 pl-7">
                {!thread.resolvedAt ? (
                  <Button variant="ghost" size="xs" onClick={() => setReplyTo(replyTo === thread.id ? null : thread.id)}>
                    Reply
                  </Button>
                ) : null}
                {thread.authorId === userId || can(role, "comment:resolve") ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={pending}
                    onClick={async () => {
                      const ok = await call(() => setCommentResolved(orgSlug, thread.id, !thread.resolvedAt))
                      if (ok !== null) router.refresh()
                    }}
                  >
                    {thread.resolvedAt ? <RotateCcw /> : <Check />}
                    {thread.resolvedAt ? "Reopen" : "Resolve"}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {replyTo === thread.id ? (
              <div className="pl-7">
                <Composer
                  compact
                  pending={pending}
                  placeholder="Reply"
                  onSubmit={async (body) => {
                    const ok = await post(body, thread.id)
                    if (ok) setReplyTo(null)
                    return ok
                  }}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {canComment ? (
        <div className="shrink-0 border-t border-border p-3">
          <Composer pending={pending} placeholder="Leave a review comment" onSubmit={(body) => post(body, null)} />
        </div>
      ) : null}
    </div>
  )
}

export { CommentsPanel }
