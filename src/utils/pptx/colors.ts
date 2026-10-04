import { attr, child, children, num } from './xml'

/** Cor com canais 0-255 e alfa 0-1. */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export interface ColorContext {
  /** Cores do tema (`dk1`, `lt1`, `accent1`...), em hex sem `#`. */
  scheme: Record<string, string>
  /** Mapa do mestre: `bg1` -> `lt1`, `tx1` -> `dk1`... */
  map: Record<string, string>
  /** Cor de substituição (`phClr`) dos estilos do tema. */
  placeholder?: Rgba
}

const COLOR_TAGS = new Set(['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr'])

const PRESET: Record<string, string> = {
  black: '000000',
  white: 'ffffff',
  red: 'ff0000',
  green: '008000',
  lime: '00ff00',
  blue: '0000ff',
  yellow: 'ffff00',
  cyan: '00ffff',
  magenta: 'ff00ff',
  gray: '808080',
  grey: '808080',
  darkGray: 'a9a9a9',
  lightGray: 'd3d3d3',
  orange: 'ffa500',
  purple: '800080',
  navy: '000080',
  teal: '008080',
  maroon: '800000',
  olive: '808000',
  silver: 'c0c0c0',
  pink: 'ffc0cb',
  brown: 'a52a2a',
}

export function fromHex(hex: string): Rgba {
  const n = parseInt(hex.slice(0, 6), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
}

function rgbToHsl({ r, g, b }: Rgba): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number, a: number): Rgba {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v, a }
  }
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: Math.round(hue(p, q, h + 1 / 3) * 255),
    g: Math.round(hue(p, q, h) * 255),
    b: Math.round(hue(p, q, h - 1 / 3) * 255),
    a,
  }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Aplica os modificadores de cor do OOXML (luminosidade, tom, alfa...). */
function applyModifiers(color: Rgba, el: Element): Rgba {
  let c = { ...color }
  for (const mod of children(el)) {
    const val = (num(mod, 'val') ?? 0) / 100000
    switch (mod.localName) {
      case 'alpha':
        c.a = clamp01(val)
        break
      case 'alphaMod':
        c.a = clamp01(c.a * val)
        break
      case 'alphaOff':
        c.a = clamp01(c.a + val)
        break
      case 'lumMod':
      case 'lumOff':
      case 'satMod':
      case 'satOff':
      case 'hueMod':
      case 'hueOff': {
        let [h, s, l] = rgbToHsl(c)
        if (mod.localName === 'lumMod') l = clamp01(l * val)
        if (mod.localName === 'lumOff') l = clamp01(l + val)
        if (mod.localName === 'satMod') s = clamp01(s * val)
        if (mod.localName === 'satOff') s = clamp01(s + val)
        if (mod.localName === 'hueMod') h = (h * val) % 1
        if (mod.localName === 'hueOff') h = (h + (num(mod, 'val') ?? 0) / 21600000) % 1
        c = hslToRgb(h, s, l, c.a)
        break
      }
      case 'tint':
        c = {
          r: Math.round(c.r + (255 - c.r) * (1 - val)),
          g: Math.round(c.g + (255 - c.g) * (1 - val)),
          b: Math.round(c.b + (255 - c.b) * (1 - val)),
          a: c.a,
        }
        break
      case 'shade':
        c = { r: Math.round(c.r * val), g: Math.round(c.g * val), b: Math.round(c.b * val), a: c.a }
        break
      case 'inv':
        c = { r: 255 - c.r, g: 255 - c.g, b: 255 - c.b, a: c.a }
        break
      case 'gray': {
        const v = Math.round(0.3 * c.r + 0.59 * c.g + 0.11 * c.b)
        c = { r: v, g: v, b: v, a: c.a }
        break
      }
    }
  }
  return c
}

/** Cor de um elemento de cor, ou do primeiro elemento de cor dentro dele. */
export function resolveColor(el: Element | null | undefined, ctx: ColorContext): Rgba | null {
  if (!el) return null
  const colorEl = COLOR_TAGS.has(el.localName) ? el : children(el).find((c) => COLOR_TAGS.has(c.localName))
  if (!colorEl) return null
  let base: Rgba | null = null
  switch (colorEl.localName) {
    case 'srgbClr':
      base = fromHex(attr(colorEl, 'val') ?? '000000')
      break
    case 'sysClr':
      base = fromHex(attr(colorEl, 'lastClr') ?? (attr(colorEl, 'val') === 'window' ? 'ffffff' : '000000'))
      break
    case 'prstClr':
      base = fromHex(PRESET[attr(colorEl, 'val') ?? ''] ?? '000000')
      break
    case 'scrgbClr': {
      const ch = (n: string) => Math.round(clamp01((num(colorEl, n) ?? 0) / 100000) ** (1 / 2.2) * 255)
      base = { r: ch('r'), g: ch('g'), b: ch('b'), a: 1 }
      break
    }
    case 'hslClr':
      base = hslToRgb(
        (num(colorEl, 'hue') ?? 0) / 21600000,
        (num(colorEl, 'sat') ?? 0) / 100000,
        (num(colorEl, 'lum') ?? 0) / 100000,
        1,
      )
      break
    case 'schemeClr': {
      const name = attr(colorEl, 'val') ?? 'tx1'
      if (name === 'phClr') {
        base = ctx.placeholder ?? fromHex('000000')
      } else {
        const mapped = ctx.map[name] ?? name
        const hex = ctx.scheme[mapped] ?? ctx.scheme[name]
        base = fromHex(hex ?? '000000')
      }
      break
    }
  }
  return base ? applyModifiers(base, colorEl) : null
}

/** Cor de um `solidFill` (ou outro preenchimento com cor). */
export function solidFillColor(fill: Element | null | undefined, ctx: ColorContext): Rgba | null {
  if (!fill || fill.localName !== 'solidFill') return null
  return resolveColor(fill, ctx)
}

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')

/** `#rrggbb`, ou `#rrggbbaa` com transparência. */
export function toHex(c: Rgba): string {
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`
  return c.a >= 0.999 ? base : `${base}${hex2(c.a * 255)}`
}

export function toCss(c: Rgba): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.round(c.a * 1000) / 1000})`
}

/** Cores do tema (`a:clrScheme`). */
export function readScheme(clrScheme: Element | null): Record<string, string> {
  const scheme: Record<string, string> = {}
  for (const entry of children(clrScheme)) {
    const srgb = child(entry, 'srgbClr')
    const sys = child(entry, 'sysClr')
    const hex = srgb ? attr(srgb, 'val') : sys ? (attr(sys, 'lastClr') ?? (attr(sys, 'val') === 'window' ? 'ffffff' : '000000')) : null
    if (hex) scheme[entry.localName] = hex.toLowerCase()
  }
  return scheme
}

/** Mapa de cores do mestre (`p:clrMap`) ou de uma substituição. */
export function readColorMap(clrMap: Element | null): Record<string, string> {
  const map: Record<string, string> = {}
  if (!clrMap) return map
  for (const a of Array.from(clrMap.attributes)) map[a.localName] = a.value
  return map
}
