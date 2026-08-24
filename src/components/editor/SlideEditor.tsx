import type { Slide } from '../../types/presentation'
import { WordCloudConfig } from './WordCloudConfig'
import { ChoiceConfig } from './ChoiceConfig'
import { QuizConfig } from './QuizConfig'
import { AnswerConfig } from './AnswerConfig'
import { TextConfig } from './TextConfig'
import { SlideSettingsSection } from './SlideSettingsSection'

interface SlideEditorProps {
  slide: Slide
}

/** Formulário do slide selecionado: campos do tipo + opções individuais. */
export function SlideEditor({ slide }: SlideEditorProps) {
  return (
    <div className="space-y-5">
      <TypeConfig slide={slide} />
      <SlideSettingsSection slide={slide} />
    </div>
  )
}

/** Dispatcher: mostra o formulário de configuração conforme o tipo do slide. */
function TypeConfig({ slide }: SlideEditorProps) {
  switch (slide.type) {
    case 'wordcloud':
      return <WordCloudConfig slide={slide} />
    case 'bar':
    case 'pie':
      return <ChoiceConfig slide={slide} />
    case 'quiz':
      return <QuizConfig slide={slide} />
    case 'answer':
      return <AnswerConfig slide={slide} />
    case 'text':
      return <TextConfig slide={slide} />
  }
}
