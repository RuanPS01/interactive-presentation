import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChoiceTally } from '../../utils/aggregate'
import { colorAt } from './palette'

interface BarChartViewProps {
  data: ChoiceTally[]
}

/** Quebra um rótulo longo em várias linhas (com hard-break e reticências). */
function wrapLabel(text: string, maxChars = 15, maxLines = 4): string[] {
  const tokens = text
    .trim()
    .split(/\s+/)
    .flatMap((token) => {
      const parts: string[] = []
      let rest = token
      while (rest.length > maxChars) {
        parts.push(rest.slice(0, maxChars))
        rest = rest.slice(maxChars)
      }
      parts.push(rest)
      return parts
    })

  const lines: string[] = []
  let current = ''
  for (const word of tokens) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
      if (lines.length >= maxLines) break
    }
  }
  if (current && lines.length < maxLines) lines.push(current)

  if (lines.length >= maxLines) {
    lines.length = maxLines
    const last = lines[maxLines - 1]
    if (last.length > maxChars - 1) lines[maxLines - 1] = `${last.slice(0, maxChars - 1)}…`
    else lines[maxLines - 1] = `${last}…`
  }
  return lines
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WrappedTick({ x, y, payload }: any) {
  const lines = wrapLabel(String(payload.value))
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line, i) => (
        <text
          key={i}
          x={0}
          y={0}
          dy={14 + i * 13}
          textAnchor="middle"
          fontSize={12}
          className="chart-axis-label"
        >
          {line}
        </text>
      ))}
    </g>
  )
}

// Número contador acima de cada barra (estilo Mentimeter). A cor adapta ao
// tema via classe `.bar-count` (ver index.css).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CountLabel({ x, y, width, value }: any) {
  return (
    <text
      x={x + width / 2}
      y={y - 10}
      textAnchor="middle"
      fontSize={24}
      fontWeight={700}
      className="bar-count"
    >
      {value}
    </text>
  )
}

export function BarChartView({ data }: BarChartViewProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 40, right: 16, left: 16, bottom: 8 }}>
        <XAxis
          dataKey="label"
          tick={<WrappedTick />}
          tickLine={false}
          axisLine={false}
          interval={0}
          height={78}
        />
        {/* Eixo de valores oculto: mantém a escala das barras, sem exibir. */}
        <YAxis hide domain={[0, 'dataMax']} />
        <Tooltip
          cursor={{ fill: 'rgba(37, 99, 235, 0.12)' }}
          formatter={(value: unknown) => [`${value as number} voto(s)`, 'Votos']}
        />
        <Bar dataKey="votes" radius={[8, 8, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="votes" content={<CountLabel />} />
          {data.map((entry, index) => (
            <Cell key={entry.id} fill={colorAt(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
