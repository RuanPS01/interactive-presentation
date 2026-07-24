import { useEffect, useState } from 'react'
import cloud from 'd3-cloud'
import type { WordCount } from '../../utils/aggregate'
import { colorAt } from './palette'

interface PlacedWord {
  text: string
  size: number
  x: number
  y: number
  rotate: number
}

interface WordCloudViewProps {
  words: WordCount[]
}

const WIDTH = 960
const HEIGHT = 540

/** Nuvem de palavras: fonte proporcional à frequência, layout via d3-cloud. */
export function WordCloudView({ words }: WordCloudViewProps) {
  const [placed, setPlaced] = useState<PlacedWord[]>([])

  useEffect(() => {
    if (words.length === 0) {
      setPlaced([])
      return
    }

    const values = words.map((w) => w.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    const fontSize = (value: number): number => {
      if (max === min) return 56
      const t = (value - min) / (max - min)
      return 22 + t * 76
    }

    let cancelled = false
    const layout = cloud<PlacedWord>()
      .size([WIDTH, HEIGHT])
      .words(
        words.slice(0, 80).map((w) => ({
          text: w.text,
          size: fontSize(w.value),
          x: 0,
          y: 0,
          rotate: 0,
        })),
      )
      .padding(6)
      .rotate(() => 0)
      .font('Inter, system-ui, sans-serif')
      .fontSize((d) => d.size)
      .on('end', (out: PlacedWord[]) => {
        if (!cancelled) setPlaced(out)
      })

    layout.start()
    return () => {
      cancelled = true
      layout.stop()
    }
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
      <g transform={`translate(${WIDTH / 2}, ${HEIGHT / 2})`}>
        {placed.map((w, i) => (
          <text
            key={`${w.text}-${i}`}
            textAnchor="middle"
            transform={`translate(${w.x}, ${w.y}) rotate(${w.rotate})`}
            fontSize={w.size}
            fontWeight={700}
            fill={colorAt(i)}
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            {w.text}
          </text>
        ))}
      </g>
    </svg>
  )
}
