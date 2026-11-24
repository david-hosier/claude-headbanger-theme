import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeAmbience, ThemeSetArgs, ThemeSound } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene'

// ------------------------------------------------------------------ colors

// Black metal: cold charcoal, bone-white text, frost-blue accent, blood red.
const { theme, problems } = makeColors({
  label: 'Headbanger',
  only: 'dark',
  roles: { accent: '#7d9cc8', danger: '#c0222e', success: '#6e9a52', warning: '#c48a2c', pro: '#9a6cc4' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b0a0e',
        'surface-1': '#121116',
        'surface-2': '#18161d',
        'surface-3': '#1e1c24',
        'text-primary': '#ece7dc',
        'text-secondary': '#c4bdb0',
        'text-muted': '#9b9488',
      },
    },
    git: { added: '#8cc068', removed: '#e8606a', modified: '#e0a848' },
  },
})

const SCENES = { idle: buildScene('idle'), play: buildScene('play') }

const playing = atom({ plugin: 'headbanger', key: 'playing' } as const, false)

// ------------------------------------------------------------------- sound

const E2 = 82.41
const hz = (root: number, semis: number) => Math.round(root * 2 ** (semis / 12) * 100) / 100
const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

// Between songs: the crowd murmurs, someone tunes, the drummer taps a tom.
export const IDLE: ThemeAmbience = {
  reverb: 0.35,
  layers: [
    { wave: 'pink', drone: true, gain: 0.22, filter: { type: 'bandpass', hz: 550, to: 900 }, tremolo: { hz: 0.3, depth: 0.4 } },
    { wave: 'brown', drone: true, gain: 0.18, filter: { type: 'lowpass', hz: 380 } },
    { wave: 'saw', notes: ['E2', 'E2', 'A2', 'D3'], scatter: 0.12, step: 0.7, glide: 0.4, gain: 0.16, release: 1.6, pan: -0.5, filter: { type: 'lowpass', hz: 1300 } },
    { wave: 'bell', notes: ['E4', 'B4', 'G4', 'E5'], scatter: 0.08, gain: 0.08, release: 1.4, pan: 0.5 },
    { wave: 'brown', scatter: 0.18, gain: 0.45, release: 0.25, filter: { type: 'lowpass', hz: 160 } },
    { wave: 'white', scatter: 0.07, gain: 0.18, release: 0.18, filter: { type: 'bandpass', hz: 1800 } },
    { wave: 'triangle', notes: ['E1', 'A1', 'B1'], scatter: 0.06, gain: 0.3, release: 1 },
    { wave: 'pink', scatter: 0.04, gain: 0.14, attack: 0.3, release: 1.4, filter: { type: 'bandpass', hz: 1100, to: 1900 } },
  ],
}

// One randomly made section of a black or death metal song.
export function song(): ThemeAmbience {
  const style = pick(['blast', 'blast', 'tremolo', 'death', 'doom'] as const)
  const pulse = { blast: between(14, 16), tremolo: between(11, 13), death: between(8, 10), doom: between(3, 4) }[style]
  const root = hz(E2, pick([0, 1, 3, 5, -2, -4]))
  const fifth = hz(root, 7)
  const dissonant = Math.random() < 0.5
  const harmony = dissonant ? [hz(root, 13), hz(root, 18)] : [hz(root, 15), hz(root, 22)]
  const phrygian = [0, 1, 3, 5, 7, 8, 10, 12, 13, 15]
  const riff = Array.from({ length: 16 }, () => hz(root * 2, pick(phrygian)))

  return {
    reverb: style === 'doom' ? 0.45 : 0.25,
    layers: [
      // kick: a blast is brown noise chopped at the pulse
      { wave: 'brown', drone: true, gain: 0.55, filter: { type: 'lowpass', hz: 170 }, tremolo: { hz: pulse, depth: 1 } },
      // snare
      { wave: 'white', drone: true, gain: 0.2, filter: { type: 'bandpass', hz: 1900 }, tremolo: { hz: pulse / 2, depth: 1 } },
      // cymbal wash
      { wave: 'white', drone: true, gain: 0.07, filter: { type: 'highpass', hz: 6500 }, tremolo: { hz: pulse / 2, depth: 0.6 } },
      // rhythm guitar, tremolo-picked power chord
      { wave: 'saw', drone: true, notes: [root, fifth, root * 2], gain: 0.3, pan: -0.45, filter: { type: 'lowpass', hz: 2300, to: 1300 }, tremolo: { hz: pulse, depth: 0.75 } },
      // second guitar, the cold harmony on top
      { wave: 'saw', drone: true, notes: harmony, gain: 0.2, pan: 0.45, filter: { type: 'lowpass', hz: 2600, to: 1600 }, tremolo: { hz: pulse, depth: 0.75 } },
      // bass
      { wave: 'triangle', drone: true, notes: [root / 2], gain: 0.45, filter: { type: 'lowpass', hz: 320 }, tremolo: { hz: pulse / 2, depth: 0.5 } },
      // lead riffs that fall at random
      { wave: 'saw', notes: riff, scatter: style === 'doom' ? 0.15 : 0.3, step: Math.min(2, 2 / pulse), gain: 0.22, release: 0.12, filter: { type: 'lowpass', hz: 2400 } },
      // the crowd roaring along
      { wave: 'pink', drone: true, gain: 0.12, filter: { type: 'bandpass', hz: 900, to: 1400 } },
    ],
  }
}

export const CUES: NonNullable<ThemeSound['cues']> = {
  // a pick scraped down the strings
  send: { layers: [{ wave: 'white', gain: 0.3, release: 0.45, filter: { type: 'bandpass', hz: 3200, to: 500 } }] },
  // a palm-muted chug
  tool: { layers: [{ wave: 'saw', notes: ['E2', 'B2'], gain: 0.22, release: 0.09, filter: { type: 'lowpass', hz: 520 } }] },
  // a tom fill down the kit
  compact: { layers: [{ wave: 'sine', notes: ['A2', 'F2', 'D2', 'A1'], step: 0.11, glide: -5, gain: 0.45, release: 0.22 }] },
  // the last chord rings out and the crowd cheers
  done: {
    reverb: 0.5,
    layers: [
      { wave: 'saw', notes: ['E2', 'B2', 'E3'], gain: 0.28, release: 2.2, filter: { type: 'lowpass', hz: 1800, to: 500 } },
      { wave: 'white', gain: 0.12, release: 1.8, filter: { type: 'highpass', hz: 5500 } },
      { wave: 'pink', gain: 0.18, attack: 0.25, release: 1.8, filter: { type: 'bandpass', hz: 1200 } },
    ],
  },
  // a pair of harmonics while the band waits on you
  ask: { layers: [{ wave: 'bell', notes: ['E5', 'B5'], step: 0.16, gain: 0.18, release: 0.9 }] },
  // a string snaps
  error: { layers: [{ wave: 'saw', notes: ['E3'], glide: -12, gain: 0.25, release: 0.5, filter: { type: 'lowpass', hz: 1400 } }] },
  // a muted note, higher toward the right of the stage
  click: { layers: [{ wave: 'saw', notes: ['E2', 'F2', 'G2', 'A2', 'A#2', 'B2', 'D3'], gain: 0.2, release: 0.18, filter: { type: 'lowpass', hz: 700 } }] },
}

function look(ambience: ThemeAmbience, withSound: boolean): ThemeSetArgs {
  return {
    colors: theme,
    backdrop: { scene: 'stage', glass: { blur: 8, opacity: 0.74, tint: '#0a090d' } },
    ...(withSound ? { sound: { ambience, cues: CUES } } : {}),
  }
}

let soundRefused = false

async function setLook($: EngineInterface, ambience: ThemeAmbience): Promise<void> {
  if (!soundRefused) {
    try {
      await $.theme.set(look(ambience, true))
      return
    } catch (error) {
      soundRefused = true
      $.ui.log(`headbanger: sound refused, theme set without it: ${String(error)}`)
    }
  }
  await $.theme.set(look(ambience, false))
}

let nextSection: { cancel: () => void } | undefined

function stopSong(): void {
  nextSection?.cancel()
  nextSection = undefined
}

// While Claude works, a new section of the song every 7 to 14 seconds.
function playSong($: EngineInterface): void {
  stopSong()
  void setLook($, song())
  nextSection = $.clock.after(Math.round(between(7000, 14000)), () => playSong($))
}

// ------------------------------------------------------------------- hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) {
      $.ui.log(`headbanger: ${unpainted}`)
    }
    if (await read($, playing)) {
      playSong($)
    } else {
      await setLook($, IDLE)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, playing, () => true)
      playSong($)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      stopSong()
      await update($, playing, () => false)
      await setLook($, IDLE)
    }
    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    if (e.props.plugin !== 'headbanger' || e.props.scene !== 'stage') {
      return next(e)
    }
    const isPlaying = await read($, playing)
    const { Svg } = $.ui.resolve(e)
    return (
      <Svg
        source={isPlaying ? SCENES.play : SCENES.idle}
        alt={
          isPlaying
            ? 'An 8-bit black metal band in corpse paint headbanging on stage while the crowd headbangs and moshes'
            : 'An 8-bit black metal band in corpse paint milling around the stage between songs, the crowd waiting'
        }
        isInteractive
      />
    )
  })
}
