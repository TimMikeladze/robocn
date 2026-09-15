import { describe, expect, it } from "vitest"

import { formatStars } from "@/lib/github"

describe("star count", () => {
  it("prints the plain number below a thousand", () => {
    expect(formatStars(0)).toBe("0")
    expect(formatStars(999)).toBe("999")
  })

  it("rounds to one decimal in the thousands, and to none past ten", () => {
    expect(formatStars(1000)).toBe("1.0k")
    expect(formatStars(1740)).toBe("1.7k")
    expect(formatStars(9949)).toBe("9.9k")
    expect(formatStars(12400)).toBe("12k")
  })
})
