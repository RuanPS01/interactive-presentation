import {
  BarChart3,
  CheckCircle2,
  Cloud,
  ListChecks,
  PieChart,
  Type,
  type LucideIcon,
} from 'lucide-react'
import type { SlideType } from '../../types/presentation'

/** Ícone (lucide) associado a cada tipo de slide. */
export const SLIDE_TYPE_ICONS: Record<SlideType, LucideIcon> = {
  wordcloud: Cloud,
  bar: BarChart3,
  pie: PieChart,
  quiz: ListChecks,
  answer: CheckCircle2,
  text: Type,
}
