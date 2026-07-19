import type { Texture } from 'pixi.js'
import horseIIdleUrl from '../../assets/live-race/pixel-horse/horse-i-idle.png'
import horseIRunUrl from '../../assets/live-race/pixel-horse/horse-i-run.png'
import horseIStopUrl from '../../assets/live-race/pixel-horse/horse-i-stop.png'
import horseIIIdleUrl from '../../assets/live-race/pixel-horse/horse-ii-idle.png'
import horseIIRunUrl from '../../assets/live-race/pixel-horse/horse-ii-run.png'
import horseIIStopUrl from '../../assets/live-race/pixel-horse/horse-ii-stop.png'
import leashIdleUrl from '../../assets/live-race/pixel-horse/leash-idle.png'
import leashRunUrl from '../../assets/live-race/pixel-horse/leash-run.png'
import leashStopUrl from '../../assets/live-race/pixel-horse/leash-stop.png'
import riderIdleUrl from '../../assets/live-race/pixel-horse/rider-idle.png'
import riderRunUrl from '../../assets/live-race/pixel-horse/rider-run.png'
import riderStopUrl from '../../assets/live-race/pixel-horse/rider-stop.png'

type PixiModule = typeof import('pixi.js')

export type PixelHorseAnimationName = 'idle' | 'run' | 'stop'
export type PixelHorseVariant = 'horseI' | 'horseII'

export interface PixelHorseAnimationFrames {
  frameCount: number
  horseI: Texture[]
  horseII: Texture[]
  leash: Texture[]
  rider: Texture[]
  sheetHeight: number
  sheetWidth: number
}

export interface PixelHorseAssetBundle {
  animations: Record<PixelHorseAnimationName, PixelHorseAnimationFrames>
  frameHeight: number
  frameWidth: number
}

export interface PixelHorseAssetLease {
  assets: PixelHorseAssetBundle
  release: () => Promise<void>
}

interface LoadedPixelHorseAssets {
  assets: PixelHorseAssetBundle
  frameTextures: Texture[]
  pixi: PixiModule
  urls: string[]
}

interface CacheEntry {
  promise: Promise<LoadedPixelHorseAssets>
  references: number
}

const frameWidth = 64
const frameHeight = 64

const sheetUrls = {
  idle: {
    horseI: horseIIdleUrl,
    horseII: horseIIIdleUrl,
    leash: leashIdleUrl,
    rider: riderIdleUrl,
  },
  run: {
    horseI: horseIRunUrl,
    horseII: horseIIRunUrl,
    leash: leashRunUrl,
    rider: riderRunUrl,
  },
  stop: {
    horseI: horseIStopUrl,
    horseII: horseIIStopUrl,
    leash: leashStopUrl,
    rider: riderStopUrl,
  },
} satisfies Record<PixelHorseAnimationName, Record<'horseI' | 'horseII' | 'leash' | 'rider', string>>

const allUrls = Object.values(sheetUrls).flatMap((animation) => Object.values(animation))
let cacheEntry: CacheEntry | null = null
let cleanupChain: Promise<void> = Promise.resolve()

const createFrames = (
  pixi: PixiModule,
  baseTexture: Texture,
  sourceName: string,
  frameTextures: Texture[]
) => {
  const sheetWidth = baseTexture.source.width
  const sheetHeight = baseTexture.source.height

  if (
    sheetWidth <= 0 ||
    sheetHeight <= 0 ||
    sheetWidth % frameWidth !== 0 ||
    sheetHeight % frameHeight !== 0
  ) {
    throw new Error(
      `PixelHorse sheet ${sourceName} has invalid dimensions ${sheetWidth}x${sheetHeight}; expected whole 64x64 cells.`
    )
  }

  baseTexture.source.scaleMode = 'nearest'
  const columns = sheetWidth / frameWidth
  const rows = sheetHeight / frameHeight
  const frames: Texture[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const texture = new pixi.Texture({
        source: baseTexture.source,
        frame: new pixi.Rectangle(
          column * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight
        ),
      })
      texture.source.scaleMode = 'nearest'
      frames.push(texture)
      frameTextures.push(texture)
    }
  }

  return { frames, sheetHeight, sheetWidth }
}

const loadPixelHorseAssets = async (pixi: PixiModule): Promise<LoadedPixelHorseAssets> => {
  const frameTextures: Texture[] = []

  try {
    const loaded = await pixi.Assets.load<Texture>(allUrls)
    const animations = {} as Record<PixelHorseAnimationName, PixelHorseAnimationFrames>

    for (const animationName of Object.keys(sheetUrls) as PixelHorseAnimationName[]) {
      const urls = sheetUrls[animationName]
      const horseI = createFrames(pixi, loaded[urls.horseI], `${animationName}/horse-i`, frameTextures)
      const horseII = createFrames(pixi, loaded[urls.horseII], `${animationName}/horse-ii`, frameTextures)
      const leash = createFrames(pixi, loaded[urls.leash], `${animationName}/leash`, frameTextures)
      const rider = createFrames(pixi, loaded[urls.rider], `${animationName}/rider`, frameTextures)
      const frameCounts = [horseI.frames.length, horseII.frames.length, leash.frames.length, rider.frames.length]
      const sheetDimensions = [horseI, horseII, leash, rider]

      if (new Set(frameCounts).size !== 1 || frameCounts[0] === 0) {
        throw new Error(`PixelHorse ${animationName} layers do not contain the same number of frames.`)
      }
      if (sheetDimensions.some((sheet) => sheet.sheetWidth !== horseI.sheetWidth || sheet.sheetHeight !== horseI.sheetHeight)) {
        throw new Error(`PixelHorse ${animationName} layers do not have matching measured dimensions.`)
      }

      animations[animationName] = {
        frameCount: frameCounts[0],
        horseI: horseI.frames,
        horseII: horseII.frames,
        leash: leash.frames,
        rider: rider.frames,
        sheetHeight: horseI.sheetHeight,
        sheetWidth: horseI.sheetWidth,
      }
    }

    return {
      assets: { animations, frameHeight, frameWidth },
      frameTextures,
      pixi,
      urls: allUrls,
    }
  } catch (error) {
    for (const texture of frameTextures) texture.destroy(false)
    await pixi.Assets.unload(allUrls).catch(() => undefined)
    throw error
  }
}

const releaseCacheEntry = (entry: CacheEntry) => {
  entry.references = Math.max(0, entry.references - 1)
  if (entry.references > 0 || cacheEntry !== entry) return Promise.resolve()

  cacheEntry = null
  cleanupChain = entry.promise
    .then(async (loaded) => {
      for (const texture of loaded.frameTextures) texture.destroy(false)
      await loaded.pixi.Assets.unload(loaded.urls)
    })
    .catch(() => undefined)

  return cleanupChain
}

export const acquirePixelHorseAssets = async (pixi: PixiModule): Promise<PixelHorseAssetLease> => {
  let entry = cacheEntry
  if (!entry) {
    entry = {
      promise: cleanupChain.then(() => loadPixelHorseAssets(pixi)),
      references: 0,
    }
    cacheEntry = entry
  }

  entry.references += 1

  try {
    const loaded = await entry.promise
    let released = false

    return {
      assets: loaded.assets,
      release: () => {
        if (released) return Promise.resolve()
        released = true
        return releaseCacheEntry(entry)
      },
    }
  } catch (error) {
    entry.references = Math.max(0, entry.references - 1)
    if (cacheEntry === entry) cacheEntry = null
    throw error
  }
}
