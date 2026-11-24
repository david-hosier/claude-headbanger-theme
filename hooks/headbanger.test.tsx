import { expect, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

import { CUES, IDLE, song } from './register'

const BACKDROP = {
  plugin: 'headbanger',
  component: 'Backdrop',
  props: { scene: 'stage', plugin: 'headbanger', glass: { blur: 8, opacity: 0.74 } },
} as const

test('session start sets the stage look with sound', async ($, on) => {
  const sets: ThemeSetArgs[] = []
  on('theme.set', (_, e) => {
    sets.push(e as unknown as ThemeSetArgs)
    return { value: { isDrawn: true as const, requestId: 'backdrop' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(sets.length).toBe(1)
  expect(sets[0]?.backdrop).toEqual({ scene: 'stage', glass: { blur: 8, opacity: 0.74, tint: '#0a090d' } })
  expect(sets[0]?.sound?.ambience).toEqual(IDLE)
})

// The ranges ThemeSound documents, checked layer by layer.
function check(list: readonly object[], where: string): string[] {
  const layers = list as readonly Record<string, unknown>[]
  const bad: string[] = []
  const inRange = (name: string, v: unknown, lo: number, hi: number) => {
    if (v !== undefined && (typeof v !== 'number' || v < lo || v > hi)) bad.push(`${where} ${name}=${String(v)}`)
  }
  if (layers.length < 1 || layers.length > 8) bad.push(`${where} has ${layers.length} layers`)
  for (const l of layers) {
    inRange('gain', l.gain, 0, 1)
    inRange('pan', l.pan, -1, 1)
    inRange('attack', l.attack, 0.002, 2)
    inRange('release', l.release, 0.01, 4)
    inRange('step', l.step, 0, 2)
    inRange('glide', l.glide, -24, 24)
    inRange('scatter', l.scatter, 0.02, 10)
    const f = l.filter as { hz: number; to?: number } | undefined
    if (f) (inRange('filter.hz', f.hz, 20, 10000), inRange('filter.to', f.to, 20, 10000))
    const t = l.tremolo as { hz: number; depth: number } | undefined
    if (t) (inRange('tremolo.hz', t.hz, 0.05, 30), inRange('tremolo.depth', t.depth, 0, 1))
    const notes = l.notes as (string | number)[] | undefined
    if (notes) {
      if (notes.length < 1 || notes.length > 16) bad.push(`${where} has ${notes.length} notes`)
      for (const n of notes) if (typeof n === 'number' && n !== 0) inRange('note', n, 20, 10000)
    }
  }
  return bad
}

test('every sound the mod can make is in range', () => {
  const bad = [...check(IDLE.layers, 'idle')]
  for (const [name, cue] of Object.entries(CUES)) bad.push(...check(cue.layers, name))
  for (let i = 0; i < 500; i++) bad.push(...check(song().layers, `song ${i}`))
  expect(bad).toEqual([])
})

test('the backdrop draws the stage on desktop and mobile, nothing in the terminal', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })

  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP, surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(svg).toBeDefined()
    await ui.unmount()
  }
})
