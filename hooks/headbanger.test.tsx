import { expect, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

import { crowdLevel } from './register'
import { buildScene, CROWD_LEVELS } from './scene'

const BACKDROP = {
  plugin: 'headbanger',
  component: 'Backdrop',
  props: { scene: 'stage', plugin: 'headbanger', glass: { blur: 8, opacity: 0.74 } },
} as const

// What the status line would report with the context window this full.
const usage = (percent: number) => ({
  startedAt: 0,
  context: { window: 200000, tokens: percent * 2000, percent },
  rateLimits: [],
})

const fansIn = (svg: unknown) => (String(svg).match(/<use /g) ?? []).length

test('session start sets the stage look, with no sound', async ($, on) => {
  const sets: ThemeSetArgs[] = []
  on('theme.set', (_, e) => {
    sets.push(e as unknown as ThemeSetArgs)
    return { value: { isDrawn: true as const, requestId: 'backdrop' } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: usage(0) }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(sets.length).toBe(1)
  expect(sets[0]?.backdrop).toEqual({ scene: 'stage', glass: { blur: 8, opacity: 0.74, tint: '#0a090d' } })
  expect(sets[0]?.sound).toBeUndefined()
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

test('every scene, at every crowd size, fits the Svg limit', () => {
  for (const mode of ['idle', 'play'] as const) {
    for (let level = 0; level < CROWD_LEVELS; level++) {
      const svg = buildScene(mode, level)
      expect(svg.length).toBeLessThan(131072)
      expect(svg.startsWith('<svg ')).toBe(true)
    }
  }
})

test('the crowd grows a level at a time as the context window fills', () => {
  expect([undefined, 0, 14, 15, 34, 35, 55, 74, 75, 100].map(crowdLevel)).toEqual([0, 0, 0, 1, 1, 2, 3, 3, 4, 4])
  for (let level = 1; level < CROWD_LEVELS; level++) {
    expect(fansIn(buildScene('idle', level))).toBeGreaterThan(fansIn(buildScene('idle', level - 1)))
  }
})

test('a fuller context window draws a bigger crowd, and a compaction thins it', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: usage(5) }))
  on('theme.set', () => ({ value: { isDrawn: true as const, requestId: 'backdrop' } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const drawn = async () => {
    const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })
    const svg = await ui.find({ type: 'Svg' })
    await ui.unmount()
    return { fans: fansIn(svg?.props.source), alt: String(svg?.props.alt) }
  }

  const small = await drawn()
  expect(small.alt).toContain('a handful of fans')

  await $.session.measure({ ...usage(80), changed: ['context'] })
  const packed = await drawn()
  expect(packed.alt).toContain('a packed crowd')
  expect(packed.fans).toBeGreaterThan(small.fans)

  await $.session.measure({ ...usage(10), changed: ['context'] })
  expect(await drawn()).toEqual(small)
})
