import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const AXIS_COLOR = '#a3a3a3' // neutral-400: legível em tema claro e escuro

export function BarChartView({ data }: BarChartViewProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} strokeOpacity={0.3} />
        <XAxis
          dataKey="label"
          tick={{ fill: AXIS_COLOR, fontSize: 14 }}
          tickLine={{ stroke: AXIS_COLOR }}
          axisLine={{ stroke: AXIS_COLOR }}
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: AXIS_COLOR, fontSize: 14 }}
          tickLine={{ stroke: AXIS_COLOR }}
          axisLine={{ stroke: AXIS_COLOR }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(99, 102, 241, 0.12)' }}
          contentStyle={{
            borderRadius: 12,
            border: 'none',
            background: '#171717',
            color: '#f5f5f5',
          }}
          labelStyle={{ color: '#f5f5f5' }}
          formatter={(value: unknown) => [`${value as number} voto(s)`, 'Votos']}
        />
        <Bar dataKey="votes" radius={[8, 8, 0, 0]} isAnimationActive={false}>
          {data.map((entry, index) => (
            <Cell key={entry.id} fill={colorAt(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
