import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BuskerDroid, buskerGoal } from "@/components/ui/busker-droid"
import { GramophoneHorn, gramophoneGoal } from "@/components/ui/gramophone-horn"
import { MusicBoxDrum, musicBoxGoal } from "@/components/ui/music-box-drum"
import { RobotGrandPiano, grandPianoGoal } from "@/components/ui/robot-grand-piano"
import { TurntableDeck, deckGoal, deckRadius } from "@/components/ui/turntable-deck"

const attribute = (container: HTMLElement, selector: string, name: string) =>
  container.querySelector(selector)!.getAttribute(name)

describe("turntable deck", () => {
  it("walks the arm inward as the side plays, and keeps the arm's own length", () => {
    const { container, rerender } = render(<TurntableDeck progress={0} behavior="static" />)
    const leadIn = Number(attribute(container, "[data-tonearm]", "data-angle"))

    rerender(<TurntableDeck progress={1} behavior="static" />)
    const runOut = Number(attribute(container, "[data-tonearm]", "data-angle"))

    // The arm swings in toward the spindle, which is a smaller pivot angle.
    expect(runOut).toBeLessThan(leadIn)
    expect(deckRadius(1)).toBeLessThan(deckRadius(0))
    expect(container.querySelector("[data-stylus]")).not.toBeNull()
  })

  it("gears the platter to the groove: progress and spin are one number", () => {
    const { container, rerender } = render(<TurntableDeck progress={0} behavior="static" />)
    expect(Number(attribute(container, "[data-platter]", "data-spin"))).toBe(0)

    // Half a side at 40 revolutions is 20 revolutions of the platter.
    rerender(<TurntableDeck progress={0.5} behavior="static" turnsPerSide={40} />)
    expect(Number(attribute(container, "[data-platter]", "data-spin"))).toBeCloseTo(20 * 360, 6)
  })

  it("picks the arm up and parks it on the rest", () => {
    const { container, rerender } = render(<TurntableDeck progress={0.4} cue="play" behavior="static" />)
    const playing = attribute(container, "[data-tonearm]", "data-angle")

    rerender(<TurntableDeck progress={0.4} cue="lift" behavior="static" />)
    // Cued up, the arm holds its place over the groove: only its height moves.
    expect(attribute(container, "[data-tonearm]", "data-angle")).toBe(playing)

    rerender(<TurntableDeck progress={0.4} cue="rest" behavior="static" />)
    expect(attribute(container, "[data-tonearm]", "data-angle")).not.toBe(playing)
  })

  it("names the speed, the position and the view, and reports the cue", () => {
    const { container, getByRole, rerender } = render(
      <TurntableDeck progress={0.42} rpm={45} view="iso" behavior="static" />,
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("45 rpm")
    expect(label).toContain("42 percent")
    expect(label).toContain("isometric view")
    expect(attribute(container, "[data-view]", "data-view")).toBe("iso")

    rerender(<TurntableDeck progress={0.42} cue="rest" behavior="static" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("on its rest")
  })

  it("projects a different drawing from a different camera", () => {
    const { container, rerender } = render(<TurntableDeck progress={0.3} view="plan" behavior="static" />)
    const plan = attribute(container, "[data-platter]", "transform")
    rerender(<TurntableDeck progress={0.3} view="profile" behavior="static" />)
    expect(attribute(container, "[data-platter]", "transform")).not.toBe(plan)
    expect(container.querySelector("[data-solids]")).not.toBeNull()
  })

  it("is a slider you can scrub when it is interactive", () => {
    const { getByRole } = render(<TurntableDeck interactive progress={0.25} behavior="static" />)
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("25")
    expect(slider.getAttribute("aria-valuemax")).toBe("100")
    expect(slider.getAttribute("tabindex")).toBe("0")
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <TurntableDeck
        progress={Number.NaN}
        turnsPerSide={Number.NaN}
        rpm={11 as unknown as 33}
        color="#aabbcc"
        behavior="static"
      />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
    // An unknown selector falls back rather than throwing.
    expect(container.textContent).toContain("33 RPM")
  })

  it("runs the platter from the clock, and parks when static", () => {
    expect(deckGoal("static", 3)).toBe(0)
    expect(deckGoal("play", Number.NaN)).toBe(0)
    expect(deckGoal("play", 2)).toBeCloseTo(2, 6)
    // Scratching rocks the platter both ways over a slow crawl forward.
    expect(deckGoal("scratch", 0.25)).toBeGreaterThan(deckGoal("scratch", 0))
    expect(deckGoal("scratch", 0.75)).toBeLessThan(deckGoal("scratch", 0))
    expect(deckGoal("scratch", 1) - deckGoal("scratch", 0)).toBeCloseTo(0.3, 6)
  })
})

describe("gramophone horn", () => {
  it("winds the crank with the spring: the handle is the wind", () => {
    const { container, rerender } = render(<GramophoneHorn wind={0} behavior="static" />)
    expect(Number(attribute(container, "[data-crank]", "data-angle"))).toBe(0)

    rerender(<GramophoneHorn wind={1} behavior="static" />)
    // Three turns of the handle for a full wind.
    expect(Number(attribute(container, "[data-crank]", "data-angle"))).toBeCloseTo(1080, 6)
  })

  it("holds the speed while the spring has torque and sags when it has not", () => {
    const { getByRole, rerender } = render(<GramophoneHorn wind={1} behavior="static" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("78 rpm")

    rerender(<GramophoneHorn wind={0.5} behavior="static" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("78 rpm")

    rerender(<GramophoneHorn wind={0.15} behavior="static" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("39 rpm")

    rerender(<GramophoneHorn wind={0} behavior="static" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("run down")
  })

  it("stands the flyweights out with the speed", () => {
    const { container, rerender } = render(<GramophoneHorn wind={1} behavior="static" />)
    const open = Number(attribute(container, "[data-governor]", "data-spread"))

    rerender(<GramophoneHorn wind={0.12} behavior="static" />)
    expect(Number(attribute(container, "[data-governor]", "data-spread"))).toBeLessThan(open)
    expect(container.querySelectorAll("[data-weight]")).toHaveLength(2)
  })

  it("swings the arm across the record and reports how badly it tracks", () => {
    const { container, getByRole, rerender } = render(
      <GramophoneHorn wind={1} progress={0} behavior="static" />,
    )
    const leadIn = attribute(container, "[data-tonearm]", "data-angle")
    // An acoustic arm has no alignment geometry, and the number says so.
    expect(Math.abs(Number(getByRole("img").getAttribute("aria-label")!.match(/error (-?\d+)/)![1]))).toBeGreaterThan(10)

    rerender(<GramophoneHorn wind={1} progress={1} behavior="static" />)
    expect(attribute(container, "[data-tonearm]", "data-angle")).not.toBe(leadIn)
  })

  it("builds the horn as one flare and projects it from every camera", () => {
    const { container, rerender } = render(<GramophoneHorn wind={1} view="profile" behavior="static" />)
    expect(Number(attribute(container, "[data-horn]", "data-sections"))).toBeGreaterThan(6)
    const profile = container.querySelector("[data-horn] path")!.getAttribute("d")

    rerender(<GramophoneHorn wind={1} view="front" behavior="static" />)
    expect(container.querySelector("[data-horn] path")!.getAttribute("d")).not.toBe(profile)
    expect(container.querySelector("[data-view]")!.getAttribute("data-view")).toBe("front")
  })

  it("is a slider you can wind by hand, and hides the mechanism on request", () => {
    const { container, getByRole } = render(
      <GramophoneHorn interactive wind={0.6} showMechanism={false} behavior="static" />,
    )
    expect(getByRole("slider").getAttribute("aria-valuenow")).toBe("60")
    expect(container.querySelector("[data-mechanism]")).toBeNull()
  })

  it("stays neutral on nonsense and takes a colour override", () => {
    const { container } = render(
      <GramophoneHorn wind={Number.NaN} progress={Number.NaN} color="#aabbcc" behavior="static" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
  })

  it("runs the spring down and winds it back within one cycle", () => {
    expect(gramophoneGoal("static", 0.4)).toBe(1)
    expect(gramophoneGoal("play", Number.NaN)).toBe(1)
    expect(gramophoneGoal("play", 0)).toBeCloseTo(1, 6)
    expect(gramophoneGoal("play", 0.75)).toBeCloseTo(0, 6)
    // Wound back up by the end of the cycle, so whole cycles repeat.
    expect(gramophoneGoal("play", 0.999)).toBeGreaterThan(0.99)
    expect(gramophoneGoal("play", 0.3)).toBeCloseTo(gramophoneGoal("play", 2.3), 6)
    expect(gramophoneGoal("crank", 0.5)).toBeCloseTo(1, 6)
    expect(gramophoneGoal("crank", 0)).toBeCloseTo(0, 6)
  })
})

describe("music box drum", () => {
  // One pin on tine 0 at step 4; tine 1 never moves.
  const pattern = ["....x...", "........", "..x.....", "......x."]

  it("bends a tine as its pin comes round and lets go at the pin", () => {
    const lift = (turn: number) => {
      const { container } = render(
        <MusicBoxDrum turn={turn} tines={4} pattern={pattern} behavior="static" />,
      )
      return Number(attribute(container, '[data-tine="0"]', "data-lift"))
    }
    // Eight steps to a turn, so the pin at step 4 arrives at 180 degrees.
    expect(lift(180)).toBeCloseTo(1, 2)
    // The pin engages the tine over the last two thirds of a step, and no sooner.
    expect(lift(140)).toBe(0)
    expect(lift(165)).toBeGreaterThan(0)
    // And is gone the instant the pin passes the tip: that is the pluck.
    expect(lift(182)).toBe(0)
    // A tine with no pins never moves, however far the barrel turns.
    const { container } = render(
      <MusicBoxDrum turn={180} tines={4} pattern={pattern} behavior="static" />,
    )
    expect(Number(attribute(container, '[data-tine="1"]', "data-lift"))).toBe(0)
  })

  it("grades the comb by length and draws a tine for each row", () => {
    const { container, rerender } = render(<MusicBoxDrum tines={12} behavior="static" />)
    expect(container.querySelectorAll("[data-tine]")).toHaveLength(12)

    rerender(<MusicBoxDrum tines={20} behavior="static" />)
    expect(container.querySelectorAll("[data-tine]")).toHaveLength(20)
    // Clamped, not crashed.
    rerender(<MusicBoxDrum tines={99} behavior="static" />)
    expect(container.querySelectorAll("[data-tine]")).toHaveLength(20)
  })

  it("turns the barrel and reports the step under the comb", () => {
    const { container, getByRole, rerender } = render(
      <MusicBoxDrum turn={0} tines={4} pattern={pattern} behavior="static" />,
    )
    expect(getByRole("img").getAttribute("aria-label")).toContain("step 1/8")

    rerender(<MusicBoxDrum turn={180} tines={4} pattern={pattern} behavior="static" />)
    expect(getByRole("img").getAttribute("aria-label")).toContain("step 5/8")
    expect(Number(attribute(container, "[data-barrel]", "data-turn"))).toBe(180)
  })

  it("runs the fly faster than the barrel and can be sent away", () => {
    const { container, rerender } = render(<MusicBoxDrum turn={40} behavior="static" />)
    expect(Number(attribute(container, "[data-fly]", "data-turn"))).toBeCloseTo(360, 6)

    rerender(<MusicBoxDrum turn={40} showFly={false} behavior="static" />)
    expect(container.querySelector("[data-fly]")).toBeNull()
  })

  it("projects a different drawing from a different camera", () => {
    const { container, getByRole, rerender } = render(<MusicBoxDrum turn={70} view="plan" behavior="static" />)
    const plan = container.querySelector("[data-bedplate]")!.getAttribute("d")

    rerender(<MusicBoxDrum turn={70} view="iso" behavior="static" />)
    expect(container.querySelector("[data-bedplate]")!.getAttribute("d")).not.toBe(plan)
    expect(getByRole("img").getAttribute("aria-label")).toContain("isometric view")
  })

  it("is a slider you can crank when it is interactive", () => {
    const { getByRole } = render(
      <MusicBoxDrum interactive turn={180} tines={4} pattern={pattern} behavior="static" />,
    )
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("5")
    expect(slider.getAttribute("aria-valuemax")).toBe("8")
  })

  it("turns and plucks nothing on an empty pattern, and survives nonsense", () => {
    const { container } = render(
      <MusicBoxDrum turn={Number.NaN} tines={Number.NaN} pattern={[]} color="#aabbcc" behavior="static" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
    expect(container.querySelector("[data-pin]")).toBeNull()
  })

  it("runs the barrel from the clock, and parks when static", () => {
    expect(musicBoxGoal("static", 2)).toBe(0)
    expect(musicBoxGoal("play", Number.NaN)).toBe(0)
    expect(musicBoxGoal("play", 1)).toBeCloseTo(360, 6)
    // A hunting governor never runs the barrel backwards over a whole turn.
    expect(musicBoxGoal("cadence", 1)).toBeCloseTo(360, 6)
    expect(musicBoxGoal("cadence", 0.25)).toBeGreaterThan(musicBoxGoal("cadence", 0.2))
  })
})

describe("busker droid", () => {
  // Kick on step 0, snare on step 4, cymbal never.
  const pattern = ["x.......", "....x...", "........"]

  it("raises a beater as its step comes round and drops it on the beat", () => {
    const raised = (beat: number) => {
      const { container } = render(
        <BuskerDroid beat={beat} pattern={pattern} behavior="static" />,
      )
      return Number(attribute(container, '[data-arm="left"]', "data-lift"))
    }
    expect(raised(4)).toBeGreaterThan(10)
    expect(raised(4.01)).toBe(0)
    expect(raised(2)).toBe(0)
    // The cymbal arm has no pins at all, so it never lifts.
    const { container } = render(<BuskerDroid beat={4} pattern={pattern} behavior="static" />)
    expect(Number(attribute(container, '[data-arm="right"]', "data-lift"))).toBe(0)
  })

  it("works the pedal off the kick row", () => {
    const swing = (beat: number) => {
      const { container } = render(
        <BuskerDroid beat={beat} pattern={pattern} behavior="static" />,
      )
      return Number(attribute(container, "[data-pedal]", "data-swing"))
    }
    expect(swing(0)).toBeGreaterThan(40)
    expect(swing(0.05)).toBe(0)
    expect(swing(2)).toBe(0)
  })

  it("solves both arms and keeps their bones the same length in every pose", () => {
    for (const beat of [0, 1.5, 3.9, 4, 6.2]) {
      const { container } = render(
        <BuskerDroid beat={beat} pattern={pattern} behavior="static" />,
      )
      expect(container.querySelectorAll("[data-joint]")).toHaveLength(2)
      expect(container.querySelectorAll("[data-beater]")).toHaveLength(2)
    }
  })

  it("names the step and the view, and stands on a shadow", () => {
    const { container, getByRole } = render(
      <BuskerDroid beat={4} pattern={pattern} view="iso" behavior="static" />,
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("step 5/8")
    expect(label).toContain("isometric view")
    expect(container.querySelector("ellipse")).not.toBeNull()
  })

  it("projects a different drawing from a different camera", () => {
    const { container, rerender } = render(<BuskerDroid beat={2} view="front" behavior="static" />)
    const front = container.querySelector("[data-torso]")!.getAttribute("d")
    rerender(<BuskerDroid beat={2} view="profile" behavior="static" />)
    expect(container.querySelector("[data-torso]")!.getAttribute("d")).not.toBe(front)
  })

  it("is a slider you can scrub when it is interactive", () => {
    const { getByRole } = render(
      <BuskerDroid interactive beat={4} pattern={pattern} behavior="static" />,
    )
    expect(getByRole("slider").getAttribute("aria-valuenow")).toBe("5")
    expect(getByRole("slider").getAttribute("aria-valuemax")).toBe("8")
  })

  it("plays nothing on an empty pattern and stays neutral on nonsense", () => {
    const { container } = render(
      <BuskerDroid beat={Number.NaN} pattern={[]} color="#aabbcc" behavior="static" />,
    )
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
    expect(container.innerHTML).toContain("#aabbcc")
    expect(Number(attribute(container, '[data-arm="left"]', "data-lift"))).toBe(0)
  })

  it("runs the pattern from the clock, and parks when static", () => {
    expect(buskerGoal("static", 2, 16)).toBe(0)
    expect(buskerGoal("groove", Number.NaN, 16)).toBe(0)
    expect(buskerGoal("groove", 1, 16)).toBe(16)
    // A fill is the same pattern at double time.
    expect(buskerGoal("fill", 1, 16)).toBe(32)
    expect(buskerGoal("groove", 1, Number.NaN)).toBe(0)
  })
})

describe("robot grand piano", () => {
  const roll = ["x..."]
  const lanes = [40]

  it("strikes the note the roll names, and nothing else", () => {
    const { container } = render(
      <RobotGrandPiano roll={roll} lanes={lanes} beat={0} behavior="static" />,
    )
    expect(Number(attribute(container, '[data-hammer="40"]', "data-travel"))).toBeGreaterThan(0)
    expect(Number(attribute(container, '[data-hammer="41"]', "data-travel"))).toBe(0)
    expect(container.querySelector('[data-string="40"]')!.getAttribute("data-sounding")).not.toBeNull()
    expect(container.querySelector('[data-string="41"]')!.getAttribute("data-sounding")).toBeNull()
  })

  it("lets the hammer go before the blow: the key keeps going and the hammer does not", () => {
    const { container, rerender } = render(
      <RobotGrandPiano roll={roll} lanes={lanes} beat={3.8} behavior="static" />,
    )
    const driven = Number(attribute(container, '[data-hammer="40"]', "data-travel"))
    const early = Number(attribute(container, '[data-key="40"]', "data-dip"))

    // Past the escapement. The key is still going down; the hammer is not.
    rerender(<RobotGrandPiano roll={roll} lanes={lanes} beat={3.95} behavior="static" />)
    const escaped = Number(attribute(container, '[data-hammer="40"]', "data-travel"))
    const held = Number(attribute(container, '[data-key="40"]', "data-dip"))
    expect(escaped).toBeGreaterThan(driven)
    expect(held).toBeGreaterThan(early)

    rerender(<RobotGrandPiano roll={roll} lanes={lanes} beat={3.99} behavior="static" />)
    expect(Number(attribute(container, '[data-key="40"]', "data-dip"))).toBeGreaterThan(held)
    expect(Number(attribute(container, '[data-hammer="40"]', "data-travel"))).toBeCloseTo(escaped, 9)
  })

  it("works the pedals: sustain lifts every damper, una corda shifts the action", () => {
    const { container, rerender } = render(<RobotGrandPiano beat={4} behavior="static" />)
    const dampers = [...container.querySelectorAll("[data-damper]")]
    expect(dampers.length).toBeGreaterThan(40)
    // The keys that are down have lifted theirs; the rest are still on their strings.
    expect(dampers.some((damper) => Number(damper.getAttribute("data-lift")) === 0)).toBe(true)
    expect(Number(attribute(container, "[data-action]", "data-shift"))).toBe(0)

    rerender(<RobotGrandPiano beat={4} behavior="static" pedal="damper" />)
    expect(
      [...container.querySelectorAll("[data-damper]")].every(
        (damper) => Number(damper.getAttribute("data-lift")) === 1,
      ),
    ).toBe(true)

    rerender(<RobotGrandPiano beat={4} behavior="static" pedal="shift" />)
    expect(Number(attribute(container, "[data-action]", "data-shift"))).toBeGreaterThan(0)
  })

  it("stands the lid on the prop it is given", () => {
    const { container, rerender } = render(<RobotGrandPiano beat={4} behavior="static" lid="full" />)
    const full = Number(attribute(container, "[data-lid]", "data-angle"))

    rerender(<RobotGrandPiano beat={4} behavior="static" lid="half" />)
    expect(Number(attribute(container, "[data-lid]", "data-angle"))).toBeLessThan(full)

    rerender(<RobotGrandPiano beat={4} behavior="static" lid="closed" />)
    expect(container.querySelector("[data-lid]")).toBeNull()
  })

  it("names the compass, the position and the view, and projects each camera differently", () => {
    const { container, getByRole, rerender } = render(
      <RobotGrandPiano roll={roll} lanes={lanes} beat={0} behavior="static" notes={49} view="profile" />,
    )
    const label = getByRole("img").getAttribute("aria-label")!
    expect(label).toContain("49 notes")
    expect(label).toContain("step 1/4")
    expect(label).toContain("side elevation")
    expect(attribute(container, "[data-view]", "data-view")).toBe("profile")

    const elevation = attribute(container, "[data-soundboard]", "d")
    rerender(
      <RobotGrandPiano roll={roll} lanes={lanes} beat={0} behavior="static" notes={49} view="iso" />,
    )
    expect(attribute(container, "[data-soundboard]", "d")).not.toBe(elevation)
  })

  it("is a slider you can scrub when it is interactive", () => {
    const { getByRole } = render(
      <RobotGrandPiano interactive roll={roll} lanes={lanes} beat={2} behavior="static" />,
    )
    const slider = getByRole("slider")
    expect(slider.getAttribute("aria-valuenow")).toBe("3")
    expect(slider.getAttribute("aria-valuemax")).toBe("4")
    expect(slider.getAttribute("tabindex")).toBe("0")
  })

  it("plays nothing on an empty roll, and stays neutral on nonsense", () => {
    const { container } = render(
      <RobotGrandPiano
        roll={[]}
        lanes={[Number.NaN]}
        beat={Number.NaN}
        notes={Number.NaN}
        behavior="static"
        color="#ff0055"
      />,
    )
    expect(
      [...container.querySelectorAll("[data-hammer]")].every(
        (hammer) => Number(hammer.getAttribute("data-travel")) === 0,
      ),
    ).toBe(true)
    expect(container.querySelectorAll("[data-string]")).toHaveLength(88)
    expect(container.innerHTML).not.toContain("NaN")
    expect(container.innerHTML).toContain("#ff0055")
  })

  it("runs the roll forward and never backward", () => {
    expect(grandPianoGoal("static", 2, 16)).toBe(0)
    expect(grandPianoGoal("perform", 1, 16)).toBeCloseTo(16, 9)
    expect(grandPianoGoal("perform", Number.NaN, 16)).toBe(0)
    for (let clock = 0; clock < 4; clock += 0.05) {
      expect(grandPianoGoal("rubato", clock + 0.05, 16)).toBeGreaterThan(
        grandPianoGoal("rubato", clock, 16),
      )
    }
  })
})
