/** Paleta categórica usada nos gráficos e na nuvem de palavras. */
export const CHART_COLORS = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
]

export function colorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}
