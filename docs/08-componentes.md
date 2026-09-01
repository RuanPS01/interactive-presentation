# 08 — Componentes e estado

## Estado da aplicação

Três lugares, com responsabilidades separadas:

| Onde | O quê | Vive até |
| --- | --- | --- |
| [`editorStore`](../src/store/editorStore.ts) (Zustand) | Apresentação em edição: título, slides, opções globais, seleção | Recarregar a página |
| [`themeStore`](../src/store/themeStore.ts) (Zustand + localStorage) | Tema claro/escuro do usuário | Sempre (por dispositivo) |
| Firestore | Sala publicada, respostas, presença | Até ser apagada |

Mais dois usos de `localStorage`, em `lib/`:
[`presenterSessions`](../src/lib/presenterSessions.ts) (salas apresentadas neste
dispositivo, com o token) e
[`participantName`](../src/lib/participantName.ts) (nome por sala).
O [encurtador](../src/lib/shortUrl.ts) também guarda ali o link curto de cada
URL, para não gerar um novo a cada abertura do QR.

### `editorStore` em detalhe

```ts
{
  title, slides, settings, selectedIndex,
  setTitle, updateSettings, setOverride,
  addSlide, updateSlide, removeSlide, moveSlide, select,
  loadPresentation, getPresentation, reset,
}
```

Dois auxiliares internos sustentam o resto:

- **`syncAnswerSlides(slides)`** — reposiciona/cria/remove os slides de gabarito
  conforme o `revealAnswer` de cada `quiz` (ver [05](05-tipos-de-slide.md)).
- **`applySlides(slides, keepId, fallbackIndex)`** — aplica o sync e recalcula a
  seleção **pelo id** do slide, para que inserções e remoções automáticas não
  desloquem o que estava selecionado.

`setOverride(id, chave, valor)` grava em `slide.overrides`; passar `undefined`
remove a chave, e quando não sobra nenhuma o campo inteiro é apagado — o slide
volta a herdar tudo.

## Páginas

| Página | Responsabilidade |
| --- | --- |
| [`HomePage`](../src/pages/HomePage.tsx) | Dois caminhos (criar/entrar) e a lista de salas apresentadas neste dispositivo, com “Retomar” e “Exportar PDF” |
| [`CreatePage`](../src/pages/CreatePage.tsx) | Editor de 3 colunas, barra de ações e criação da sala |
| [`PresentPage`](../src/pages/PresentPage.tsx) | Controle de acesso, navegação, exibição do slide, QR, PDF e slide final |
| [`JoinPage`](../src/pages/JoinPage.tsx) | Normaliza o código digitado e redireciona |
| [`RoomPage`](../src/pages/RoomPage.tsx) | Pedido de nome, registro de presença e controles do slide atual |

### Layout do editor (`CreatePage`)

Em telas `lg` ou maiores, o editor ocupa **exatamente a altura da janela**
(`lg:h-[100dvh] lg:overflow-hidden`) e o grid das três colunas recebe
`lg:flex-1 lg:min-h-0`. Cada coluna tem um contêiner interno com
`lg:overflow-y-auto`:

| Coluna | Fixo | Rolagem própria |
| --- | --- | --- |
| 1 | Card “Adicionar slide” | Lista de slides |
| 2 | Título “Configuração” | Formulário do slide + opções do slide |
| 3 | Título “Prévia” | Prévia do slide |

Assim a página **não cresce** conforme slides são adicionados: cada área rola
por conta própria. Abaixo de `lg` o layout volta ao empilhamento natural, que é
o comportamento certo no celular.

> A combinação `min-h-0` + `flex-1` é o que faz a rolagem funcionar dentro de
> um flex/grid: sem `min-h-0`, o item usa `min-height: auto` e estica o pai em
> vez de rolar.

## Componentes por pasta

### `slides/` — tela do apresentador

- **[`SlideDisplay`](../src/components/slides/SlideDisplay.tsx)** — moldura de
  todo slide: título (com o tamanho configurado), corpo conforme o tipo, lista
  de respostas identificadas (quando ligada) e rodapé de contagem. Recebe
  `slides` para que um slide `answer` encontre seu `quiz`.
- **[`OptionsBoard`](../src/components/slides/OptionsBoard.tsx)** — alternativas
  em cartões grandes com letras A, B, C…; em modo `reveal` pinta a correta de
  verde e mostra votos e porcentagem. Passa a duas colunas com mais de 4 opções.
- **[`NamedResponsesList`](../src/components/slides/NamedResponsesList.tsx)** —
  chips “Nome: resposta”, com rolagem própria e altura limitada.
- **[`SlideCountdown`](../src/components/slides/SlideCountdown.tsx)** — o tempo
  restante em número grande com o sufixo `s`, vermelho nos últimos 5 segundos.
  Usado no projetor e, menor, na tela do participante.
- **[`AnswerSuspense`](../src/components/slides/AnswerSuspense.tsx)** —
  “A resposta certa é…”, com um ponto a mais por segundo, no lugar do gabarito
  durante os 3 segundos de espera. Também usado pelo `ParticipateView`.

### `participate/` — tela do participante

- **[`ParticipateView`](../src/components/participate/ParticipateView.tsx)** —
  escolhe o controle pelo tipo do slide e resolve o alvo da resposta (no
  gabarito, a resposta dada na pergunta).
- **[`ChoiceInput`](../src/components/participate/ChoiceInput.tsx)** — voto em
  `bar`/`pie`/`quiz`; “Limpar resposta” quando a troca é permitida, cadeado
  quando não.
- **[`WordCloudInput`](../src/components/participate/WordCloudInput.tsx)** —
  envio de textos (até 80 caracteres), bloqueio de repetição, remoção
  individual e “Limpar tudo”.
- **[`AnswerReveal`](../src/components/participate/AnswerReveal.tsx)** —
  “Você acertou!” / “Não foi dessa vez”, gabarito e marcação da própria escolha.
- **[`NamePrompt`](../src/components/participate/NamePrompt.tsx)** — pedido de
  nome antes de entrar.

### `editor/`

Formulários por tipo (`WordCloudConfig`, `ChoiceConfig`, `QuizConfig`,
`AnswerConfig`, `TextConfig`), a lista (`SlideList`), o menu de adição
(`AddSlideMenu`), os dois painéis de opções (`PresentationSettingsButton` e
`SlideSettingsSection`, ambos usando os controles de `SettingsControls`) e o
modal do prompt de IA (`AiPromptButton`).

### `present/`

- **[`ShareRoom`](../src/components/present/ShareRoom.tsx)** — miniatura do QR
  na barra; o modal traz o QR ampliado, o **link curto em texto grande**, o
  código da sala e o link completo com botão de copiar.
- **[`SummarySlide`](../src/components/present/SummarySlide.tsx)** — slide final
  com miniatura de cada slide (gráficos, nuvem ou lista de alternativas com o
  gabarito).

### `charts/`

`BarChartView` e `PieChartView` (Recharts) aceitam `labelFontSize` e escalam
eixos, legendas e contadores a partir dele. `WordCloudView` implementa o layout
em espiral. `palette.ts` centraliza as 10 cores categóricas, usadas também no
PDF.

### `ui/` e `layout/`

`Button` (4 variantes × 3 tamanhos), `Card`, `Input`/`Textarea`/`Field`,
`PageShell` e `ThemeToggle`.

## Hooks

| Hook | O que faz |
| --- | --- |
| `useRoom`, `useResponses`, `useMyResponse`, `useParticipants` | Assinaturas do Firestore ([07](07-tempo-real-e-comunicacao.md)) |
| `useParticipant` | Sessão anônima e uid |
| `useSlideTimer` | Contagem regressiva do slide a partir dos `timers` da sala (correndo, pausado ou congelado) |
| `useRevealCountdown` | Os 3 segundos de suspense antes de revelar o gabarito — pulados num gabarito já revelado |
| `useApplyTheme` | Alterna a classe `.dark` no `<html>` |
| `useFullscreen` | Fullscreen API, acompanhando a saída por Esc |

## Estilo e tema

Tailwind v4 com `@custom-variant dark (&:where(.dark, .dark *))`: o tema é
controlado pela classe no `<html>`, não pelo `prefers-color-scheme` — assim a
escolha do usuário vence a do sistema. O
[`index.css`](../src/index.css) também traz as animações da nuvem de palavras e
os ajustes de cor dos textos e tooltips do Recharts nos dois temas.
