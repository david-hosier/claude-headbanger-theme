import { atom, read, update } from 'claude-code'
import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene, CROWD_LEVELS } from './scene'
import type { Mode } from './scene'

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

const playing = atom({ plugin: 'headbanger', key: 'playing' } as const, false)

// How big the crowd is, 0 to CROWD_LEVELS - 1: it grows as the context
// window fills, and thins again when a compaction empties it.
const crowd = atom({ plugin: 'headbanger', key: 'crowd' } as const, 0)

const CROWD_AT = [15, 35, 55, 75] // context percent where each next level starts

export function crowdLevel(percent: number | undefined): number {
  const level = CROWD_AT.filter(at => (percent ?? 0) >= at).length
  return Math.min(CROWD_LEVELS - 1, level)
}

const CROWD_WORDS = ['a handful of fans', 'a small crowd', 'a growing crowd', 'a big crowd', 'a packed crowd']

// Scenes are made the first time they're drawn, then kept.
const SCENES = new Map<string, string>()

function scene(mode: Mode, level: number): string {
  const key = `${mode}${level}`
  let svg = SCENES.get(key)
  if (svg === undefined) SCENES.set(key, (svg = buildScene(mode, level)))
  return svg
}

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'stage', glass: { blur: 8, opacity: 0.74, tint: '#0a090d' } },
}

// ------------------------------------------------------------------- hooks

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) {
      $.ui.log(`headbanger: ${unpainted}`)
    }
    await $.theme.set(LOOK)
    // a resumed or reloaded session starts with the crowd it had earned
    const { context } = await $.session.usage()
    await update($, crowd, () => crowdLevel(context.percent))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      const level = crowdLevel(e.context.percent)
      if ((await read($, crowd)) !== level) {
        await update($, crowd, () => level)
      }
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, playing, () => true)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, playing, () => false)
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
    const level = await read($, crowd)
    const { Svg } = $.ui.resolve(e)
    return (
      <Svg
        source={scene(isPlaying ? 'play' : 'idle', level)}
        alt={
          isPlaying
            ? `A pixel-art black metal band in corpse paint headbanging on stage while ${CROWD_WORDS[level]} headbangs and throws horns`
            : `A pixel-art black metal band in corpse paint milling around the stage between songs, ${CROWD_WORDS[level]} waiting`
        }
        isInteractive
      />
    )
  })
}
