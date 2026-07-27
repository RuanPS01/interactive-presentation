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
}

export function PieChartView({ data }: PieChartViewProps) {
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
          outerRadius="75%"
          isAnimationActive={false}
          // Recharts injeta os campos do dado (label, votes) no render de label.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label={(entry: any) => {
            const votes = entry.votes as number
            const pct = (votes / total) * 100
            return `${entry.label as string}: ${pct.toFixed(0)}% (${votes} voto${votes === 1 ? '' : 's'})`
          }}
          labelLine={false}
        >
          {slices.map((entry) => {
            const originalIndex = data.findIndex((d) => d.id === entry.id)
            return <Cell key={entry.id} fill={colorAt(originalIndex)} />
          })}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: 'none',
            background: '#171717',
            color: '#f5f5f5',
          }}
          formatter={(value: unknown, name: unknown) => [`${value as number} voto(s)`, name as string]}
        />
        <Legend
          formatter={(value: unknown) => (
            <span className="chart-legend-label">{value as string}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
