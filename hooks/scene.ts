// Headbanger: a pixel-art black metal stage in SVG.
//
// The band and stage sit in a 480x300 box that always fits the window
// (preserveAspectRatio meet); the wall, floor, amps and crowd run on past the
// box so a wide or tall window is still filled. Characters are rigs of small
// pixel sprites (legs, torso, head, arms, hair chains) moved by eased CSS
// animations, so the motion is smooth while the art stays pixel art.
// Pure string building, no imports.

export type Mode = 'idle' | 'play'

type Sprite = readonly string[]

const PAL = {
  k: '#07070a', // black clothes
  K: '#26242e', // clothes rim light
  j: '#14141c', // jeans
  J: '#0c0c12', // jeans, far leg
  b: '#2b2833', // boots
  B: '#45404f', // boot shine
  h: '#251d2c', // hair
  H: '#4f4160', // hair shine
  w: '#e9e4d8', // corpse paint
  e: '#020203', // paint black
  s: '#b88d70', // skin
  m: '#7d838e', // metal
  M: '#cfd4dc', // bright metal
  r: '#7c111b', // blood red
  R: '#c3222f', // bright red
  y: '#5a4630', // wood
  v: '#26324a', // denim
  V: '#3b4a68', // denim shine
  p: '#8a8378', // patch
} as const

type Ink = keyof typeof PAL

// ------------------------------------------------------------ drawing kit

function paint(map: Sprite, dx = 0, dy = 0, swap: Partial<Record<Ink, string>> = {}): string {
  const runs: Record<string, string[]> = {}
  map.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]!
      let n = 1
      while (x + n < row.length && row[x + n] === ch) n++
      if (ch in PAL) {
        const color = swap[ch as Ink] ?? PAL[ch as Ink]
        ;(runs[color] ??= []).push(`M${x + dx} ${y + dy}h${n}v1h-${n}z`)
      }
      x += n
    }
  })
  return Object.entries(runs)
    .map(([color, d]) => `<path fill="${color}" d="${d.join('')}"/>`)
    .join('')
}

const at = (x: number, y: number, inner: string) => `<g transform="translate(${x} ${y})">${inner}</g>`

const frames = new Map<string, string>()

function keyframes(body: string): string {
  let name = frames.get(body)
  if (name === undefined) {
    name = `a${frames.size}`
    frames.set(body, name)
  }
  return name
}

// Runs keyframes on a group that pivots on its own origin.
function move(inner: string, body: string, seconds: number, delay = 0, timing = 'ease-in-out'): string {
  const name = keyframes(body)
  const lag = delay === 0 ? '' : `;animation-delay:${(-delay).toFixed(3)}s`
  return `<g style="transform-origin:0 0;animation:${name} ${seconds}s ${timing} infinite${lag}">${inner}</g>`
}

const pct = (n: number) => `${+(n * 100).toFixed(2)}%`
const r = (deg: number) => `rotate(${+deg.toFixed(1)}deg)`

// A swing between two angles, back and forth.
const swing = (a: number, b: number) => `0%{transform:${r(a)}}50%{transform:${r(b)}}100%{transform:${r(a)}}`

// A headbang: a fast slam forward to `down`, then an eased lift back to `up`.
const bang = (up: number, down: number, hit = 0.42) =>
  `0%{transform:${r(up)};animation-timing-function:cubic-bezier(.6,0,.9,.5)}` +
  `${pct(hit)}{transform:${r(down)};animation-timing-function:cubic-bezier(.15,.55,.35,1)}` +
  `100%{transform:${r(up)}}`

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

// ------------------------------------------------------------------- hair

// A lock of hair: a chain of segments, each hung from the end of the last.
// Each link swings like the one above it, a little later and a little
// further, so the lock whips with follow-through.
function lock(opts: {
  links: number
  length: number
  width: number
  body: (link: number) => string
  seconds: number
  lag: number
  delay: number
  shine?: boolean
}): string {
  let inner = ''
  for (let i = opts.links - 1; i >= 0; i--) {
    const w = Math.max(1, opts.width - Math.floor(i / 2))
    const row = 'h'.repeat(w)
    const rows = Array.from({ length: opts.length + 1 }, (_, y) =>
      opts.shine === true && y % 2 === 1 ? 'H' + row.slice(1) : row,
    )
    const seg = paint(rows, -Math.floor(w / 2), 0)
    inner = move(seg + at(0, opts.length, inner), opts.body(i), opts.seconds, opts.delay + opts.lag * (i + 1))
  }
  return inner
}

// ------------------------------------------------------------- profile rig
//
// A player seen side-on, facing right, feet at (0, 0). About 48 px tall.

const P_LEG: Sprite = [
  'jjjj.',
  'jjjj.',
  'jjjj.',
  'jjjj.',
  'jjjj.',
  'jjjj.',
  'jjjj.',
  'jjjj.',
  '.jjj.',
  '.jjj.',
  '.jjj.',
  '.jjj.',
  '.jjj.',
  '.jjj.',
  '.bbbb',
  '.bbbbb',
  '.bBbbbb',
  'bbbbbbb',
]

const P_TORSO: Sprite = [
  '..kkkkk..',
  '.kkkkkkk.',
  '.kkkkkkkK',
  'kkkkkkkkK',
  'kkkkkkkkK',
  'kkkkkkkkK',
  'kkkkkkkk.',
  'kkkkkkkk.',
  '.kkkkkkk.',
  '.kkkkkkk.',
  '.kkkkkkk.',
  '.kkkkkkk.',
  '.kkkkkkk.',
  '.MmMmMmM.',
  '.kkkkkkk.',
  '.kkkkkkk.',
  '..kkkkk..',
]

const P_HEAD: Sprite = [
  '..hhhhh...',
  '.hhhhHhh..',
  'hhhhhhhhw.',
  'hhhhhhwww.',
  'hhhhhweeww',
  'hhhhhwwwww',
  'hhhhhwwweww',
  'hhhhhwewee.',
  '.hhhhwwww..',
  '..hhhwww...',
  '....kkk....',
]

const P_ARM: Sprite = ['kkk', 'kkk', 'kkk', 'kkk', 'kkk', 'kkk', '.kk', '.kk', '.mM', '.Mm', '.ss', '.ss']

// An instrument drawn along its own axis: the body's centreline runs on
// along the neck, from the strap end at x = 0 to the headstock tip. The
// caller tilts the whole thing, so the neck always leaves the body straight.
function instrument(kind: 'v' | 'bass', finish: string, trim: string): string {
  const wood = '#4a3826'
  const board = '#1c1610'
  const fill = (c: string, d: string) => `<path fill="${c}" d="${d}"/>`
  if (kind === 'v') {
    // a flying V: two wings swept back from the neck joint
    const neck = 12
    const head = 27
    return (
      fill(finish, `M${neck} -2L-2 -7L0 -7L6 -2.5L6 2.5L0 7L-2 7L${neck} 2Z`) +
      fill(trim, `M-2 -7L0 -7L${neck} -1.5L${neck} -1ZM-2 7L0 7L${neck} 1.5L${neck} 1Z`) +
      fill(wood, `M${neck - 1} -1.2H${head}V1.2H${neck - 1}Z`) +
      fill(board, `M${neck} -0.6H${head}V0.6H${neck}Z`) +
      fill(PAL.m, `M${head} -1.6L${head + 5} -2.6L${head + 5} 0.4L${head} 1.6Z`) +
      fill(PAL.M, 'M6.5 -1.2h2v2.4h-2zM9.5 -1.2h1.5v2.4h-1.5z')
    )
  }
  // a bass with an offset, pointed body
  const neck = 14
  const head = 40
  return (
    fill(finish, `M${neck} -3L9 -4.5L4 -8L-1 -7L2 -3.5L-1 0L2 3.5L-2 7.5L4 7L10 4L${neck} 3Z`) +
    fill(trim, `M4 -8L-1 -7L2 -3.5L1 -3.5ZM-2 7.5L4 7L2 6.5Z`) +
    fill(wood, `M${neck - 1} -1.4H${head}V1.4H${neck - 1}Z`) +
    fill(board, `M${neck} -0.7H${head}V0.7H${neck}Z`) +
    fill(PAL.m, `M${head} -1.8L${head + 6} -2.2L${head + 6} 1L${head} 1.8Z`) +
    fill(PAL.M, 'M5 -1.6h2.5v3.2h-2.5zM9 -1.2h1.5v2.4h-1.5z')
  )
}

const tilt = (x: number, y: number, deg: number, art: string) => at(x, y, `<g transform="rotate(${deg})">${art}</g>`)


type Walk = { period: number; spans: [number, number][] }

type Rig = {
  guitar: string
  mode: Mode
  delay: number
  walk?: Walk
}

function profile(rig: Rig): string {
  const play = rig.mode === 'play'
  const beat = 0.5

  // legs, hung from the hips at (0, -18)
  const legStill = (front: boolean) => paint(P_LEG, -2, 0, front ? {} : { j: PAL.J })
  const legWalk = (front: boolean) => move(legStill(front), front ? swing(-24, 24) : swing(24, -24), 0.6)
  const legs = (front: boolean) => {
    if (play) return at(0, -18, move(legStill(front), front ? swing(-6, -10) : swing(8, 12), beat, rig.delay))
    if (rig.walk === undefined) return at(0, -18, legStill(front))
    return at(0, -18, windows(legWalk(front), legStill(front), rig.walk.period, rig.walk.spans))
  }

  // hair, hung from the back of the head
  const hairSwing = (i: number) =>
    play ? bang(-30 - i * 10, 60 + i * 22, 0.42 + i * 0.02) : swing(-4 - i * 2, 4 + i * 2)
  const secs = play ? beat : 3.4
  const hair =
    at(-3, -9, lock({ links: 4, length: 5, width: 4, body: hairSwing, seconds: secs, lag: 0.035, delay: rig.delay, shine: true })) +
    at(-1, -10, lock({ links: 4, length: 5, width: 4, body: hairSwing, seconds: secs, lag: 0.04, delay: rig.delay + 0.01 })) +
    at(-4, -7, lock({ links: 4, length: 5, width: 3, body: hairSwing, seconds: secs, lag: 0.05, delay: rig.delay + 0.02, shine: true }))
  const headArt = hair + paint(P_HEAD, -5, -11)
  const head = play
    ? move(headArt, bang(-12, 38), beat, rig.delay)
    : move(headArt, '0%{transform:rotate(0deg)}40%{transform:rotate(9deg)}60%{transform:rotate(9deg)}100%{transform:rotate(0deg)}', 5.2, rig.delay * 7)

  // arms from the shoulder
  const fretArm = at(1, -14, `<g transform="rotate(-70)">${paint(P_ARM, -1, 0, { k: PAL.K })}</g>`)
  const pickArm = at(
    0,
    -14,
    play
      ? move(paint(P_ARM, -1, 0), swing(-12, -26), beat / 2, rig.delay)
      : move(paint(P_ARM, -1, 0), swing(-14, -20), 1.8, rig.delay),
  )

  // the torso leans into each slam
  const torsoArt = fretArm + paint(P_TORSO, -4, -17) + at(1, -17, head) + tilt(-5, -5, -22, rig.guitar) + pickArm
  const torso = play ? move(torsoArt, bang(-4, 10), beat, rig.delay) : torsoArt

  const body = legs(false) + legs(true) + at(0, -18, torso)
  return body
}

// Walks a rig between stops of [time, x, facing], turning smoothly.
function stroll(inner: string, period: number, stops: [number, number, 1 | -1][]): string {
  const body = stops.map(([t, x, f]) => `${pct(t)}{transform:translate(${x}px,0px) scaleX(${f})}`).join('')
  return move(inner, body, period, 0, 'linear')
}

// --------------------------------------------------------------- front rig

const F_HEAD: Sprite = [
  '..hhhhhh..',
  '.hhHhhhhh.',
  'hhHhhhhhhh',
  'hhwwwwwwhh',
  'hheewweehh',
  'hhwewwewhh',
  'hhwwwwwwhh',
  'hhweeeewhh',
  'hhwwwwwwhh',
  '.h.wwww.h.',
  '....kk....',
]

const F_TORSO: Sprite = [
  '...kkkkkk...',
  '.kkkkkkkkkk.',
  'kKkkkkkkkkKk',
  'kkkkkwwkkkkk',
  'kkkkwkkwkkkk',
  'kkkkkwwkkkkk',
  'kkkkkkkkkkkk',
  '.kkkkkkkkkk.',
  '.kkkkkkkkkk.',
  '.kkkkkkkkkk.',
  '.kkkkkkkkkk.',
  '.kkkkkkkkkk.',
  '.mMmMmMmMmM.',
  '.kkkkkkkkkk.',
  '.kkkkkkkkkk.',
]

const F_LEG: Sprite = [
  'jjjj',
  'jjjj',
  'jjjj',
  'jjjj',
  'jjjj',
  'jjjj',
  'jjjj',
  'jjjj',
  'jjj.',
  'jjj.',
  'jjj.',
  'jjj.',
  'jjj.',
  'jjj.',
  'bbbb',
  'bBbb',
  'bbbbb',
]

const F_ARM: Sprite = ['kkk', 'kkk', 'kkk', 'kkk', 'kkk', 'kkk', 'kkk', 'mMm', 'Mmm', 'ss.', 'ss.']


// Front-view hair: the side locks flip up as the head slams down, and a
// curtain falls over the face at the bottom of the bang.
function frontHead(play: boolean, delay: number, beat: number): string {
  const side = (x: number, links: number) =>
    at(
      x,
      -9,
      lock({
        links,
        length: 5,
        width: 3,
        body: i =>
          play
            ? swing(x < 0 ? 4 + i * 3 : -4 - i * 3, x < 0 ? -10 - i * 6 : 10 + i * 6)
            : swing(-2 - i, 2 + i),
        seconds: play ? beat : 3,
        lag: 0.04,
        delay,
        shine: true,
      }),
    )
  const backArt = side(-5, 4) + side(-3, 3) + side(3, 3) + side(5, 4)
  const back = play
    ? move(
        backArt,
        `0%{transform:scaleY(1);animation-timing-function:ease-in}30%{transform:scaleY(-1)}` +
          `55%{transform:scaleY(.7);animation-timing-function:ease-out}100%{transform:scaleY(1)}`,
        beat,
        delay,
      )
    : backArt
  const curtain = paint(
    Array.from({ length: 15 }, (_, y) => (y % 4 === 1 ? 'hhHhhhhHhh' : 'hhhhhhhhhh')),
    -5,
    0,
  )
  const face = play
    ? at(
        0,
        -11,
        move(
          curtain,
          `0%{transform:scaleY(0)}35%{transform:scaleY(0);animation-timing-function:cubic-bezier(.2,.7,.4,1)}` +
            `50%{transform:scaleY(1)}75%{transform:scaleY(1);animation-timing-function:ease-in}100%{transform:scaleY(0)}`,
          beat,
          delay,
        ),
      )
    : ''
  const art = back + paint(F_HEAD, -5, -11) + face
  return play
    ? move(
        art,
        `0%{transform:translate(0px,0px) scaleY(1);animation-timing-function:cubic-bezier(.6,0,.9,.5)}` +
          `42%{transform:translate(0px,4px) scaleY(.82);animation-timing-function:cubic-bezier(.15,.55,.35,1)}` +
          `100%{transform:translate(0px,0px) scaleY(1)}`,
        beat,
        delay,
      )
    : move(art, swing(-4, 4), 6, delay * 5)
}

function singer(mode: Mode, delay: number, walk?: Walk): string {
  const play = mode === 'play'
  const beat = 0.5
  const legStill = (x: number) => at(x, -17, paint(F_LEG))
  const step = '0%{transform:translate(0px,0px)}50%{transform:translate(0px,-3px) scaleY(.85)}100%{transform:translate(0px,0px)}'
  const legWalk = (x: number, phase: number) => at(x, -17, move(paint(F_LEG), step, 0.6, phase))
  const stance = legStill(-6) + legStill(2)
  const legs = walk !== undefined && !play ? windows(legWalk(-6, 0) + legWalk(2, 0.3), stance, walk.period, walk.spans) : stance

  const armL = at(-6, -29, `<g transform="rotate(8)">${paint(F_ARM, -1, 0)}</g>`)
  const armR = at(
    6,
    -29,
    play
      ? move(paint(F_ARM, -1, 0, { k: PAL.K }), swing(-60, -72), beat / 2, delay)
      : `<g transform="rotate(-64)">${paint(F_ARM, -1, 0, { k: PAL.K })}</g>`,
  )
  const torso = paint(F_TORSO, -6, -32) + tilt(-10, -16, -24, instrument('bass', '#141218', PAL.M)) + armL + armR
  return legs + torso + at(0, -32, frontHead(play, delay, beat))
}

function drummer(mode: Mode): string {
  const play = mode === 'play'
  const armArt = paint(F_ARM, -1, 0) + paint(Array.from({ length: 12 }, () => 'M'), 0, 11)
  const arm = (x: number, side: 1 | -1, phase: number) =>
    at(x, -14, play ? move(armArt, swing(side * 150, side * 110), 0.25, phase) : move(armArt, swing(side * 135, side * 128), 2.6, phase))
  const torso = paint(F_TORSO.slice(0, 13), -6, -15)
  return arm(-6, -1, 0) + arm(6, 1, 0.125) + torso + at(0, -15, frontHead(play, 0.08, 0.5))
}

// ---------------------------------------------------------------- the kit

// A big death metal kit, front view, centred at (0, 0) on the riser.
function kit(mode: Mode, side: 'back' | 'front'): string {
  const play = mode === 'play'
  const chrome = '#a7adb7'
  const shell = '#5c0f18'
  const shellHi = '#8f1d29'
  const skin = '#d9d3c4'
  const brass = '#b48f48'
  const brassHi = '#e3c47c'

  const cymbal = (x: number, y: number, rx: number, tilt: number, china = false, wobble = 0) => {
    const disc =
      `<ellipse cx="0" cy="0" rx="${rx}" ry="${(rx / 6).toFixed(1)}" fill="${brass}"/>` +
      `<ellipse cx="0" cy="-0.4" rx="${rx - 1}" ry="${(rx / 10).toFixed(1)}" fill="${brassHi}"/>` +
      (china ? `<path d="M${-rx} 0l-1.5 -1.5M${rx} 0l1.5 -1.5" stroke="${brass}" stroke-width="1"/>` : '') +
      `<rect x="-0.5" y="-2" width="1" height="2" fill="${chrome}"/>`
    const tilted = `<g transform="rotate(${tilt})">${disc}</g>`
    return at(x, y, wobble > 0 && play ? move(tilted, swing(-wobble, wobble), 0.5, Math.abs(x) / 100) : tilted)
  }
  const line = (x1: number, y1: number, x2: number, y2: number, w = 1) =>
    `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${chrome}" stroke-width="${w}" fill="none"/>`
  const drum = (x: number, y: number, w: number, h: number, legs = false) =>
    `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" fill="${shell}"/>` +
    `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${Math.max(1, Math.floor(h / 3))}" fill="${shellHi}"/>` +
    `<rect x="${x - w / 2 - 0.5}" y="${y}" width="${w + 1}" height="1" fill="${chrome}"/>` +
    `<rect x="${x - w / 2 - 0.5}" y="${y + h - 1}" width="${w + 1}" height="1" fill="${chrome}"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="1.4" fill="${skin}"/>` +
    (legs ? line(x - w / 2 + 1, y + h, x - w / 2 - 1, 0) + line(x + w / 2 - 1, y + h, x + w / 2 + 1, 0) : '')
  const kick = (x: number) =>
    `<circle cx="${x}" cy="-12" r="12" fill="${chrome}"/>` +
    `<circle cx="${x}" cy="-12" r="11" fill="${shell}"/>` +
    `<circle cx="${x}" cy="-12" r="10" fill="#0d0b10"/>` +
    `<circle cx="${x}" cy="-12" r="6" fill="none" stroke="${PAL.R}" stroke-width="0.8"/>` +
    `<path d="M${x - 3} -14l3 5l3 -5z" fill="${PAL.R}"/>` +
    `<circle cx="${x + 5}" cy="-7" r="1.6" fill="#1d1a22"/>`

  if (side === 'back') {
    // the cage rack and its cymbals, behind the drummer
    let out = ''
    out += line(-50, 0, -50, -40, 1.4) + line(50, 0, 50, -40, 1.4) + line(-50, -40, 50, -40, 1.4)
    out += line(-50, -22, 50, -22, 1.2)
    out += line(-36, -40, -32, -48) + line(-16, -40, -14, -54) + line(16, -40, 14, -54) + line(36, -40, 32, -48)
    out += line(-50, -30, -58, -36) + line(50, -30, 58, -36) + line(0, -40, 0, -52)
    out += cymbal(-32, -48, 9, -12, false, 6) // crash
    out += cymbal(-14, -54, 8, -6, true, 5) // china
    out += cymbal(0, -52, 4, 0, false, 8) // splash
    out += cymbal(14, -54, 8, 6, false, 5) // crash
    out += cymbal(32, -48, 9, 12, true, 6) // china
    out += cymbal(-58, -36, 9, -16, false, 4) // crash
    out += cymbal(58, -36, 11, 14, false, 3) // ride
    return out
  }

  let out = ''
  // hi-hat, far left
  out += line(-66, 0, -66, -22) + line(-68, 0, -66, -6) + line(-64, 0, -66, -6)
  out += cymbal(-66, -23, 7, 0) + cymbal(-66, -21, 7, 0)
  // snare
  out += line(-46, 0, -46, -14) + drum(-46, -18, 12, 5)
  // floor toms
  out += drum(-58, -14, 11, 12, true) + drum(46, -16, 14, 13, true) + drum(62, -14, 15, 12, true)
  // double kick
  out += kick(-12) + kick(12)
  // four rack toms on the kicks and the rack
  out += drum(-26, -30, 10, 8) + drum(-12, -33, 11, 8) + drum(12, -33, 11, 8) + drum(27, -30, 12, 9)
  return out
}

// ----------------------------------------------------------------- crowd

const HORNS: Sprite = ['s..s', 's..s', 'ssss', 'ssss', '.kk.', '.kk.', '.kk.', '.kk.', '.kk.', '.kk.', '.kk.']

const fill = (color: string, d: string) => `<path fill="${color}" d="${d}"/>`
const FAN_BODY = fill(PAL.K, 'M-5 -2h10v1h-10zM-7 -1h14v1h-14z') + fill(PAL.k, 'M-8 0h16v12h-16z')
const FAN_VEST = fill(PAL.v, 'M-8 1h3v11h-3zM5 1h3v11h-3zM-5 5h10v7h-10z') + fill(PAL.V, 'M-7 1h1v4h-1zM6 1h1v4h-1z') + fill(PAL.p, 'M-2 6h4v3h-4z')

const HAIR: [string, string][] = [
  ['#120f15', '#4a4152'],
  ['#1c1410', '#5a4434'],
  ['#120f15', '#4a4152'],
  ['#2e1d12', '#6e4a2e'],
  ['#16161b', '#56565f'],
  ['#3d2b16', '#86663c'],
]

// A fan seen from behind, the middle of the shoulders at (0, 0).
function fan(seed: number, mode: Mode, animate: boolean): string {
  const play = mode === 'play' && animate
  const [hair, shine] = HAIR[((seed % HAIR.length) + HAIR.length) % HAIR.length]!
  const vest = seed % 3 === 1
  const delay = (((seed % 5) + 5) % 5) * 0.04
  const beat = 0.5

  const long = 12 + (Math.abs(seed) % 3) * 2
  const curtain = fill(hair, `M-4 0h8v${long}h-8z`) + fill(shine, `M-3 1h1v${long - 3}h-1zM1 2h1v${long - 5}h-1z`)
  const back = play
    ? move(
        curtain,
        `0%{transform:scaleY(1);animation-timing-function:ease-in}35%{transform:scaleY(-.9)}` +
          `60%{transform:scaleY(.5);animation-timing-function:ease-out}100%{transform:scaleY(1)}`,
        beat,
        delay,
      )
    : animate
      ? move(curtain, swing(-3, 3), 3 + (Math.abs(seed) % 4) * 0.6, Math.abs(seed) * 0.3)
      : curtain
  const headArt = fill(hair, 'M-4 -10h8v1h-8zM-5 -9h10v8h-10z') + fill(shine, 'M-3 -10h6v1h-6zM-5 -8h1v3h-1z') + at(0, -6, back)
  const head = play
    ? move(
        headArt,
        `0%{transform:translate(0px,0px);animation-timing-function:cubic-bezier(.6,0,.9,.5)}` +
          `42%{transform:translate(0px,5px) scaleY(.8);animation-timing-function:cubic-bezier(.15,.55,.35,1)}` +
          `100%{transform:translate(0px,0px)}`,
        beat,
        delay,
      )
    : animate
      ? move(headArt, swing(-5, 5), 4 + (Math.abs(seed) % 3), Math.abs(seed) * 0.5)
      : headArt
  let horns = ''
  if (mode === 'play' && Math.abs(seed) % 4 === 1) {
    const hand = paint(HORNS, 0, -10)
    horns = at(seed % 2 === 0 ? -9 : 6, 2, animate ? move(hand, swing(-8, 8), beat, delay) : hand)
  }
  return horns + FAN_BODY + (vest ? FAN_VEST : '') + at(0, -1, head)
}

export function crowd(mode: Mode): string {
  let back = ''
  let front = ''
  // the back row runs far past the box; only the fans inside it move
  for (let i = -5; i < 41; i++) {
    const x = i * 13 + (Math.abs(i * 7) % 5)
    back += at(x, 262 + (Math.abs(i * 3) % 4), fan(i + 40, mode, x > 14 && x < 466))
  }
  // the front row is nearer and larger; the middle few are the pit
  for (let i = -3; i < 28; i++) {
    const x = i * 19 + (Math.abs(i * 5) % 7)
    const inBox = x > 14 && x < 466
    let one = at(x, 290 + (Math.abs(i * 5) % 5), `<g transform="scale(1.45)">${fan(i + 7, mode, inBox)}</g>`)
    if (mode === 'play' && x > 190 && x < 290) {
      const dir = i % 2 === 0 ? 1 : -1
      one = move(
        one,
        `0%{transform:translate(0px,0px)}40%{transform:translate(0px,0px)}48%{transform:translate(${12 * dir}px,-5px)}` +
          `56%{transform:translate(${-8 * dir}px,0px)}64%{transform:translate(${10 * dir}px,-4px)}72%{transform:translate(${-5 * dir}px,0px)}` +
          `80%{transform:translate(0px,0px)}100%{transform:translate(0px,0px)}`,
        10,
        i * 0.9,
      )
    }
    front += one
  }
  return back + front
}

// ----------------------------------------------------------------- stage

function amp(x: number, y: number): string {
  let a = `<rect x="${x}" y="${y}" width="40" height="11" fill="#0d0c10"/><rect x="${x + 2}" y="${y + 2}" width="36" height="2" fill="#2c2a33"/>`
  a += `<path fill="#8d929c" d="M${x + 5} ${y + 7}h1v1h-1zM${x + 9} ${y + 7}h1v1h-1zM${x + 13} ${y + 7}h1v1h-1zM${x + 17} ${y + 7}h1v1h-1zM${x + 21} ${y + 7}h1v1h-1z"/>`
  a += `<rect x="${x + 32}" y="${y + 7}" width="3" height="1" fill="#c3222f"/>`
  for (const cy of [y + 12, y + 42]) {
    let grille = ''
    for (let gy = cy + 3; gy < cy + 27; gy += 2) grille += `M${x + 3} ${gy}h34v1h-34z`
    a += `<rect x="${x}" y="${cy}" width="40" height="29" fill="#0d0c10"/><rect x="${x + 2}" y="${cy + 2}" width="36" height="25" fill="#1b1a21"/><path fill="#2c2a33" d="${grille}"/>`
  }
  return a
}

export function stage(mode: Mode): string {
  const play = mode === 'play'
  let out = ''
  // the wall, far past the box in every direction
  out += `<rect x="-2000" y="-2000" width="4480" height="2300" fill="#0b0a0f"/>`
  ;['#0a090d', '#0c0b10', '#0e0d13', '#100f16', '#121119'].forEach((c, i) => {
    out += `<rect x="-2000" y="${100 + i * 26}" width="4480" height="26" fill="${c}"/>`
  })
  // a black velvet drape above the stage, for tall windows
  let folds = ''
  for (let x = -240; x < 720; x += 14) folds += `M${x} -600h4v684h-4z`
  out += `<path fill="#100e14" d="${folds}"/><rect x="-2000" y="40" width="4480" height="2" fill="#1c1a22"/>`
  // truss
  out += `<rect x="-2000" y="84" width="4480" height="2" fill="#2b2833"/><rect x="-2000" y="90" width="4480" height="2" fill="#2b2833"/>`
  let zig = ''
  for (let x = -600; x < 1100; x += 7) zig += `M${x} 86h1v4h-1z`
  out += `<path fill="#221f29" d="${zig}"/>`

  // banner: a thorned logo over a black forest
  out += `<rect x="150" y="100" width="180" height="86" fill="#15131b"/><rect x="153" y="103" width="174" height="80" fill="#0a0b12"/>`
  let trees = ''
  for (let i = 0; i < 29; i++) {
    const tx = 154 + i * 6
    const th = 12 + ((i * 7) % 13)
    for (let row = 0; row < th; row++) {
      const w = Math.max(1, Math.floor((row + 2) / 2))
      trees += `M${tx + 3 - Math.floor(w / 2)} ${182 - th + row}h${w}v1h-${w}z`
    }
  }
  out += `<path fill="#05060a" d="${trees}"/>`
  let spikes = 'M172 124'
  for (let i = 0; i < 34; i++) {
    const up = 6 + ((i * 5) % 9)
    const down = 4 + ((i * 3) % 7)
    spikes += `l2 ${-up}l2 ${up}l0 ${down}l0 ${-down}`
  }
  spikes += 'M168 124h144M174 130l-8 8M306 130l8 8'
  out += `<path d="${spikes}" fill="none" stroke="#b9b3a6" stroke-width="1" stroke-linejoin="miter"/>`

  // amp walls, more of them off past the box
  for (const x of [-84, -40, 4, 48, 388, 432, 476, 520]) out += amp(x, 158)

  // drum riser
  out += `<rect x="164" y="196" width="152" height="3" fill="#302c38"/><rect x="164" y="199" width="152" height="29" fill="#16141b"/>`
  let riser = ''
  for (let gy = 201; gy < 227; gy += 3) riser += `M166 ${gy}h148v1h-148z`
  out += `<path fill="#1e1c25" d="${riser}"/>`

  // stage floor and its lit front face
  out += `<rect x="-2000" y="228" width="4480" height="18" fill="#1b1820"/>`
  let planks = ''
  for (let py = 231; py < 246; py += 4) planks += `M-2000 ${py}h4480v1h-4480z`
  out += `<path fill="#141218" d="${planks}"/>`
  out += `<rect x="-2000" y="246" width="4480" height="3" fill="#3a3542"/><rect x="-2000" y="249" width="4480" height="22" fill="#26222d"/>`
  out += `<rect x="-2000" y="257" width="4480" height="2" fill="#2c2833"/><rect x="-2000" y="271" width="4480" height="2000" fill="#0c0b10"/>`
  let lamps = ''
  for (let x = -600; x < 1100; x += 60) lamps += `M${x} 246h5v1h-5z`
  out += `<path fill="${play ? '#c3222f' : '#6b5a3a'}" d="${lamps}"/>`
  return out
}

function wedge(x: number): string {
  return `<path d="M${x} 246l4 -8h20l2 8z" fill="#0a090d"/><path d="M${x + 5} 240h18v4h-18z" fill="#1d1b23"/>`
}

export function lights(mode: Mode): string {
  const can = (x: number, color: string) =>
    `<rect x="${x - 4}" y="92" width="8" height="6" fill="#2b2833"/><rect x="${x - 3}" y="97" width="6" height="2" fill="${color}"/>`
  const beam = (x: number, color: string, alpha: number, body: string, dur: number, delay: number) =>
    at(x, 98, move(`<path d="M-3 0h6l26 150h-58z" fill="${color}" opacity="${alpha}"/>`, body, dur, delay))
  if (mode === 'play') {
    return (
      beam(90, '#c3222f', 0.15, swing(-26, 22), 7, 0) +
      beam(190, '#6f8fbf', 0.11, swing(20, -20), 9, 2) +
      beam(290, '#6f8fbf', 0.11, swing(-20, 20), 9, 5) +
      beam(390, '#c3222f', 0.15, swing(22, -26), 7, 3) +
      can(90, '#ff6070') +
      can(190, '#b8d0ff') +
      can(290, '#b8d0ff') +
      can(390, '#ff6070')
    )
  }
  return (
    beam(240, '#d9b56a', 0.05, swing(-2, 2), 14, 0) +
    can(90, '#3a3142') +
    can(190, '#3a3142') +
    can(240, '#d9b56a') +
    can(290, '#3a3142') +
    can(390, '#3a3142')
  )
}

export function band(mode: Mode): string {
  const play = mode === 'play'
  let out = ''

  out += at(240, 196, kit(mode, 'back'))
  out += at(240, 178, drummer(mode))
  out += at(240, 196, kit(mode, 'front'))

  const left = profile({ guitar: instrument('v', PAL.R, PAL.M), mode, delay: 0, walk: { period: 17, spans: [[0.08, 0.24], [0.56, 0.72]] } })
  const right = profile({ guitar: instrument('v', '#141218', PAL.M), mode, delay: 0.03, walk: { period: 19, spans: [[0.3, 0.46], [0.76, 0.92]] } })

  if (play) {
    out += at(108, 230, left)
    out += at(372, 230, `<g transform="scale(-1 1)">${right}</g>`)
    out += at(212, 236, singer(mode, 0.015))
  } else {
    // wander the stage, turning to face the way they walk
    out += at(
      108,
      230,
      stroll(left, 17, [[0, 0, 1], [0.08, 0, 1], [0.24, 50, 1], [0.27, 50, -1], [0.56, 50, -1], [0.72, 0, -1], [0.75, 0, 1], [1, 0, 1]]),
    )
    out += at(
      372,
      230,
      stroll(right, 19, [[0, 0, -1], [0.3, 0, -1], [0.46, -54, -1], [0.49, -54, 1], [0.76, -54, 1], [0.92, 0, 1], [0.95, 0, -1], [1, 0, -1]]),
    )
    const walk: Walk = { period: 23, spans: [[0.2, 0.34], [0.62, 0.76]] }
    out += at(
      212,
      236,
      move(
        singer(mode, 0.015, walk),
        `0%{transform:translate(0px,0px)}20%{transform:translate(0px,0px)}34%{transform:translate(-40px,0px)}` +
          `62%{transform:translate(-40px,0px)}76%{transform:translate(0px,0px)}100%{transform:translate(0px,0px)}`,
        23,
        0,
        'linear',
      ),
    )
  }
  // mic stand and wedges at the front
  out += `<path d="M226 236v-36M223 236h6M226 200l-4 -6" stroke="#7d838e" stroke-width="1" fill="none"/><rect x="220" y="191" width="3" height="4" fill="#cfd4dc"/>`
  out += wedge(150) + wedge(306)
  return out
}

export function buildScene(mode: Mode): string {
  frames.clear()
  const body = stage(mode) + lights(mode) + band(mode) + crowd(mode)
  const css = [...frames.entries()].map(([stops, name]) => `@keyframes ${name}{${stops}}`).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 84 440 216" preserveAspectRatio="xMidYMax meet" shape-rendering="crispEdges">` +
    `<style>${css}</style>` +
    body +
    `</svg>`
  )
}
