import type { Slide } from '../../types/presentation'
import { WordCloudConfig } from './WordCloudConfig'
import { ChoiceConfig } from './ChoiceConfig'
import { TextConfig } from './TextConfig'

interface SlideEditorProps {
  slide: Slide
}

/** Dispatcher: mostra o formulário de configuração conforme o tipo do slide. */
export function SlideEditor({ slide }: SlideEditorProps) {
  switch (slide.type) {
    case 'wordcloud':
      return <WordCloudConfig slide={slide} />
    case 'bar':
    case 'pie':
      return <ChoiceConfig slide={slide} />
    case 'text':
      return <TextConfig slide={slide} />
  }
}
