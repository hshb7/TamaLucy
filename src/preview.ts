// The claude.ai preview shows the app inside a frame that blocks every network
// request, so anything that reaches out (weather, Canvas, the buddy, letters)
// can only say so and point at the real app.
export const framed = typeof window !== 'undefined' && window.self !== window.top

/** The "couldn't reach it" line, honest about the preview. */
export const cantReach = (what: string, otherwise: string) => (framed ? `this preview can’t reach ${what}. it works in the real app.` : otherwise)
