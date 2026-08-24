import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { ChoiceTally } from '../../utils/aggregate'
import { totalVotes } from '../../utils/aggregate'
import { colorAt } from './palette'

interface PieChartViewProps {
  data: ChoiceTally[]
  /** Tamanho (px) dos rótulos das fatias e da legenda. */
  labelFontSize?: number
}

const DEFAULT_LABEL_SIZE = 16

export function PieChartView({ data, labelFontSize }: PieChartViewProps) {
  const size = labelFontSize ?? DEFAULT_LABEL_SIZE
  const total = totalVotes(data)
  // O gráfico só mostra fatias com votos; a proporção reflete o total.
  const slices = data.filter((d) => d.votes > 0)

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-400">
        Aguardando votos…
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={slices}
          dataKey="votes"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius="62%"
          isAnimationActive={false}
          fontSize={size}
          // Rótulo curto na fatia (nunca corta, mesmo em tela cheia); o nome
          // completo de cada opção aparece na legenda abaixo.
          // Recharts injeta os campos do dado (votes) no render de label.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label={(entry: any) => {
            const votes = entry.votes as number
            const pct = (votes / total) * 100
            return `${pct.toFixed(0)}% (${votes} voto${votes === 1 ? '' : 's'})`
          }}
          labelLine={false}
        >
          {slices.map((entry) => {
            const originalIndex = data.findIndex((d) => d.id === entry.id)
            return <Cell key={entry.id} fill={colorAt(originalIndex)} />
          })}
        </Pie>
        <Tooltip
          formatter={(value: unknown, name: unknown) => [`${value as number} voto(s)`, name as string]}
        />
        <Legend
          formatter={(value: unknown) => (
            <span className="chart-legend-label" style={{ fontSize: `${size}px` }}>
              {value as string}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
