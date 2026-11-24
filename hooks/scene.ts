// Headbanger: a pixel-art black metal stage in SVG.
//
// Everything sits on one pixel grid, 240x135 in the box, the wall, floor,
// amps and crowd running on past it so a wide or tall window is still filled.
// Nothing is rotated or scaled at draw time: each character is posed, then
// rasterized frame by frame into whole pixels, and the frames are laid side
// by side in a strip that a steps() animation slides through, like a sprite
// sheet. The hair is a small verlet simulation run through the headbang, so
// it whips back, flips over and falls across the face with real follow-
// through. Strips are defined once and reused, so the scene fits its budget.
// Pure string building, no imports.

export type Mode = 'idle' | 'play'

// ------------------------------------------------------------------ inks

// Every color has a lit twin, used where light from above catches an edge.
const COLORS: string[] = ['']
const LIT: number[] = [0]

function ink(base: string, lit = base): number {
  const id = COLORS.length
  COLORS.push(base)
  if (lit === base) {
    LIT.push(id)
  } else {
    LIT.push(id + 1)
    COLORS.push(lit)
    LIT.push(id + 1)
  }
  return id
}

const I = {
  hair: ink('#1d1424', '#5b3e68'),
  hairBrown: ink('#2c1d14', '#5c4029'),
  hairBlond: ink('#6a4f2a', '#9c7a44'),
  hairGray: ink('#2a2a30', '#5a5a64'),
  shirt: ink('#17162c', '#4a4a80'),
  shirtFar: ink('#0f0e1c', '#201e36'),
  jeans: ink('#15151c', '#3c3c56'),
  jeansFar: ink('#0c0c10', '#24243a'),
  boot: ink('#09090c', '#3a3a46'),
  skin: ink('#a87556', '#d3a07c'),
  skinFar: ink('#7c533c', '#9a6a4c'),
  paint: ink('#e6e0d2', '#fbf8f0'),
  black: ink('#050506'),
  metal: ink('#9aa0aa', '#e0e4ea'),
  red: ink('#8a1420', '#cf3341'),
  blackGtr: ink('#121016', '#454052'),
  bone: ink('#bdb5a4', '#e6e0d2'),
  wood: ink('#4a3826', '#6e5538'),
  board: ink('#17110c'),
  chrome: ink('#7f858f', '#d6dbe2'),
  shell: ink('#5a0e17', '#93202c'),
  drumHead: ink('#b9b2a2', '#e2dccd'),
  kickHead: ink('#0d0b10'),
  brass: ink('#9a7636', '#e6c87e'),
  denim: ink('#24304a', '#3e4e70'),
  patch: ink('#7a7468'),
  vest: ink('#1d1a14', '#3a352a'),
}

// Clothes also catch the backlight along their back edge.
const RIM = new Set([I.shirt, I.shirtFar, I.jeans, I.jeansFar, I.boot])

// ------------------------------------------------------------------ grid

type V = { x: number; y: number }
const v = (x: number, y: number): V => ({ x, y })
const add = (a: V, b: V): V => v(a.x + b.x, a.y + b.y)
const sub = (a: V, b: V): V => v(a.x - b.x, a.y - b.y)
const mul = (a: V, s: number): V => v(a.x * s, a.y * s)
const len = (a: V) => Math.hypot(a.x, a.y)
const norm = (a: V): V => mul(a, 1 / (len(a) || 1))
const rad = (deg: number) => (deg * Math.PI) / 180

// A pixel canvas. World (0, 0) sits at cell (ox, oy); shapes are sampled at
// pixel centres, so they land on whole pixels with no smoothing.
class Grid {
  readonly px: Uint16Array
  readonly w: number
  readonly h: number
  readonly ox: number
  readonly oy: number
  constructor(w = 128, h = 112, ox = 64, oy = 92) {
    this.w = w
    this.h = h
    this.ox = ox
    this.oy = oy
    this.px = new Uint16Array(w * h)
  }

  get(cx: number, cy: number): number {
    return cx < 0 || cy < 0 || cx >= this.w || cy >= this.h ? 0 : this.px[cy * this.w + cx]!
  }

  plot(x: number, y: number, c: number): void {
    const cx = Math.floor(x) + this.ox
    const cy = Math.floor(y) + this.oy
    if (cx >= 0 && cy >= 0 && cx < this.w && cy < this.h) this.px[cy * this.w + cx] = c
  }

  private each(x0: number, y0: number, x1: number, y1: number, inside: (px: number, py: number) => boolean, c: number) {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (inside(x + 0.5, y + 0.5)) this.plot(x, y, c)
      }
    }
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.plot(x + i, y + j, c)
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): void {
    this.each(cx - rx, cy - ry, cx + rx, cy + ry, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1, c)
  }

  disc(cx: number, cy: number, r: number, c: number): void {
    this.ellipse(cx, cy, r, r, c)
  }

  // A stroke from a to b, its radius running from ra to rb.
  capsule(a: V, b: V, ra: number, c: number, rb = ra): void {
    const d = sub(b, a)
    const dd = d.x * d.x + d.y * d.y || 1
    const r = Math.max(ra, rb)
    this.each(
      Math.min(a.x, b.x) - r,
      Math.min(a.y, b.y) - r,
      Math.max(a.x, b.x) + r,
      Math.max(a.y, b.y) + r,
      (px, py) => {
        const t = Math.max(0, Math.min(1, ((px - a.x) * d.x + (py - a.y) * d.y) / dd))
        const qx = a.x + d.x * t - px
        const qy = a.y + d.y * t - py
        const rr = ra + (rb - ra) * t
        return qx * qx + qy * qy <= rr * rr
      },
      c,
    )
  }

  poly(pts: V[], c: number): void {
    const xs = pts.map(p => p.x)
    const ys = pts.map(p => p.y)
    this.each(
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
      (px, py) => {
        let inside = false
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[i]!
          const b = pts[j]!
          if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside
        }
        return inside
      },
      c,
    )
  }

  // A one-pixel line, Bresenham, for strings, sticks and stands.
  line(a: V, b: V, c: number): void {
    let x0 = Math.floor(a.x)
    let y0 = Math.floor(a.y)
    const x1 = Math.floor(b.x)
    const y1 = Math.floor(b.y)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.plot(x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) (err += dy, (x0 += sx))
      if (e2 <= dx) (err += dx, (y0 += sy))
    }
  }

  // The final colors: an edge open to the sky takes its lit twin.
  shaded(): Uint16Array {
    const out = new Uint16Array(this.px.length)
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x]!
        if (c !== 0) out[y * this.w + x] = this.get(x, y - 1) === 0 || (RIM.has(c) && this.get(x - 1, y) === 0) ? LIT[c]! : c
      }
    }
    return out
  }
}

// Turns colored cells into one path per color: each run a one-pixel stroke
// along the middle of its row, each move relative to where the last ended.
function cellsToPaths(cells: { x: number; y: number; n: number; c: number }[]): string {
  const byColor = new Map<number, { x: number; y: number; n: number }[]>()
  for (const run of cells) {
    let list = byColor.get(run.c)
    if (list === undefined) byColor.set(run.c, (list = []))
    list.push(run)
  }
  let out = ''
  for (const [c, runs] of byColor) {
    runs.sort((a, b) => a.y - b.y || a.x - b.x)
    let d = ''
    let px = 0
    let py = 0
    runs.forEach((r, i) => {
      if (i === 0) {
        d += `M${r.x} ${r.y + 0.5}`
      } else {
        const dy = r.y - py
        d += `m${r.x - px}${dy < 0 ? '' : ' '}${dy}`
      }
      d += `h${r.n}`
      px = r.x + r.n
      py = r.y
    })
    out += `<path stroke="${COLORS[c]}" d="${d}"/>`
  }
  return out
}

function runsOf(g: Grid, colors: Uint16Array, x0: number, y0: number, x1: number, y1: number, dx: number, dy: number) {
  const cells: { x: number; y: number; n: number; c: number }[] = []
  for (let y = y0; y <= y1; y++) {
    let x = x0
    while (x <= x1) {
      const c = colors[y * g.w + x]!
      let n = 1
      while (x + n <= x1 && colors[y * g.w + x + n] === c) n++
      if (c !== 0) cells.push({ x: x + dx, y: y + dy, n, c })
      x += n
    }
  }
  return cells
}

// A still picture, its world origin placed at (x, y).
function picture(g: Grid, x: number, y: number): string {
  const colors = g.shaded()
  return cellsToPaths(runsOf(g, colors, 0, 0, g.w - 1, g.h - 1, x - g.ox, y - g.oy))
}

// --------------------------------------------------------------- strips

type Strip = { id: string; def: string; w: number; h: number; ax: number; ay: number; n: number }

// Frames side by side, cropped to the box every frame fits in.
function strip(id: string, frames: Grid[]): Strip {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -1
  let y1 = -1
  for (const g of frames) {
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        if (g.px[y * g.w + x] !== 0) {
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
          y0 = Math.min(y0, y)
          y1 = Math.max(y1, y)
        }
      }
    }
  }
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const cells = frames.flatMap((g, k) => runsOf(g, g.shaded(), x0, y0, x1, y1, k * w - x0, -y0))
  const g0 = frames[0]!
  return { id, def: `<g id="${id}">${cellsToPaths(cells)}</g>`, w, h, ax: g0.ox - x0, ay: g0.oy - y0, n: frames.length }
}

const frames = new Map<string, string>()

function keyframes(body: string): string {
  let name = frames.get(body)
  if (name === undefined) {
    name = `a${frames.size}`
    frames.set(body, name)
  }
  return name
}

const pct = (n: number) => `${+(n * 100).toFixed(2)}%`

// One instance of a strip, its origin at (x, y), running from `delay`
// seconds in. A flipped one faces the other way.
function sprite(s: Strip, x: number, y: number, seconds: number, delay = 0, flip = false): string {
  const run = keyframes(`to{transform:translate(${-s.n * s.w}px,0px)}`)
  const lag = delay === 0 ? '' : `;animation-delay:${(-delay).toFixed(3)}s`
  const anim = s.n > 1 ? ` style="animation:${run} ${seconds}s steps(${s.n}) infinite${lag}"` : ''
  const box =
    `<svg x="${x - s.ax}" y="${y - s.ay}" width="${s.w}" height="${s.h}" viewBox="0 0 ${s.w} ${s.h}">` +
    `<g${anim}><use href="#${s.id}"/></g></svg>`
  return flip ? `<g transform="translate(${2 * x} 0) scale(-1 1)">${box}</g>` : box
}

// Shows `on` during the given windows of `period` and `off` the rest.
function windows(on: string, off: string, period: number, spans: [number, number][]): string {
  let a = ''
  let b = ''
  for (const [s, e] of spans) {
    a += `${pct(s)}{opacity:1}${pct(e)}{opacity:0}`
    b += `${pct(s)}{opacity:0}${pct(e)}{opacity:1}`
  }
  const nOn = keyframes(`0%{opacity:0}${a}100%{opacity:0}`)
  const nOff = keyframes(`0%{opacity:1}${b}100%{opacity:1}`)
  return (
    `<g style="animation:${nOff} ${period}s step-end infinite">${off}</g>` +
    `<g opacity="0" style="animation:${nOn} ${period}s step-end infinite">${on}</g>`
  )
}

// ---------------------------------------------------------------- motion

const easeIn = (x: number) => x * x * x
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)

// A headbang over one beat: an accelerating slam from `up` to `down` that
// lands on `hit`, then an eased lift back.
function bang(u: number, up: number, down: number, hit = 0.375): number {
  return u < hit ? up + (down - up) * easeIn(u / hit) : down + (up - down) * easeInOut((u - hit) / (1 - hit))
}

// The head's frame: centre, its up and its forward.
type Head = { c: V; up: V; fwd: V }

function headFrame(neck: V, pitch: number, r = 4.5): Head {
  const a = rad(pitch)
  const up = v(Math.sin(a), -Math.cos(a))
  const fwd = v(Math.cos(a), Math.sin(a))
  return { c: add(neck, mul(up, r)), up, fwd }
}

// A lock of hair, rooted on the head: where (forward, up) and which way it
// leaves the scalp, and how many links it has.
type Root = { at: [number, number]; dir: [number, number]; links: number }

// Hangs chains from the head and runs them through `periods` cycles of the
// motion, so they settle into a loop, then samples the last one.
function hair(headAt: (t: number) => Head, roots: Root[], o: { period: number; frames: number; link: number; gravity: number; wind?: number }): V[][][] {
  const subSteps = 32
  const dt = o.period / o.frames / subSteps
  const damp = 0.985
  const anchor = (h: Head, r: Root) => {
    const a = add(h.c, add(mul(h.fwd, r.at[0]), mul(h.up, r.at[1])))
    const d = norm(add(mul(h.fwd, r.dir[0]), mul(h.up, r.dir[1])))
    return { a, d }
  }
  const h0 = headAt(0)
  const chains = roots.map(r => {
    const { a, d } = anchor(h0, r)
    const pts = Array.from({ length: r.links + 1 }, (_, i) => (i < 2 ? add(a, mul(d, i * o.link)) : add(a, v(d.x * o.link, o.link * (i - 1)))))
    return { root: r, pts, prev: pts.map(p => ({ ...p })) }
  })
  const out: V[][][] = []
  const cycles = 8
  const total = cycles * o.frames * subSteps
  const g = o.gravity * dt * dt
  const wind = (o.wind ?? 0) * dt * dt
  for (let step = 1; step <= total; step++) {
    const h = headAt(step * dt)
    for (const ch of chains) {
      const { a, d } = anchor(h, ch.root)
      const { pts, prev } = ch
      pts[0] = a
      pts[1] = add(a, mul(d, o.link))
      prev[0] = pts[0]
      prev[1] = pts[1]
      for (let i = 2; i < pts.length; i++) {
        const p = pts[i]!
        const q = prev[i]!
        prev[i] = p
        pts[i] = v(p.x + (p.x - q.x) * damp + wind, p.y + (p.y - q.y) * damp + g)
      }
      for (let k = 0; k < 6; k++) {
        for (let i = 1; i < pts.length - 1; i++) {
          const p = pts[i]!
          const n = pts[i + 1]!
          const dd = sub(n, p)
          const l = len(dd) || 1
          const fix = mul(dd, (l - o.link) / l)
          if (i === 1) {
            pts[i + 1] = sub(n, fix)
          } else {
            pts[i] = add(p, mul(fix, 0.5))
            pts[i + 1] = sub(n, mul(fix, 0.5))
          }
        }
        // stiffness: two links apart never fold closer than this
        for (let i = 0; i < pts.length - 2; i++) {
          const p = pts[i]!
          const n = pts[i + 2]!
          const dd = sub(n, p)
          const l = len(dd) || 1
          const min = o.link * 1.85
          if (l < min) {
            const fix = mul(dd, (min - l) / l)
            if (i < 1) {
              pts[i + 2] = add(n, fix)
            } else {
              pts[i] = sub(p, mul(fix, 0.5))
              pts[i + 2] = add(n, mul(fix, 0.5))
            }
          }
        }
      }
    }
    if (step > total - o.frames * subSteps && (step - (total - o.frames * subSteps)) % subSteps === 0) {
      out.push(chains.map(ch => ch.pts.map(p => ({ ...p }))))
    }
  }
  // the samples come at the end of each frame; the last is frame 0 again
  out.unshift(out.pop()!)
  return out
}

// Locks side by side drawn as one mass: the gaps between neighbours filled,
// so the hair moves as a sheet rather than as separate strings.
function drawMass(g: Grid, locks: V[][], c: number, widths: number[], map: (p: V, i: number) => V = p => p): void {
  for (let k = 0; k < locks.length - 1; k++) {
    const a = locks[k]!
    const b = locks[k + 1]!
    const n = Math.min(a.length, b.length) - 1
    for (let i = 0; i < n; i++) {
      // the sheet narrows toward the ends so the tips stay ragged
      if (i > n - 2) break
      g.poly([map(a[i]!, i), map(a[i + 1]!, i + 1), map(b[i + 1]!, i + 1), map(b[i]!, i)], c)
    }
  }
  locks.forEach((pts, k) => drawLock(g, pts, c, widths[k] ?? 2, 0.7, map))
}

function drawLock(g: Grid, pts: V[], c: number, r0 = 2.4, r1 = 0.9, map: (p: V, i: number) => V = p => p): void {
  const n = pts.length - 1
  for (let i = 0; i < n; i++) {
    const ra = r0 + ((r1 - r0) * i) / n
    const rb = r0 + ((r1 - r0) * (i + 1)) / n
    g.capsule(map(pts[i]!, i), map(pts[i + 1]!, i + 1), ra, c, rb)
  }
}

// Two-bone reach: the knee or elbow between from and to, on whichever side
// points most toward `toward` (knees forward, elbows down and back).
function joint(from: V, to: V, l1: number, l2: number, toward: V): V {
  const d = sub(to, from)
  const dist = Math.min(len(d), l1 + l2 - 0.01)
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  const u = norm(d)
  const side = v(-u.y, u.x)
  const sign = side.x * toward.x + side.y * toward.y < 0 ? -1 : 1
  return add(add(from, mul(u, a)), mul(side, h * sign))
}

const FORWARD = v(1, 0)
const DOWN_BACK = v(-0.6, 1)

// ----------------------------------------------------------- profile rig
//
// A player seen side-on, facing right, feet at (0, 0), about 46 px tall.

type Look = { hair: number; instrument: 'v' | 'bass'; finish: number; trim: number; long: number }

type Body = {
  torso: number // pitch of the torso, degrees, + leans forward
  head: number // pitch of the head
  hip: V
  back: V // back foot
  front: V // front foot
  strum: number
}

const HAIR_ROOTS = (long: number): Root[] => [
  { at: [0.5, 3.6], dir: [-0.4, 1], links: 6 + long },
  { at: [-2.2, 2.2], dir: [-0.9, 0.5], links: 7 + long },
  { at: [-3.4, -0.8], dir: [-0.9, -0.4], links: 6 + long },
]

function torsoFrame(b: Body) {
  const a = rad(b.torso)
  const up = v(Math.sin(a), -Math.cos(a))
  const fwd = v(Math.cos(a), Math.sin(a))
  const neck = add(b.hip, mul(up, 15))
  return { up, fwd, neck, shoulder: add(b.hip, mul(up, 13)) }
}

function bodyHead(b: Body): Head {
  return headFrame(torsoFrame(b).neck, b.head)
}

function instrumentArt(g: Grid, kind: 'v' | 'bass', at: V, axis: V, finish: number, trim: number): { pick: V; fret: V } {
  const n = v(-axis.y, axis.x)
  const L = (s: number, t: number) => add(at, add(mul(axis, s), mul(n, t)))
  const P = (pts: [number, number][]) => pts.map(([s, t]) => L(s, t))
  if (kind === 'v') {
    g.poly(P([[14, -2.5], [-4, -10], [0, -11], [8, -3], [8, 3], [0, 11], [-4, 10], [14, 2.5]]), finish)
    g.poly(P([[-4, -10], [-1.5, -10.8], [14, -1.6], [13, -0.8]]), trim)
    g.poly(P([[-4, 10], [-1.5, 10.8], [14, 1.6], [13, 0.8]]), trim)
    g.capsule(L(13, 0), L(29, 0), 1.1, I.wood)
    g.poly(P([[29, -1.6], [34, -3], [34, 0.8], [29, 1.6]]), I.metal)
    g.capsule(L(6.5, 0), L(9.5, 0), 0.9, I.metal)
    return { pick: L(6, 2.5), fret: L(23, 1.5) }
  }
  g.poly(P([[15, -3], [10, -4.5], [5, -8.5], [-1, -7.5], [2, -3.5], [-1, 0], [2, 3.5], [-2, 8], [5, 7.5], [11, 4], [15, 3]]), finish)
  g.poly(P([[5, -8.5], [-1, -7.5], [2, -3.5], [3, -3.5]]), trim)
  g.capsule(L(14, 0), L(40, 0), 1.2, I.wood)
  g.poly(P([[40, -1.8], [46, -2.6], [46, 1.2], [40, 1.8]]), I.metal)
  g.capsule(L(5, 0), L(8.5, 0), 1, I.metal)
  return { pick: L(6, 2.5), fret: L(30, 1.5) }
}

function profileFrame(look: Look, b: Body, locks: V[][]): Grid {
  const g = new Grid()
  const t = torsoFrame(b)
  const head = bodyHead(b)

  // legs, the far one darker
  const leg = (foot: V, jeans: number) => {
    const knee = joint(b.hip, v(foot.x, foot.y - 2), 11, 10, FORWARD)
    g.capsule(b.hip, knee, 2.3, jeans, 2)
    g.capsule(knee, v(foot.x, foot.y - 2.5), 2, jeans, 1.8)
    g.poly([v(foot.x - 2.2, foot.y - 4), v(foot.x + 1.5, foot.y - 4), v(foot.x + 4, foot.y - 1.5), v(foot.x + 4, foot.y), v(foot.x - 2.2, foot.y)], I.boot)
  }

  // the guitar hangs from the hip and tilts with the torso
  const axis = v(Math.cos(rad(b.torso - 28)), Math.sin(rad(b.torso - 28)))
  const gAt = add(add(b.hip, mul(t.up, 5)), mul(t.fwd, -5))
  const probe = new Grid()
  const hands = instrumentArt(probe, look.instrument, gAt, axis, look.finish, look.trim)
  const pick = add(hands.pick, mul(v(-axis.y, axis.x), b.strum))

  // far arm reaches up the neck, behind the body
  const farShoulder = add(t.shoulder, mul(t.fwd, 1))
  const farElbow = joint(farShoulder, hands.fret, 6.5, 7, DOWN_BACK)
  g.capsule(farShoulder, farElbow, 1.7, I.shirtFar)
  g.capsule(farElbow, hands.fret, 1.4, I.skinFar, 1.2)

  leg(b.back, I.jeansFar)

  // torso, bullet belt, neck
  g.capsule(b.hip, t.neck, 3.6, I.shirt, 3.3)
  const belt = add(b.hip, mul(t.up, 1.5))
  for (let i = -3; i <= 3; i++) {
    const p = add(belt, mul(t.fwd, i))
    g.plot(p.x, p.y, i % 2 === 0 ? I.metal : I.black)
  }
  leg(b.front, I.jeans)
  g.capsule(t.neck, head.c, 1.6, I.skin)

  // head: corpse paint face, black eye socket and mouth, hair cap
  const H = (f: number, u: number) => add(head.c, add(mul(head.fwd, f), mul(head.up, u)))
  g.disc(head.c.x, head.c.y, 4.2, I.paint)
  const nose = H(4.4, -0.4)
  g.plot(nose.x, nose.y, I.paint)
  const eye = H(2.2, 0.2)
  g.plot(eye.x, eye.y, I.black)
  const eye2 = H(1.2, 0.4)
  g.plot(eye2.x, eye2.y, I.black)
  const brow = H(2.4, 1.3)
  g.plot(brow.x, brow.y, I.black)
  const mouth = H(2.8, -2.2)
  g.plot(mouth.x, mouth.y, I.black)
  const mouth2 = H(3.6, -2.3)
  g.plot(mouth2.x, mouth2.y, I.black)
  const cap = H(-1.1, 1.1)
  g.disc(cap.x, cap.y, 4.1, look.hair)

  // the instrument over the body, then the hands that play it
  instrumentArt(g, look.instrument, gAt, axis, look.finish, look.trim)
  g.disc(hands.fret.x, hands.fret.y, 1.4, I.skin)

  const elbow = joint(t.shoulder, pick, 6, 6.5, DOWN_BACK)
  g.capsule(t.shoulder, elbow, 2, I.shirt, 1.8)
  g.capsule(elbow, pick, 1.5, I.skin, 1.3)
  const cuff = add(elbow, mul(sub(pick, elbow), 0.55))
  g.capsule(cuff, cuff, 1.6, I.metal)
  g.disc(pick.x, pick.y, 1.5, I.skin)

  // hair over everything: it falls across the face on the slam
  drawMass(g, locks, look.hair, [2.2, 2.6, 2.2])
  return g
}

const STANCE = { hip: v(0, -20), back: v(-7, 0), front: v(6.5, 0) }

function profileStrip(id: string, look: Look, mode: 'play' | 'stand' | 'walk'): Strip {
  const n = mode === 'stand' ? 6 : 8
  const period = mode === 'play' ? 0.5 : mode === 'stand' ? 3 : 1
  const pose = (u: number): Body => {
    if (mode === 'play') {
      const torso = bang(u, -3, 16)
      return { ...STANCE, torso, head: torso + bang(u, -24, 52), strum: 0 }
    }
    if (mode === 'stand') {
      const s = Math.sin(2 * Math.PI * u)
      return { ...STANCE, torso: 2 + s, head: 10 + 5 * s, strum: 0 }
    }
    // walking: feet trade places, the hips bob at each contact
    const a = 2 * Math.PI * u
    const foot = (ph: number) => v(4.5 * Math.cos(a + ph), -Math.max(0, Math.sin(a + ph)) * 2.5)
    return {
      hip: v(0, -20 - Math.abs(Math.sin(a)) * 0.9),
      back: foot(Math.PI),
      front: foot(0),
      torso: 4,
      head: 8 + Math.sin(2 * a) * 2,
      strum: 0,
    }
  }
  const roots = HAIR_ROOTS(look.long)
  const locks = hair(t => bodyHead(pose((t / period) % 1)), roots, {
    period,
    frames: n,
    link: 3.3,
    gravity: mode === 'play' ? 240 : 160,
    wind: mode === 'walk' ? -90 : 0,
  })
  const grids = Array.from({ length: n }, (_, k) => {
    const b = pose(k / n)
    if (mode === 'play') b.strum = k % 2 === 0 ? -1.3 : 1.3
    return profileFrame(look, b, locks[k]!)
  })
  return strip(id, grids)
}

// -------------------------------------------------------------- front rig
//
// A head seen face-on (or from behind). The hair is the same simulation run
// in profile, then looked at from the front: height kept, depth decides
// whether a lock falls in front of the face or behind the head.

const FRONT_ROOTS: Root[] = [
  { at: [0.5, 3.6], dir: [-0.8, 0.6], links: 6 },
  { at: [-2.5, 2], dir: [-0.9, 0.5], links: 7 },
  { at: [-3.4, -1], dir: [-0.9, -0.4], links: 7 },
]
const SPREAD = [1.2, 2.8, 3.8]

// Each lock is seen as a curtain across the head, as wide as the lock's
// spread and widening as it falls; each piece of it goes in front of the face
// or behind the head by its own depth.
function frontHair(g: Grid, head: Head, locks: V[][], c: number, front: boolean, facing: 1 | -1): void {
  locks.forEach((pts, k) => {
    const half = (i: number) => SPREAD[k]! + 0.6 + i * 0.35 - Math.max(0, i - pts.length + 3) * 1.2
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!
      const b = pts[i + 1]!
      // depth > 0 is toward the viewer
      const depth = ((a.x + b.x) / 2 - head.c.x) * facing
      if (depth > 1.5 !== front) continue
      // hair thrown up over the crown is seen squat and fanned, not as a column
      const top = head.c.y - 3.5
      const ya = a.y < top ? top - (top - a.y) * 0.3 : a.y
      const yb = b.y < top ? top - (top - b.y) * 0.3 : b.y
      const wa = half(i) + Math.max(0, top - a.y) * 0.3
      const wb = Math.max(0.8, half(i + 1)) + Math.max(0, top - b.y) * 0.3
      g.poly([v(-wa, ya - 0.5), v(wa, ya - 0.5), v(wb, yb + 0.5), v(-wb, yb + 0.5)], c)
    }
  })
}

function drummerStrip(id: string, play: boolean): Strip {
  const n = play ? 8 : 4
  const period = play ? 0.5 : 4
  const neck = v(0, -24)
  const pitchAt = (u: number) => (play ? bang(u, -12, 40) : 6 + 6 * Math.sin(2 * Math.PI * u))
  // seen from the side for the simulation: the neck stays put, the head pitches
  const headAt = (t: number) => headFrame(neck, pitchAt((t / period) % 1))
  const locks = hair(headAt, FRONT_ROOTS, { period, frames: n, link: 2.4, gravity: 220 })
  const grids = Array.from({ length: n }, (_, k) => {
    const u = k / n
    const g = new Grid(64, 64, 32, 40)
    const side = headAt(u * period)
    const lift = Math.sin(rad(pitchAt(u)))
    const hy = side.c.y + lift * 1.5
    // arms, sticks alternating on the toms and the snare
    for (const s of [-1, 1] as const) {
      const hitting = play ? (k + (s === 1 ? 0 : 2)) % 4 < 2 : false
      const shoulder = v(6.5 * s, -19)
      const hand = v(9 * s, play ? (hitting ? -11 : -15) : -12)
      const elbow = joint(shoulder, hand, 5, 5, v(s, 0))
      g.capsule(shoulder, elbow, 1.8, I.shirt)
      g.capsule(elbow, hand, 1.4, I.skin)
      const tip = play ? (hitting ? v(hand.x + 6 * s, hand.y + 3) : v(hand.x + 3 * s, hand.y - 6)) : v(hand.x + 6 * s, hand.y + 1)
      g.line(hand, tip, I.bone)
    }
    g.rect(-6, -21, 12, 14, I.shirt)
    g.rect(-5, -22, 10, 1, I.shirt)
    frontHair(g, side, locks[k]!, I.hair, false, 1)
    g.rect(-1, -24, 2, 3, I.skin)
    g.disc(0, hy, 4.2, I.paint)
    // the face shows less as the head pitches down
    const capBottom = hy - 2.5 + lift * 4.5
    for (let y = Math.floor(hy - 5); y < capBottom; y++) g.rect(-5, y, 10, 1, 0)
    g.disc(0, hy - 0.8 - lift * 1.5, 4.3, I.hair)
    for (let y = Math.floor(hy - 6); y < capBottom; y++) for (let x = -5; x < 5; x++) if (g.get(x + g.ox, y + g.oy) === I.paint) g.plot(x, y, I.hair)
    const eyeY = hy + 0.5 + lift * 2
    if (eyeY > capBottom) {
      g.rect(-3, Math.floor(eyeY), 2, 1, I.black)
      g.rect(1, Math.floor(eyeY), 2, 1, I.black)
    }
    const mouthY = hy + 2.5 + lift * 1.5
    if (mouthY > capBottom) g.rect(-1, Math.floor(mouthY), 2, play ? 2 : 1, I.black)
    frontHair(g, side, locks[k]!, I.hair, true, 1)
    return g
  })
  return strip(id, grids)
}

// A fan, from behind: shoulders, the back of the head, hair; some throw horns.
function fanStrip(id: string, c: number, play: boolean, o: { horns: boolean; vest: boolean; strength: number }): Strip {
  const n = play ? 8 : 4
  const period = play ? 0.5 : 4
  const neck = v(0, -13)
  const pitchAt = (u: number) => (play ? bang(u, -8, 22 + 18 * o.strength) : 4 + 4 * Math.sin(2 * Math.PI * u))
  const headAt = (t: number) => headFrame(neck, pitchAt((t / period) % 1), 4)
  const roots: Root[] = FRONT_ROOTS.map(r => ({ ...r, links: r.links - 1 }))
  const locks = hair(headAt, roots, { period, frames: n, link: 2.2, gravity: 220 })
  const grids = Array.from({ length: n }, (_, k) => {
    const u = k / n
    const g = new Grid(48, 56, 24, 40)
    const side = headAt(u * period)
    const hy = side.c.y
    if (o.horns && play) {
      const pump = play ? bang(u, 0, 3) : 0
      const sh = v(5, -10)
      const hand = v(8, -24 + pump)
      const el = joint(sh, hand, 6, 7, v(1, 0.3))
      g.capsule(sh, el, 1.8, o.vest ? I.denim : I.shirt)
      g.capsule(el, hand, 1.4, I.skin)
      g.rect(7, Math.floor(hand.y) - 1, 3, 3, I.skin)
      g.rect(7, Math.floor(hand.y) - 4, 1, 3, I.skin)
      g.rect(9, Math.floor(hand.y) - 4, 1, 3, I.skin)
    }
    g.poly([v(-7, 0), v(-7, -8), v(-5, -11), v(5, -11), v(7, -8), v(7, 0)], o.vest ? I.denim : I.shirt)
    if (o.vest) g.rect(-2, -7, 4, 3, I.patch)
    frontHair(g, side, locks[k]!, c, true, -1)
    g.rect(-1, -13, 2, 2, I.skinFar)
    g.disc(0, hy, 4, c)
    frontHair(g, side, locks[k]!, c, false, -1)
    return g
  })
  return strip(id, grids)
}

// ----------------------------------------------------------------- the kit

// A death metal kit seen from the front, centred at (0, 0) on the riser.
function kitArt(side: 'back' | 'front'): string {
  const g = new Grid(128, 64, 64, 60)
  const stand = (x: number, top: number) => g.line(v(x, -1), v(x, top), I.chrome)
  const cymbal = (x: number, y: number, rx: number, tilt: number) => {
    for (let i = -rx; i <= rx; i++) {
      const yy = y + Math.round((i / rx) * tilt)
      g.plot(x + i, yy, I.brass)
      if (Math.abs(i) < rx - 1) g.plot(x + i, yy + 1, I.brass)
    }
    g.plot(x, y - 1, I.chrome)
  }
  const drum = (x: number, y: number, w: number, h: number) => {
    g.rect(x - w / 2, y, w, h, I.shell)
    g.rect(x - w / 2, y, w, 1, I.chrome)
    g.rect(x - w / 2, y + h - 1, w, 1, I.chrome)
    g.rect(x - w / 2 + 1, y - 1, w - 2, 1, I.drumHead)
  }
  if (side === 'back') {
    g.line(v(-28, -1), v(-28, -26), I.chrome)
    g.line(v(28, -1), v(28, -26), I.chrome)
    g.line(v(-28, -26), v(28, -26), I.chrome)
    g.line(v(-28, -16), v(28, -16), I.chrome)
    g.line(v(-20, -26), v(-18, -31), I.chrome)
    g.line(v(20, -26), v(18, -31), I.chrome)
    g.line(v(-28, -20), v(-34, -24), I.chrome)
    g.line(v(28, -20), v(34, -24), I.chrome)
    cymbal(-18, -32, 6, 1)
    cymbal(18, -32, 6, -1)
    cymbal(-34, -25, 6, 2)
    cymbal(35, -25, 7, -1)
    return picture(g, 0, 0)
  }
  // hi-hat and snare on the left, floor toms right
  stand(-38, -14)
  cymbal(-38, -15, 5, 0)
  cymbal(-38, -13, 5, 0)
  stand(-27, -9)
  drum(-27, -11, 8, 4)
  drum(-36, -9, 7, 9)
  drum(28, -11, 9, 11)
  drum(38, -9, 8, 9)
  // the double kick
  for (const x of [-7, 7]) {
    g.disc(x, -8, 8.2, I.chrome)
    g.disc(x, -8, 7.2, I.shell)
    g.disc(x, -8, 6.2, I.kickHead)
    g.plot(x - 2, -10, I.red)
    g.plot(x - 1, -10, I.red)
    g.plot(x, -10, I.red)
    g.plot(x + 1, -10, I.red)
    g.plot(x + 2, -10, I.red)
    g.plot(x - 1, -9, I.red)
    g.plot(x, -9, I.red)
    g.plot(x + 1, -9, I.red)
    g.plot(x, -8, I.red)
  }
  // rack toms
  drum(-16, -19, 7, 5)
  drum(-7, -21, 7, 5)
  drum(7, -21, 7, 5)
  drum(16, -19, 8, 6)
  return picture(g, 0, 0)
}

// ------------------------------------------------------------------ stage

const R = (x: number, y: number, w: number, h: number, c: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`

// A checkerboard of two colors, for pixel-art dithering.
const DITHERS = new Map<string, string>()
function dither(a: string, b: string): string {
  const key = `${a}${b}`
  let id = DITHERS.get(key)
  if (id === undefined) {
    id = `d${DITHERS.size}`
    DITHERS.set(key, id)
  }
  return `url(#${id})`
}
function ditherDefs(): string {
  return [...DITHERS.entries()]
    .map(([key, id]) => {
      const a = key.slice(0, 7)
      const b = key.slice(7)
      return `<pattern id="${id}" width="2" height="2" patternUnits="userSpaceOnUse">${R(0, 0, 2, 2, a)}${R(0, 0, 1, 1, b)}${R(1, 1, 1, 1, b)}</pattern>`
    })
    .join('')
}

function amp(x: number, y: number): string {
  let a = R(x, y, 20, 7, '#0d0c10') + R(x + 1, y + 1, 18, 1, '#2c2a33') + R(x + 15, y + 4, 2, 1, '#c3222f')
  a += `<path fill="#8d929c" d="M${x + 3} ${y + 4}h1v1h-1zM${x + 6} ${y + 4}h1v1h-1zM${x + 9} ${y + 4}h1v1h-1z"/>`
  for (const cy of [y + 8, y + 22]) {
    let grille = ''
    for (let gy = cy + 2; gy < cy + 12; gy += 2) grille += `M${x + 2} ${gy}h16v1h-16z`
    a += R(x, cy, 20, 14, '#0d0c10') + R(x + 1, cy + 1, 18, 12, '#1b1a21') + `<path fill="#26242d" d="${grille}"/>`
  }
  return a
}

function banner(): string {
  const g = new Grid(112, 40, 0, 0)
  // a black forest along the foot
  for (let i = 0; i < 26; i++) {
    const tx = 4 + i * 4
    const th = 6 + ((i * 7) % 9)
    for (let row = 0; row < th; row++) {
      const w = Math.max(1, Math.floor((row + 2) / 2.2))
      g.rect(tx + 1 - Math.floor(w / 2), 33 - th + row, w, 1, I.kickHead)
    }
  }
  // the thorned logo: spikes on a bar, hooks at the ends
  let x = 14
  for (let i = 0; i < 20; i++) {
    const up = 4 + ((i * 5) % 7)
    const down = 2 + ((i * 3) % 4)
    g.line(v(x, 14), v(x + 2, 14 - up), I.bone)
    g.line(v(x + 2, 14 - up), v(x + 4, 14), I.bone)
    g.line(v(x + 2, 15), v(x + 2, 15 + down), I.bone)
    x += 4
  }
  g.line(v(10, 15), v(96, 15), I.bone)
  g.line(v(12, 17), v(8, 21), I.bone)
  g.line(v(94, 17), v(98, 21), I.bone)
  return R(64, 14, 112, 38, '#15131b') + R(65, 15, 110, 36, '#090a11') + picture(g, 64, 15)
}

export function stage(mode: Mode): string {
  const play = mode === 'play'
  let out = ''
  // the wall, far past the box in every direction
  out += R(-2000, -2000, 4240, 2092, '#0a090d')
  // the glow behind the band, in dithered bands, stronger while they play
  const glow = play ? ['#1a0a10', '#2a0d14', '#3a1018'] : ['#100d12', '#161219', '#1b161e']
  out += R(-2000, 58, 4240, 8, dither('#0a090d', glow[0]!))
  out += R(-2000, 66, 4240, 8, glow[0]!)
  out += R(-2000, 74, 4240, 8, dither(glow[0]!, glow[1]!))
  out += R(-2000, 82, 4240, 10, glow[1]!)
  out += R(-2000, 88, 4240, 4, dither(glow[1]!, glow[2]!))
  // drape and truss
  let folds = ''
  for (let x = -120; x < 360; x += 8) folds += `M${x} -400h2v404h-2z`
  out += `<path fill="#100e14" d="${folds}"/>`
  out += R(-2000, 4, 4240, 1, '#2b2833') + R(-2000, 8, 4240, 1, '#2b2833')
  let zig = ''
  for (let x = -400; x < 640; x += 4) zig += `M${x + (x % 8 === 0 ? 0 : 2)} 5h1v3h-1z`
  out += `<path fill="#221f29" d="${zig}"/>`

  out += banner()
  for (const x of [-46, -24, -2, 20, 200, 222, 244, 266]) out += amp(x, 56)

  // drum riser
  out += R(76, 84, 88, 1, '#3a3542') + R(76, 85, 88, 7, '#16141b')
  let riser = ''
  for (let gy = 87; gy < 92; gy += 2) riser += `M77 ${gy}h86v1h-86z`
  out += `<path fill="#1e1c25" d="${riser}"/>`

  // stage floor, its lip and front face
  out += R(-2000, 92, 4240, 20, '#1a1720')
  let planks = ''
  for (let py = 95; py < 112; py += 4) planks += `M-2000 ${py}h4240v1h-4240z`
  out += `<path fill="#141218" d="${planks}"/>`
  out += R(-2000, 112, 4240, 2, '#3a3542') + R(-2000, 114, 4240, 10, '#24202b') + R(-2000, 124, 4240, 2000, '#0b0a0f')
  let lamps = ''
  for (let x = -400; x < 640; x += 30) lamps += `M${x} 112h3v1h-3z`
  out += `<path fill="${play ? '#e0404e' : '#8a7448'}" d="${lamps}"/>`
  return out
}

function wedge(x: number): string {
  return `<path fill="#08070a" d="M${x} 110h14v2h-14zM${x + 1} 107h12v3h-12z"/>` + R(x + 3, 108, 8, 1, '#1d1b23')
}

// Beams from the truss: stepped pixel cones that breathe slowly.
export function lights(mode: Mode): string {
  const play = mode === 'play'
  const beam = (x: number, lean: number, color: string, alpha: number, seconds: number, delay: number) => {
    const g = new Grid(240, 120, 120, 0)
    g.poly([v(-1, 10), v(2, 10), v(lean + 16, 112), v(lean - 15, 112)], I.black)
    const body = picture(g, x, 0).replace(/stroke="[^"]*"/g, `stroke="${color}"`)
    const name = keyframes(`0%{opacity:${alpha}}50%{opacity:${(alpha * 0.45).toFixed(3)}}100%{opacity:${alpha}}`)
    return `<g opacity="${alpha}" style="animation:${name} ${seconds}s ease-in-out infinite;animation-delay:-${delay}s">${body}</g>`
  }
  const can = (x: number, color: string) => R(x - 3, 9, 6, 4, '#2b2833') + R(x - 2, 12, 4, 1, color)
  if (play) {
    return (
      beam(44, 8, '#c3222f', 0.16, 6, 0) +
      beam(98, -14, '#7d9cc8', 0.1, 8, 2) +
      beam(142, 14, '#7d9cc8', 0.1, 8, 5) +
      beam(196, -8, '#c3222f', 0.16, 6, 3) +
      can(44, '#ff6070') +
      can(98, '#c8dcff') +
      can(142, '#c8dcff') +
      can(196, '#ff6070')
    )
  }
  return beam(120, 0, '#d9b56a', 0.06, 12, 0) + can(44, '#3a3142') + can(98, '#3a3142') + can(120, '#d9b56a') + can(142, '#3a3142') + can(196, '#3a3142')
}

// ------------------------------------------------------------------- band

const LEFT: Look = { hair: I.hair, instrument: 'v', finish: I.red, trim: I.metal, long: 0 }
const SINGER: Look = { hair: I.hair, instrument: 'bass', finish: I.bone, trim: I.blackGtr, long: 1 }

// Walks a sprite between stops of [time, x, facing], one pixel at a time.
function stroll(inner: string, period: number, stops: [number, number, 1 | -1][]): string {
  let body = ''
  stops.forEach(([t, x, f], i) => {
    const next = stops[i + 1]
    const steps = next === undefined ? 1 : Math.abs(next[1] - x)
    const timing = steps === 0 ? 'step-end' : `steps(${steps})`
    body += `${pct(t)}{transform:translate(${x}px,0px) scale(${f},1);animation-timing-function:${timing}}`
  })
  const name = keyframes(body)
  return `<g style="transform-origin:0 0;animation:${name} ${period}s linear infinite">${inner}</g>`
}

type Strips = Record<string, Strip>

function bandStrips(mode: Mode): Strips {
  const play = mode === 'play'
  const s: Strips = {
    drummer: drummerStrip('sD', play),
    fanA: fanStrip('sFa', I.hair, play, { horns: false, vest: false, strength: 1 }),
    fanB: fanStrip('sFb', I.hairBrown, play, { horns: true, vest: true, strength: 0.6 }),
    fanC: fanStrip('sFc', I.hairBlond, play, { horns: false, vest: true, strength: 0.8 }),
    fanD: fanStrip('sFd', I.hairGray, play, { horns: true, vest: false, strength: 1 }),
  }
  if (play) {
    s.gtr = profileStrip('sG', LEFT, 'play')
    s.sing = profileStrip('sS', SINGER, 'play')
  } else {
    s.gtr = profileStrip('sG', LEFT, 'stand')
    s.gtrWalk = profileStrip('sGw', LEFT, 'walk')
    s.sing = profileStrip('sS', SINGER, 'stand')
    s.singWalk = profileStrip('sSw', SINGER, 'walk')
  }
  return s
}

export function band(mode: Mode, s: Strips): string {
  const play = mode === 'play'
  const beat = 0.5
  let out = ''

  out += `<g transform="translate(120 85)">${kitArt("back")}</g>`
  out += sprite(s.drummer!, 120, 78, play ? beat : 4)
  out += `<g transform="translate(120 85)">${kitArt('front')}</g>`

  if (play) {
    out += sprite(s.gtr!, 42, 108, beat, 0)
    out += sprite(s.gtr!, 198, 108, beat, 0.03, true)
    out += sprite(s.sing!, 92, 110, beat, 0.015)
  } else {
    // wander the stage, turning to face the way they walk
    const leftWalk = { period: 17, spans: [[0.08, 0.2], [0.56, 0.68]] as [number, number][] }
    out += `<g transform="translate(42 108)">${stroll(
      windows(sprite(s.gtrWalk!, 0, 0, 1), sprite(s.gtr!, 0, 0, 3), leftWalk.period, leftWalk.spans),
      leftWalk.period,
      [[0, 0, 1], [0.08, 0, 1], [0.2, 32, 1], [0.23, 32, -1], [0.56, 32, -1], [0.68, 0, -1], [0.71, 0, 1], [1, 0, 1]],
    )}</g>`
    const rightWalk = { period: 19, spans: [[0.3, 0.41], [0.76, 0.87]] as [number, number][] }
    out += `<g transform="translate(198 108)">${stroll(
      windows(sprite(s.gtrWalk!, 0, 0, 1, 0.5), sprite(s.gtr!, 0, 0, 3, 1.2), rightWalk.period, rightWalk.spans),
      rightWalk.period,
      [[0, 0, -1], [0.3, 0, -1], [0.41, -32, -1], [0.44, -32, 1], [0.76, -32, 1], [0.87, 0, 1], [0.9, 0, -1], [1, 0, -1]],
    )}</g>`
    const singWalk = { period: 23, spans: [[0.2, 0.29], [0.62, 0.71]] as [number, number][] }
    out += `<g transform="translate(92 110)">${stroll(
      windows(sprite(s.singWalk!, 0, 0, 1, 0.3), sprite(s.sing!, 0, 0, 3, 0.7), singWalk.period, singWalk.spans),
      singWalk.period,
      [[0, 0, 1], [0.2, 0, 1], [0.29, -20, 1], [0.62, -20, 1], [0.71, 0, 1], [1, 0, 1]],
    )}</g>`
  }
  out += micStand()
  // wedges at the front
  out += wedge(60) + wedge(166)
  return out
}

// The singer's mic: a boom stand in front of them, the mic at mouth height
// (the mouth sits near (93, 72) with the head up and (96, 73) standing), so
// the singer bangs down past it on each slam.
function micStand(): string {
  const g = new Grid(32, 48, 0, 0)
  g.line(v(15, 7), v(15, 38), I.chrome) // pole, from the clamp to the floor
  g.rect(12, 38, 7, 1, I.chrome) // tripod foot
  g.line(v(15, 7), v(12, 3), I.chrome) // boom, up and back toward the singer
  g.rect(10, 2, 2, 1, I.black) // mic body
  g.rect(8, 1, 2, 2, I.metal) // grille, just in front of the singer's mouth
  return picture(g, 92, 71)
}

// ------------------------------------------------------------------ crowd

// The crowd grows with the context window: a handful at the barrier at
// first, then more arriving, centre first, out to the sides and back.
export const CROWD_LEVELS = 5
const CROWD_COUNTS = [10, 26, 50, 80, Infinity]

type Slot = { x: number; y: number; kind: number; flip: boolean; delay: number }

// Every place a fan can stand, in the order fans arrive. Rows run back to
// front so nearer fans are drawn over farther ones.
const SLOTS: Slot[] = (() => {
  const hash = (n: number) => {
    const x = Math.sin(n * 127.1) * 43758.5453
    return x - Math.floor(x)
  }
  const all: (Slot & { rank: number; row: number })[] = []
  const rows = [
    { y: 131, step: 9, off: 2 },
    { y: 136, step: 11, off: 7 },
    { y: 144, step: 14, off: 3 },
  ]
  rows.forEach((r, row) => {
    for (let i = -20; i < 50; i++) {
      const x = i * r.step + r.off + Math.floor(hash(i * 3 + row) * 4)
      if (x < -150 || x > 390) continue
      const n = i * 7 + row * 101
      // the front rows near the middle fill first; a little chance mixes it up
      const rank = Math.abs(x - 120) / 70 + (2 - row) * 0.45 + hash(n) * 0.9
      all.push({
        x,
        y: r.y + Math.floor(hash(n + 1) * 3),
        kind: Math.floor(hash(n + 2) * 8),
        flip: hash(n + 3) < 0.5,
        delay: Math.floor(hash(n + 4) * 5) * 0.035,
        rank,
        row,
      })
    }
  })
  return all.sort((a, b) => a.rank - b.rank)
})()

export function crowd(mode: Mode, s: Strips, level: number): string {
  const play = mode === 'play'
  const kinds = [s.fanA!, s.fanB!, s.fanC!, s.fanA!, s.fanD!, s.fanC!, s.fanA!, s.fanB!]
  const seconds = play ? 0.5 : 4
  const count = CROWD_COUNTS[Math.max(0, Math.min(CROWD_LEVELS - 1, level))]!
  const here = SLOTS.slice(0, count).sort((a, b) => a.y - b.y || a.x - b.x)
  let out = ''
  // only the fans in the box move; the rest hold their first frame
  for (const f of here) {
    const kind = kinds[f.kind]!
    const inBox = f.x > -4 && f.x < 244
    const delay = f.delay + (play ? 0 : (f.kind % 4) * 0.7)
    out += inBox ? sprite(kind, f.x, f.y, seconds, delay, f.flip) : sprite({ ...kind, n: 1 }, f.x, f.y, seconds)
  }
  return out
}

// The animation strips are the costly part, so each mode's are made once.
const STRIPS = new Map<Mode, Strips>()

export function buildScene(mode: Mode, level = 0): string {
  frames.clear()
  DITHERS.clear()
  let strips = STRIPS.get(mode)
  if (strips === undefined) STRIPS.set(mode, (strips = bandStrips(mode)))
  const body = stage(mode) + lights(mode) + band(mode, strips) + crowd(mode, strips, level)
  const defs = Object.values(strips)
    .filter((s, i, all) => all.findIndex(o => o.id === s.id) === i)
    .map(s => s.def)
    .join('')
  const css = [...frames.entries()].map(([stops, name]) => `@keyframes ${name}{${stops}}`).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges">` +
    `<style>${css}</style>` +
    `<defs>${ditherDefs()}${defs}</defs>` +
    body +
    `</svg>`
  )
}
