/**
 * The site's rail: the one column every page and the header line up against.
 *
 * It exists because they used to disagree. The header was `max-w-6xl px-4
 * sm:px-6`, the pages `max-w-6xl px-5`, and the docs shell briefly `xl:max-w-7xl`
 * to make room for the table-of-contents rail — so at `xl` the wordmark sat a
 * clear 60-odd pixels to the right of the page title underneath it.
 *
 * One string, imported by the header, the footer and every page shell. Change
 * the width or the gutter here and all of them move together; change it in one
 * caller and the test in `__tests__/rail.test.tsx` fails.
 *
 * Two widths, because one number cannot serve a laptop and a 27-inch display.
 * `max-w-7xl` (1280px) is the working width; past `2xl` the cap opens to 92rem
 * (1472px), which is where the docs page stops looking like a narrow strip
 * marooned in the middle of the screen. Neither value bites below 1280px wide —
 * `w-full` is what governs there — so phones and small laptops are unchanged.
 *
 * The docs page fits its three columns inside this width rather than widening
 * it — see `docs/site-polish.md` for the column arithmetic.
 *
 * The workbench opts out: it is an app frame, not a page, and runs edge to edge.
 * `isFullBleed` in `header-bar.tsx` is what switches the header to match it.
 */
export const rail = "mx-auto w-full max-w-7xl px-5 sm:px-6 2xl:max-w-[92rem]"
