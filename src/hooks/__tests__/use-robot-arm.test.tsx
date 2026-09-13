import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConveyorBelt } from '@/components/ui/conveyor-belt'
import { useEasedPoint, useRobotArm, type RobotTarget } from '@/hooks/use-robot-arm'

let now = 0
let sequence = 0
let reduced = false
let frames: Map<number, FrameRequestCallback>
let listeners: Set<() => void>

beforeEach(() => {
  now = 0
  sequence = 0
  reduced = false
  frames = new Map()
  listeners = new Set()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback)
    return sequence
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reduced },
    addEventListener: (_event: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_event: string, callback: () => void) => listeners.delete(callback),
  }))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function tick(milliseconds = 50) {
  act(() => {
    now += milliseconds
    const pending = [...frames.entries()]
    for (const [id, callback] of pending) {
      frames.delete(id)
      callback(now)
    }
  })
}

function setReduced(value: boolean) {
  act(() => { reduced = value; listeners.forEach(listener => listener()) })
}

describe('useEasedPoint', () => {
  it('moves independent axes at their own feed rate', () => {
    const { result, rerender } = renderHook(({ target }: { target: RobotTarget }) => useEasedPoint(target, { x: 0, y: 0 }, { speed: 100, perAxis: true }), { initialProps: { target: null as RobotTarget } })
    rerender({ target: { x: 100, y: 10 } })
    tick()
    expect(result.current.point).toEqual({ x: 5, y: 5 })
    tick()
    expect(result.current.point).toEqual({ x: 10, y: 10 })
  })

  it('parks a scripted target at its phase when animation is disabled', () => {
    const { result } = renderHook(() => useEasedPoint(t => ({ x: t * 10, y: 0 }), { x: 0, y: 0 }, { animate: false, phase: 2 }))
    tick()
    expect(result.current.point).toEqual({ x: 20, y: 0 })
    expect(result.current.clock).toBe(2)
    expect(result.current.moving).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('updates the clock for stationary path samples used by other dimensions', () => {
    const { result } = renderHook(() => useEasedPoint(() => ({ x: 0, y: 0 }), { x: 0, y: 0 }))
    tick()
    expect(result.current.clock).toBeCloseTo(0.05)
  })

  it('clears moving on arrival and stops scheduling frames', () => {
    const { result, rerender } = renderHook(({ target }: { target: RobotTarget }) => useEasedPoint(target, { x: 0, y: 0 }, { speed: 10 }), { initialProps: { target: null as RobotTarget } })
    rerender({ target: { x: 1, y: 0 } })
    tick()
    expect(result.current.moving).toBe(true)
    tick()
    expect(result.current.point).toEqual({ x: 1, y: 0 })
    expect(result.current.moving).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('reacts to reduced-motion changes and cleans up its listener', () => {
    const { unmount } = renderHook(() => useEasedPoint(t => ({ x: t, y: 0 }), { x: 0, y: 0 }))
    tick()
    setReduced(true)
    tick()
    expect(frames.size).toBe(0)
    setReduced(false)
    tick()
    expect(frames.size).toBe(1)
    unmount()
    expect(frames.size).toBe(0)
    expect(listeners.size).toBe(0)
  })
})

describe('useRobotArm', () => {
  it('does not leave a scripted target chasing forever with animate=false', () => {
    const { result } = renderHook(() => useRobotArm({ links: [10, 10], target: t => ({ x: 8 + t, y: 8 }), animate: false }))
    tick()
    expect(frames.size).toBe(0)
    expect(result.current.moving).toBe(false)
  })

  it('parks a pointer behavior with no target instead of polling forever', () => {
    renderHook(() => useRobotArm({ links: [10, 10], behavior: 'pointer' }))
    tick()
    expect(frames.size).toBe(0)
  })
})

describe('motion boundaries', () => {
  it.each([0, -1, NaN, Infinity])('parks rather than spinning a frame loop at speed %s', speed => {
    const point = renderHook(() => useEasedPoint(t => ({ x: t, y: 0 }), { x: 0, y: 0 }, { speed }))
    const arm = renderHook(() => useRobotArm({ links: [10, 10], behavior: 'orbit', speed }))
    tick()
    expect(frames.size).toBe(0)
    expect(point.result.current.moving).toBe(false)
    expect(arm.result.current.moving).toBe(false)
  })

  it('keeps vector feed as the default when perAxis is omitted', () => {
    const { result, rerender } = renderHook(({ target }: { target: RobotTarget }) => useEasedPoint(target, { x: 0, y: 0 }, { speed: 100 }), { initialProps: { target: null as RobotTarget } })
    rerender({ target: { x: 30, y: 40 } })
    tick()
    expect(result.current.point).toEqual({ x: 3, y: 4 })
  })

  it('freezes pose and cancels outstanding frames when paused', () => {
    const { result, rerender } = renderHook(({ paused }) => useEasedPoint(t => ({ x: t * 50, y: 0 }), { x: 0, y: 0 }, { paused }), { initialProps: { paused: false } })
    tick()
    const point = result.current.point
    rerender({ paused: true })
    tick()
    expect(result.current.point).toEqual(point)
    expect(result.current.moving).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('responds to reduced motion for articulated arms too', () => {
    const { result, unmount } = renderHook(() => useRobotArm({ links: [10, 10], behavior: 'orbit' }))
    tick()
    expect(frames.size).toBe(1)
    setReduced(true)
    tick()
    expect(frames.size).toBe(0)
    expect(result.current.moving).toBe(false)
    unmount()
    expect(listeners.size).toBe(0)
  })
})


describe('stationary updates and conveyor preferences', () => {
  it.each([false, true])('resamples a changed scripted target while reduced motion is %s', preference => {
    reduced = preference
    const { result, rerender } = renderHook(({ height }) => useEasedPoint(t => ({ x: t, y: height }), { x: 0, y: 0 }, { animate: preference, phase: 2 }), { initialProps: { height: 3 } })
    tick()
    rerender({ height: 8 })
    tick()
    expect(result.current.point).toEqual({ x: 2, y: 8 })
    expect(frames.size).toBe(0)
  })

  it('resamples a stationary articulated path when its captured target changes', () => {
    const { result, rerender } = renderHook(({ height }) => useRobotArm({ links: [10, 10], target: () => ({ x: 8, y: height }), animate: false }), { initialProps: { height: 3 } })
    tick()
    rerender({ height: 8 })
    tick()
    expect(result.current.tip.y).toBeCloseTo(8)
    expect(frames.size).toBe(0)
  })

  it('stops and resumes the conveyor when reduced motion changes', () => {
    const { container, unmount } = render(<ConveyorBelt />)
    tick()
    setReduced(true)
    const stopped = container.innerHTML
    tick()
    expect(container.innerHTML).toBe(stopped)
    expect(frames.size).toBe(0)
    setReduced(false)
    tick()
    expect(container.innerHTML).not.toBe(stopped)
    expect(frames.size).toBe(1)
    unmount()
    expect(frames.size).toBe(0)
    expect(listeners.size).toBe(0)
  })
})
