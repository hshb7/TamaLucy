// One shared palette keeps every sprite in the same cozy colour family.
// Each character used in a sprite grid maps to one colour here.
export const PALETTE: Record<string, string> = {
  o: '#4a2a22', // outline (soft cocoa, never pure black)
  b: '#b8703f', // fox brown
  d: '#94552f', // fox brown shade
  l: '#d4945f', // fox brown highlight
  c: '#fff4e3', // cream
  s: '#efd9bd', // cream shade
  k: '#eea39a', // inner ear
  e: '#2b1a17', // eyes / nose
  w: '#ffffff', // sparkle white
  p: '#f59aa6', // blush
  r: '#e5566a', // red
  R: '#b63b4f', // dark red
  P: '#f9c4cf', // light pink
  m: '#ef7fa0', // rose pink
  i: '#fde9ee', // palest pink
  g: '#94c58a', // leaf green
  G: '#5f9a63', // dark green
  y: '#ffd76e', // butter yellow
  Y: '#e5ab3d', // honey
  u: '#9dcdee', // sky blue
  U: '#5f93cb', // blue
  v: '#cbb0ea', // lavender
  V: '#9a7cc4', // purple
  n: '#7b523d', // wood
  N: '#553628', // dark wood
  h: '#b08361', // light wood
  t: '#e3cba9', // tan
  z: '#b3b6bf', // grey
  Z: '#7a7e8a', // dark grey
  x: '#3a3140', // ink
  a: '#ffb27f', // peach
  A: '#e8844f', // orange
  q: '#c9e7f5', // glass
}
