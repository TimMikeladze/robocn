"use client"

/**
 * use-near-viewport — "is this element worth mounting yet?", behind a single
 * shared `IntersectionObserver`.
 *
 * The landing grid is one card per registry item and every card is a machine
 * running its own animation frame loop, so mounting all of them is a hundred-odd
 * loops and a hundred-odd re-renders a frame for a section that shows six cards
 * at a time. Giving each card its own observer would trade one of those costs
 * for another; every caller asking for the same `rootMargin` shares one instead.
 *
 * Site-only, deliberately: it is not a registry item, so it lives beside the
 * components that use it rather than in `src/hooks`.
 *
 * Design notes: `docs/catalogue-virtualization.md`.
 */

import * as React from "react"

type Listener = (near: boolean) => void

/**
 * Keyed on the constructor as well as the margin, so a test that stubs the
 * global gets its own observer rather than one left over from another test.
 */
const observers = new WeakMap<object, Map<string, IntersectionObserver>>()
const listeners = new WeakMap<Element, Listener>()

function observerFor(rootMargin: string) {
  const constructor = IntersectionObserver as unknown as object
  let byMargin = observers.get(constructor)
  if (!byMargin) {
    byMargin = new Map()
    observers.set(constructor, byMargin)
  }
  let observer = byMargin.get(rootMargin)
  if (!observer) {
    observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          listeners.get(record.target)?.(record.isIntersecting)
        }
      },
      { rootMargin },
    )
    byMargin.set(rootMargin, observer)
  }
  return observer
}

/** Whether there is an observer to ask. Settled before React runs, so nothing subscribes. */
const noSubscription = () => () => {}
const hasObserver = () => typeof IntersectionObserver !== "undefined"
/**
 * The server renders as if the client had one: the placeholder is what gets
 * sent either way, so hydration has nothing to reconcile and the document does
 * not carry every machine's SVG inlined.
 */
const assumeObserver = () => true

export interface NearViewportOptions {
  /** How far outside the viewport still counts as near. */
  rootMargin?: string
  /** Stay near once it has been near, instead of unmounting on the way out. */
  once?: boolean
  /**
   * What "near" means where there is no `IntersectionObserver` — jsdom, and
   * anything else that cannot report. `true` renders the content; `false` holds
   * the placeholder.
   */
  fallback?: boolean
}

/** A ref to hang on the placeholder, and whether its content should be mounted. */
export function useNearViewport<T extends Element>({
  rootMargin = "600px",
  once = false,
  fallback = true,
}: NearViewportOptions = {}): [React.RefObject<T | null>, boolean] {
  const ref = React.useRef<T>(null)
  const [near, setNear] = React.useState(false)
  const supported = React.useSyncExternalStore(
    noSubscription,
    hasObserver,
    assumeObserver,
  )

  React.useEffect(() => {
    const node = ref.current
    if (!node || !supported) return
    const observer = observerFor(rootMargin)
    const stop = () => {
      listeners.delete(node)
      observer.unobserve(node)
    }
    listeners.set(node, (visible) => {
      if (!visible && once) return
      setNear(visible)
      if (visible && once) stop()
    })
    observer.observe(node)
    return stop
  }, [rootMargin, once, supported])

  return [ref, supported ? near : fallback]
}
