import { useEffect, useRef, useState } from 'react'
import type { WordCount } from '../../utils/aggregate'
import { colorAt } from './palette'

interface Placed {
  text: string
  x: number
  y: number
  size: number
  w: number
  h: number
  colorIndex: number
  isNew: boolean
}

interface WordCloudViewProps {
  words: WordCount[]
}

const WIDTH = 960
const HEIGHT = 540
const PAD = 6

// Canvas reutilizado para medir a largura do texto.
let measureCtx: CanvasRenderingContext2D | null = null
function measureWidth(text: string, size: number): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * size * 0.6
  measureCtx.font = `700 ${size}px sans-serif`
  return measureCtx.measureText(text).width
}

function collides(x: number, y: number, w: number, h: number, placed: Map<string, Placed>): boolean {
  for (const p of placed.values()) {
    if (Math.abs(x - p.x) < (w + p.w) / 2 + PAD && Math.abs(y - p.y) < (h + p.h) / 2 + PAD) {
      return true
    }
  }
  return false
}

/**
 * Acha uma posição livre para uma palavra nova percorrendo uma espiral a
 * partir do centro (0,0). As palavras já posicionadas nunca são movidas:
 * a nova é "arrastada" para fora até caber.
 */
function findSpot(w: number, h: number, placed: Map<string, Placed>): { x: number; y: number } {
  if (placed.size === 0) return { x: 0, y: 0 }
  let t = 0
  const a = 4
  let fallback: { x: number; y: number } | null = null
  for (let i = 0; i < 6000; i++) {
    const r = a * t
    const x = r * Math.cos(t)
    const y = r * Math.sin(t)
    if (!collides(x, y, w, h, placed)) {
      if (!fallback) fallback = { x, y }
      const insideX = x - w / 2 > -WIDTH / 2 && x + w / 2 < WIDTH / 2
      const insideY = y - h / 2 > -HEIGHT / 2 && y + h / 2 < HEIGHT / 2
      if (insideX && insideY) return { x, y }
    }
    t += 0.15
  }
  return fallback ?? { x: 0, y: 0 }
}

/**
 * Nuvem de palavras incremental: tamanho proporcional à frequência, layout
 * estável (novas palavras só são adicionadas, sem reorganizar as existentes)
 * e centralizada. Palavras novas entram com uma animação.
 */
export function WordCloudView({ words }: WordCloudViewProps) {
  const placedRef = useRef<Map<string, Placed>>(new Map())
  const [items, setItems] = useState<Placed[]>([])

  useEffect(() => {
    if (words.length === 0) {
      placedRef.current.clear()
      setItems([])
      return
    }

    const values = words.map((w) => w.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const sizeOf = (v: number): number =>
      max === min ? 44 : 22 + ((v - min) / (max - min)) * 58

    const placed = placedRef.current
    let colorCounter = placed.size
    const rendered: Placed[] = []

    for (const word of words.slice(0, 100)) {
      const size = sizeOf(word.value)
      const existing = placed.get(word.text)
      if (existing) {
        // Mantém a posição; só atualiza o tamanho (cresce com a frequência).
        existing.size = size
        existing.w = measureWidth(word.text, size)
        existing.h = size
        existing.isNew = false
        rendered.push(existing)
      } else {
        const w = measureWidth(word.text, size)
        const h = size
        const spot = findSpot(w, h, placed)
        const entry: Placed = {
          text: word.text,
          x: spot.x,
          y: spot.y,
          size,
          w,
          h,
          colorIndex: colorCounter++,
          isNew: true,
        }
        placed.set(word.text, entry)
        rendered.push(entry)
      }
    }

    setItems(rendered.slice())
  }, [words])

  if (words.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        Aguardando palavras…
      </div>
    )
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
    >
      {/* Grupo transladado ao centro: a nuvem fica sempre centralizada. */}
      <g transform={`translate(${WIDTH / 2}, ${HEIGHT / 2})`}>
        {items.map((item) => (
          <text
            key={item.text}
            x={item.x}
            y={item.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight={700}
            fill={colorAt(item.colorIndex)}
            className={item.isNew ? 'wc-word wc-word-new' : 'wc-word'}
            style={{ fontSize: `${item.size}px`, fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {item.text}
          </text>
        ))}
      </g>
    </svg>
  )
}
