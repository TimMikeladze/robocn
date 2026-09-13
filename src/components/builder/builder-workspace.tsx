"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { ArrowDownToLine, ArrowUp, Check, Code2, Copy, History, Library, Loader2, Maximize2, Pause, Play, RotateCcw, Search, Settings2, Sparkles, Square, Terminal, WandSparkles, X } from "lucide-react"
import { suggestions } from "@/lib/builder/suggestions"
import type { LibraryComponent } from "@/lib/builder/library"
import { previewDocument, type PreviewSettings } from "@/lib/builder/preview"
import type { AgentEvent } from "@/lib/builder/agent"
import styles from "./builder.module.css"

type Version = { code: string; name: string; explanation: string }
type Message = { role: "user" | "assistant"; text: string }
const storageKey = "robocn-builder-v1"

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement("a")
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function BuilderWorkspace({ serverAgent, tokenRequired, library, initialVersion, restoreDraft }: { serverAgent: boolean; tokenRequired: boolean; library: LibraryComponent[]; initialVersion: Version; restoreDraft: boolean }) {
  const [code, setCode] = React.useState(initialVersion.code)
  const [name, setName] = React.useState(initialVersion.name)
  const [versions, setVersions] = React.useState<Version[]>([initialVersion])
  const [messages, setMessages] = React.useState<Message[]>([{ role: "assistant", text: initialVersion.explanation }])
  const [prompt, setPrompt] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [status, setStatus] = React.useState("Preparing the workbench…")
  const [error, setError] = React.useState("")
  const [runtimeError, setRuntimeError] = React.useState("")
  const [html, setHtml] = React.useState("")
  const [previewRevision, setPreviewRevision] = React.useState(0)
  const [compiledCode, setCompiledCode] = React.useState("")
  const [compiling, setCompiling] = React.useState(false)
  const [dependencies, setDependencies] = React.useState<string[]>([])
  const [packages, setPackages] = React.useState<string[]>([])
  const [shadcnDependencies, setShadcnDependencies] = React.useState<string[]>([])
  const [tab, setTab] = React.useState<"preview" | "code">("preview")
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [libraryOpen, setLibraryOpen] = React.useState(false)
  const [libraryQuery, setLibraryQuery] = React.useState("")
  const [loadingLibrary, setLoadingLibrary] = React.useState(false)
  const [apiKey, setApiKey] = React.useState("")
  const [token, setToken] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)
  const [variant, setVariant] = React.useState("solid")
  const [view, setView] = React.useState("native")
  const [paused, setPaused] = React.useState(false)
  const [color, setColor] = React.useState("#f38b4a")
  const [accent, setAccent] = React.useState("#30bfa9")
  const { resolvedTheme } = useTheme()
  const frame = React.useRef<HTMLIFrameElement>(null)
  const stage = React.useRef<HTMLDivElement>(null)
  const chatEnd = React.useRef<HTMLDivElement>(null)
  const operation = React.useRef<AbortController | null>(null)
  const compileOperation = React.useRef<AbortController | null>(null)
  const previewSettings: PreviewSettings = { variant, view, paused, color, accent, size: 360, theme: resolvedTheme ?? "light" }
  const settingsRef = React.useRef(previewSettings)

  React.useEffect(() => { settingsRef.current = previewSettings; frame.current?.contentWindow?.postMessage({ type: "robocn-settings", settings: previewSettings }, "*") }, [variant, view, paused, color, accent, resolvedTheme]) // eslint-disable-line react-hooks/exhaustive-deps

  const compile = React.useCallback(async (source: string) => {
    compileOperation.current?.abort()
    const controller = new AbortController()
    compileOperation.current = controller
    setCompiling(true); setRuntimeError(""); setError(""); setStatus("Compiling your component…")
    try {
      const response = await fetch("/api/builder/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: source }), signal: controller.signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      if (controller.signal.aborted) return
      setDependencies(result.dependencies); setPackages(result.packages); setShadcnDependencies(result.shadcnDependencies); setCompiledCode(source)
      setHtml(previewDocument(result.javascript, window.location.origin)); setPreviewRevision(value => value + 1); setStatus("Loading preview…")
    } catch (e) {
      if (!controller.signal.aborted) { setRuntimeError(e instanceof Error ? e.message : "Preview failed."); setStatus("Needs a repair") }
    } finally { if (!controller.signal.aborted) setCompiling(false) }
  }, [])

  React.useEffect(() => {
    // Restore browser-only storage after hydration; the server cannot read it.
    restore()
    function restore() {
    let source = initialVersion.code
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null")
      if (saved && typeof saved.code === "string" && saved.code.length <= 60000 && typeof saved.name === "string") {
        if (restoreDraft) { source = saved.code; setCode(source); setName(saved.name) }
        if (Array.isArray(saved.versions)) {
          const history = saved.versions.filter((v: Version) => typeof v?.code === "string" && v.code.length <= 60000 && typeof v.name === "string" && typeof v.explanation === "string").slice(-10)
          setVersions(restoreDraft ? history : [...history, { code: saved.code, name: saved.name, explanation: "Saved before opening a library component." }, initialVersion])
        }
        if (restoreDraft && Array.isArray(saved.messages)) setMessages(saved.messages.filter((m: Message) => (m?.role === "user" || m?.role === "assistant") && typeof m.text === "string").slice(-30))
      }
    } catch { /* Storage is optional, including in private browsing. */ }
    // A docs deep-link chooses the initial machine once. Reload then resumes
    // the edited draft instead of silently loading the original source again.
    if (!restoreDraft) window.history.replaceState(null, "", "/builder")
    setHydrated(true)
    void compile(source)
    }
    return () => { operation.current?.abort(); compileOperation.current?.abort() }
  }, [compile, initialVersion, restoreDraft])

  React.useEffect(() => {
    if (!hydrated) return
    const timer = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify({ code, name, versions, messages })) }
      catch { setError("Browser storage is full or unavailable. Download your source to keep it.") }
    }, 500)
    return () => clearTimeout(timer)
  }, [code, name, versions, messages, hydrated])

  React.useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      if (event.data?.type === "robocn-loaded") frame.current?.contentWindow?.postMessage({ type: "robocn-settings", settings: settingsRef.current }, "*")
      if (event.data?.type === "robocn-ready") setStatus("Live preview")
      if (event.data?.type === "robocn-error" && typeof event.data.message === "string") { setRuntimeError(event.data.message.slice(0, 4000)); setStatus("Needs a repair") }
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [])
  React.useEffect(() => { chatEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }) }, [messages, busy])

  async function generate(requestPrompt = prompt) {
    if (!requestPrompt.trim() || busy || loadingLibrary) return
    if (!apiKey && (!serverAgent || (tokenRequired && !token))) { setSettingsOpen(true); setError("Connect the agent, then send your prompt."); return }
    compileOperation.current?.abort(); setCompiling(false)
    const controller = new AbortController(); operation.current = controller
    setBusy(true); setError(""); setPrompt("")
    setMessages(current => [...current.slice(-28), { role: "user", text: requestPrompt }])
    let receivedResult = false
    try {
      const response = await fetch("/api/builder/generate", {
        method: "POST", headers: { "Content-Type": "application/json", ...(apiKey ? { "x-openai-key": apiKey } : {}), ...(token ? { "x-builder-token": token } : {}) },
        body: JSON.stringify({ prompt: requestPrompt, code, error: runtimeError }), signal: controller.signal,
      })
      if (!response.ok) { const result = await response.json(); throw new Error(result.error) }
      const reader = response.body?.getReader()
      if (!reader) throw new Error("The agent connection closed. Please retry.")
      const decoder = new TextDecoder()
      let buffer = ""
      function consume(line: string) {
        if (!line.trim()) return
        const event = JSON.parse(line) as AgentEvent
        if (event.type === "status") setStatus(event.message)
        if (event.type === "error") throw new Error(event.message)
        if (event.type === "result") {
          receivedResult = true
          const version = { code: event.code, name: event.name, explanation: event.explanation }
          setCode(event.code); setName(event.name); setCompiledCode(event.code); setDependencies(event.dependencies); setPackages(event.packages); setShadcnDependencies(event.shadcnDependencies)
          setVersions(current => [...current.slice(-11), version])
          setMessages(current => [...current, { role: "assistant", text: event.explanation }])
          setRuntimeError(""); setTab("preview"); setHtml(previewDocument(event.javascript, window.location.origin)); setPreviewRevision(value => value + 1); setStatus("Loading preview…")
        }
      }
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n"); buffer = lines.pop() ?? ""
        lines.forEach(consume)
      }
      consume(buffer + decoder.decode())
      if (!receivedResult) throw new Error("The connection ended before a component arrived. Please retry.")
    } catch (e) {
      if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "Generation failed."); setPrompt(requestPrompt); setStatus("Ready to retry") }
    } finally { if (operation.current === controller) setBusy(false) }
  }

  async function loadComponent(id: string) {
    if (busy || loadingLibrary) return
    setLoadingLibrary(true); setError("")
    try {
      const response = await fetch(`/api/builder/library?component=${encodeURIComponent(id)}`)
      const loaded = await response.json() as Version & { error?: string }
      if (!response.ok) throw new Error(loaded.error)
      // Keep the previous draft, including manual edits, before switching machines.
      setVersions(current => [...current.filter(v => v.code !== code).slice(-10), { code, name, explanation: "Saved before loading another component." }, loaded])
      setCode(loaded.code); setName(loaded.name); setMessages([{ role: "assistant", text: loaded.explanation }]); setPrompt("")
      setLibraryOpen(false); setTab("preview")
      await compile(loaded.code)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load the library component.") }
    finally { setLoadingLibrary(false) }
  }

  function exportRegistry() {
    download(JSON.stringify({
      $schema: "https://ui.shadcn.com/schema/registry-item.json", name, type: "registry:ui", title: name,
      description: "A robot component created in the robocn builder.",
      dependencies: packages,
      registryDependencies: [...[...new Set(dependencies)].map(item => `${window.location.origin}/r/${item}.json`), ...shadcnDependencies],
      files: [{ path: `components/ui/${name}.tsx`, type: "registry:ui", content: code }],
    }, null, 2), `${name}.json`, "application/json")
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.heading}>
        <div><div className={styles.eyebrow}><span /> ROBOCN LAB / 001</div><h1>Build a robot of your own.</h1><p>An idea, a conversation, a machine. Design with an agent and watch your React come to life.</p></div>
        <button className={styles.secondary} onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen}><Settings2 size={15} /> {apiKey || (serverAgent && (!tokenRequired || token)) ? "Agent settings" : "Connect agent"}</button>
      </header>

      <div className={styles.libraryBar}><div><Library size={17} /><span><strong>Start with the real thing.</strong> Load any of our {library.length} components, then make it your own.</span></div><button className={styles.primary} disabled={busy || loadingLibrary} onClick={() => setLibraryOpen(!libraryOpen)} aria-expanded={libraryOpen}><Library size={14} />Load from library</button></div>
      {libraryOpen && <section className={styles.libraryPanel} aria-label="Component library">
        <div className={styles.librarySearch}><Search size={16} /><input autoFocus aria-label="Search component library" placeholder="Search robots, arms, machines…" value={libraryQuery} onChange={e => setLibraryQuery(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setLibraryOpen(false) }} /><button aria-label="Close component library" onClick={() => setLibraryOpen(false)}><X size={16} /></button></div>
        <div className={styles.libraryGrid}>{library.filter(item => `${item.title} ${item.id} ${item.description}`.toLowerCase().includes(libraryQuery.toLowerCase())).map(item => <button key={item.id} disabled={loadingLibrary} onClick={() => void loadComponent(item.id)}><span><Code2 size={15} /><strong>{item.title}</strong><ArrowUp size={14} /></span><p>{item.description}</p><small>{item.id}.tsx</small></button>)}</div>
        {!library.some(item => `${item.title} ${item.id} ${item.description}`.toLowerCase().includes(libraryQuery.toLowerCase())) && <p className={styles.emptyLibrary}>No components match “{libraryQuery}”. Try another name.</p>}
        {loadingLibrary && <p className={styles.thinking}><Loader2 size={14} className={styles.spin} />Loading actual component source…</p>}
      </section>}

      {settingsOpen && <section className={styles.connection} aria-label="Agent connection">
        <div><strong>Connect your agent</strong><p>{serverAgent ? "Use the configured server agent, or bring your own OpenAI key." : "Add an OpenAI API key to generate and revise components."} Keys stay in this tab’s memory and are sent only to this server and OpenAI.</p></div>
        {tokenRequired && <label>Builder access token<input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label>}
        <label>OpenAI API key<input type="password" autoComplete="off" placeholder="sk-…" value={apiKey} onChange={e => setApiKey(e.target.value)} /></label>
        <button className={styles.secondary} onClick={() => { setSettingsOpen(false); setError("") }}>Done <Check size={14} /></button>
      </section>}

      <div className={styles.workbench}>
        <aside className={styles.conversation}>
          <div className={styles.panelHeader}><span><Sparkles size={15} /> Design partner</span><span className={styles.mono}>REACT + ROBOCN</span></div>
          <div className={styles.chat} aria-label="Design conversation" role="log">
            {messages.map((message, i) => <div key={i} className={message.role === "user" ? styles.userMessage : styles.agentMessage}>
              <div className={styles.messageLabel}>{message.role === "user" ? "YOU" : <><Sparkles size={12} /> ROBOCN</>}</div><p>{message.text}</p>
            </div>)}
            {messages.length === 1 && <div className={styles.suggestions}><span className={styles.mono}>A FEW STARTING POINTS</span>{suggestions.map(s => <button key={s.title} onClick={() => setPrompt(s.prompt)}>{s.title}<ArrowUp size={14} /></button>)}</div>}
            {busy && <p className={styles.thinking}><Loader2 className={styles.spin} size={14} />{status}</p>}
            <div ref={chatEnd} />
          </div>
          <div className={styles.composer}>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <form onSubmit={e => { e.preventDefault(); void generate() }}>
              <textarea aria-label="Describe your robot" placeholder="Give this robot a telescoping neck…" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={8000} disabled={busy || loadingLibrary} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void generate() } }} />
              <div className={styles.composerFooter}><span>Describe it. Refine it. Make it yours.</span>{busy ? <button type="button" className={styles.send} aria-label="Stop generation" onClick={() => { operation.current?.abort(); setBusy(false); setStatus("Generation stopped") }}><Square size={14} /></button> : <button className={styles.send} disabled={!prompt.trim()} aria-label="Build robot"><ArrowUp size={18} /></button>}</div>
            </form>
            <p className={styles.note}>Your draft is saved in this browser. ⌘ / Ctrl + Enter to build.</p>
          </div>
        </aside>

        <section className={styles.editor} aria-label="Robot workspace">
          <div className={styles.panelHeader}>
            <div className={styles.tabs} role="tablist" aria-label="Workspace view"><button role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}><WandSparkles size={14} />Preview</button><button role="tab" aria-selected={tab === "code"} onClick={() => setTab("code")}><Code2 size={14} />Code</button></div>
            <div className={styles.tools}><button title="Version history" aria-label="Version history" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}><History size={16} /></button><button title="Download React source" aria-label="Download React source" onClick={() => download(code, `${name}.tsx`, "text/plain")}><ArrowDownToLine size={16} /></button></div>
          </div>
          {historyOpen && <div className={styles.history}><div className={styles.historyHeading}><strong>Versions</strong><button aria-label="Close version history" onClick={() => setHistoryOpen(false)}><X size={15} /></button></div>{versions.map((version, i) => <button disabled={busy} key={i} onClick={() => { setCode(version.code); setName(version.name); setHistoryOpen(false); void compile(version.code) }}><span className={styles.mono}>{String(i + 1).padStart(2, "0")}</span><span>{version.name}<small>{version.explanation}</small></span><RotateCcw size={14} /></button>)}</div>}
          <div className={styles.stage} ref={stage} style={{ display: tab === "preview" ? undefined : "none" }}>
            <div className={styles.stageLabel}><span className={styles.cross}>+</span><span>{name.replaceAll("-", " ")}<small>PROCEDURAL REACT COMPONENT</small></span></div>
            {html ? <iframe key={previewRevision} ref={frame} title="Robot live preview" srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={() => frame.current?.contentWindow?.postMessage({ type: "robocn-settings", settings: settingsRef.current }, "*")} /> : <div className={styles.loading}><Loader2 className={styles.spin} size={22} />Assembling the workbench</div>}
            <div className={styles.stageBottom}><span className={styles.mono}>LIVE / {variant.toUpperCase()}</span><div className={styles.tools}><button aria-label={paused ? "Play motion" : "Pause motion"} title={paused ? "Play motion" : "Pause motion"} onClick={() => setPaused(!paused)}>{paused ? <Play size={15} /> : <Pause size={15} />}</button><button aria-label="Restart preview" title="Restart preview" disabled={busy || compiling} onClick={() => void compile(code)}><RotateCcw size={15} /></button><button aria-label="Fullscreen preview" title="Fullscreen preview" onClick={() => void stage.current?.requestFullscreen().catch(() => setError("Fullscreen is unavailable in this browser."))}><Maximize2 size={15} /></button></div></div>
          </div>
          {tab === "code" && <div className={styles.codePanel}><div className={styles.codeHeader}><span><Code2 size={13} />{name}.tsx</span><button onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { setError("Clipboard is unavailable. Download the source instead.") } }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button></div><textarea spellCheck={false} aria-label="React component source" value={code} disabled={busy} maxLength={60000} onChange={e => setCode(e.target.value)} /><div className={styles.codeFooter}><span>{code !== compiledCode ? "Uncompiled edits" : "Preview matches this source"}</span><button className={styles.primary} disabled={busy || compiling} onClick={() => { void compile(code); setTab("preview") }}><Play size={13} />Run preview</button></div></div>}
          {runtimeError && <div className={styles.previewError} role="alert"><Terminal size={16} /><div><strong>Let’s fix this version</strong><pre>{runtimeError}</pre><button className={styles.secondary} disabled={busy} onClick={() => void generate("Fix the preview error while preserving this robot's design and features.")}>Repair with agent <WandSparkles size={13} /></button></div></div>}
          <div className={styles.controls}>
            <label>DRAWING<select aria-label="Drawing variant" value={variant} onChange={e => setVariant(e.target.value)}>{["solid", "outline", "blueprint", "wire"].map(v => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
            <label>VIEW<select aria-label="Camera view" value={view} onChange={e => setView(e.target.value)}>{["native", "front", "profile", "plan", "iso"].map(v => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
            <label>SHELL<input aria-label="Shell color" type="color" value={color} onChange={e => setColor(e.target.value)} /></label><label>ACCENT<input aria-label="Accent color" type="color" value={accent} onChange={e => setAccent(e.target.value)} /></label>
            <button className={styles.secondary} disabled={code !== compiledCode || !!runtimeError || compiling || busy} onClick={exportRegistry}>Export registry <ArrowDownToLine size={14} /></button>
          </div>
          <div className={styles.statusBar} aria-live="polite"><span><i className={runtimeError ? styles.badDot : styles.goodDot} />{code !== compiledCode && !busy && !compiling ? "Edits ready to preview" : status}</span><span>Views follow the component’s supported props</span></div>
        </section>
      </div>
      <footer className={styles.footnote}><span>Built from the same source as the robocn registry.</span><span>React · TypeScript · SVG · Your imagination</span></footer>
    </div>
  )
}
