# 08 — Componentes e estado

## Estado da aplicação

Três lugares, com responsabilidades separadas:

| Onde | O quê | Vive até |
| --- | --- | --- |
| [`editorStore`](../src/store/editorStore.ts) (Zustand) | Apresentação em edição: título, slides, opções globais, imagens, fontes embutidas, seleção do slide e do elemento | Recarregar a página (o da edição de sala, até sair da tela) |
| [`themeStore`](../src/store/themeStore.ts) (Zustand + localStorage) | Tema claro/escuro do usuário | Sempre (por dispositivo) |
| Firestore | Sala publicada, respostas, presença | Até ser apagada |

Mais dois usos de `localStorage`, em `lib/`:
[`presenterSessions`](../src/lib/presenterSessions.ts) (salas apresentadas neste
dispositivo, com o token) e
[`participantName`](../src/lib/participantName.ts) (nome por sala).
O [encurtador](../src/lib/shortUrl.ts) também guarda ali o link curto de cada
URL, para não gerar um novo a cada abertura do QR.

### `editorStore` em detalhe

Não é um estado único: `createEditorStore()` cria um editor independente, e os
componentes de `components/editor/` usam o que estiver no
`EditorStoreContext`.

| Tela | Editor |
| --- | --- |
| `CreatePage` | O padrão do contexto, criado uma vez e mantido enquanto a aba estiver aberta |
| `EditRoomPage` | Um editor próprio, criado ao abrir a tela e carregado com a sala |

Assim, editar uma sala em andamento não sobrescreve o rascunho de quem estava
montando outra apresentação. `useEditorStore(seletor)` tem a mesma assinatura
de antes; quem precisa ler fora da renderização usa `store.getState()` do
editor que criou.

```ts
{
  title, slides, settings, selectedIndex,
  assets,                                   // imagens dos slides livres, pelo id
  fonts,                                    // fontes embutidas, pelo id
  selectedElementId, editingElementId,      // slide livre: selecionado e em edição
  textSelection,                            // trecho selecionado no texto em edição
  setTitle, updateSettings, setOverride,
  addSlide, updateSlide, removeSlide, moveSlide, select,
  addAssets, selectElement, setEditingElement, setTextSelection,
  updateElement, setElements, appendSlides,
  loadPresentation, getPresentation, reset,
}
```

Detalhes do slide livre no estado:

- **`textSelection`** guarda a última seleção feita dentro do texto em edição,
  em deslocamentos no texto corrido. Os botões do painel usam essa seleção,
  porque clicar neles tira o foco do texto.
- **Trocar de slide** limpa a seleção de elemento e de texto.
- **`updateSettings`** com um `slideAspect` novo reenquadra os slides livres
  que estavam na moldura antiga (ver [06](06-configuracoes.md#formato-dos-slides)).
- **`getPresentation`** devolve só as imagens e as fontes ainda usadas por
  algum slide (`pickAssets` e `pickFonts`); sem nenhuma, os campos `assets` e
  `fonts` nem aparecem.
- **`appendSlides`** é o "Adicionar ao fim" da importação de PowerPoint: junta
  slides, imagens e fontes e seleciona o primeiro slide novo.
- As **fontes** do editor são registradas no navegador pelo `EditorWorkspace`
  sempre que mudam (`registerFonts`), então o texto da prévia já sai com elas.

`useEditorStoreApi()` devolve o próprio editor do contexto, para ações que
leem o estado na hora (a importação, os atalhos do slide livre) sem assinar
mudanças.

Dois auxiliares internos sustentam o resto:

- **`syncAnswerSlides(slides)`** — reposiciona/cria/remove os slides de gabarito
  conforme o `revealAnswer` de cada `quiz` (ver [05](05-tipos-de-slide.md)).
- **`applySlides(slides, keepId, fallbackIndex)`** — aplica o sync e recalcula a
  seleção **pelo id** do slide, para que inserções e remoções automáticas não
  desloquem o que estava selecionado.

`setOverride(id, chave, valor)` grava em `slide.overrides`; passar `undefined`
remove a chave, e quando não sobra nenhuma o campo inteiro é apagado (a chave
some do objeto, em vez de ficar `undefined`, que o Firestore recusa ao gravar a
sala). O slide volta a herdar tudo.

## Páginas

| Página | Responsabilidade |
| --- | --- |
| [`HomePage`](../src/pages/HomePage.tsx) | Dois caminhos (criar/entrar) e a lista de salas apresentadas neste dispositivo, com “Retomar” e “Exportar PDF” |
| [`CreatePage`](../src/pages/CreatePage.tsx) | Editor de 3 colunas, barra de ações e criação da sala |
| [`PresentPage`](../src/pages/PresentPage.tsx) | Controle de acesso, navegação, exibição do slide, QR, PDF, slide final e o botão **Editar** |
| [`EditRoomPage`](../src/pages/EditRoomPage.tsx) | Editor da sala em andamento: carrega o que está no ar, detecta alterações, confirma e grava recomeçando do 1º slide |
| [`JoinPage`](../src/pages/JoinPage.tsx) | Normaliza o código digitado e redireciona |
| [`RoomPage`](../src/pages/RoomPage.tsx) | Pedido de nome, registro de presença e controles do slide atual |

### Layout do editor (`EditorWorkspace`)

As três colunas ficam em
[`EditorWorkspace`](../src/components/editor/EditorWorkspace.tsx), usado pela
criação e pela edição de sala. Em telas `lg` ou maiores, a página ocupa
**exatamente a altura da janela** (`lg:h-[100dvh] lg:overflow-hidden`) e o grid
das três colunas recebe `lg:flex-1 lg:min-h-0`. Cada coluna tem uma
`ScrollArea` interna, limitada com `lg:min-h-0 lg:flex-1`:

| Coluna | Fixo | Rolagem própria |
| --- | --- | --- |
| 1 | Card “Adicionar slide” | Lista de slides |
| 2 | Título “Configuração” | Formulário do slide + opções do slide |
| 3 | Título “Prévia”, formato (16:9 ou 4:3) e, no slide livre, "Ampliar" | Prévia do slide |

As colunas são `260px`, `0.9fr` e `1.35fr`: a prévia fica com a maior parte da
largura, e a página usa a tela inteira (`w-full`, sem largura máxima). A prévia
desenha o slide numa moldura do tamanho do formato e a escala para caber
([`ScaledFrame`](../src/components/slides/ScaledFrame.tsx)); num slide livre,
a prévia é a área de trabalho editável
([`FreeSlideCanvas`](../src/components/free/FreeSlideCanvas.tsx)), e "Ampliar"
abre a mesma área num painel da tela inteira (Esc fecha).

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
  `slides` para que um slide `answer` encontre seu `quiz`, e `assets` para as
  imagens. O slide livre não usa essa moldura: vira só o `FreeSlideView`.
- **[`ScaledFrame`](../src/components/slides/ScaledFrame.tsx)**: desenha um
  conteúdo de tamanho fixo (a moldura do slide) escalado com `transform` para
  caber no espaço disponível, centralizado. Acompanha o tamanho com
  `ResizeObserver`; o filho pode ser uma função que recebe a escala (o editor
  do slide livre precisa dela para converter o mouse em px do slide).
- **[`OptionsBoard`](../src/components/slides/OptionsBoard.tsx)** — alternativas
  em cartões grandes com letras A, B, C…; em modo `reveal` pinta a correta de
  verde e mostra votos e porcentagem. Passa a duas colunas com mais de 4 opções.
- **[`NamedResponsesList`](../src/components/slides/NamedResponsesList.tsx)** —
  chips “Nome: resposta”, com rolagem própria e altura limitada.
- **[`SlideCountdown`](../src/components/slides/SlideCountdown.tsx)** — card na
  base do slide com o tempo restante: segundos grandes, milissegundos ao lado,
  vermelho nos últimos 5 segundos. Anima-se sozinho por `requestAnimationFrame`.
  **Só no projetor** — ver [07](07-tempo-real-e-comunicacao.md#cronômetro).
- **[`AnswerSuspense`](../src/components/slides/AnswerSuspense.tsx)** —
  “A resposta certa é…”, com um ponto a mais por segundo, no lugar do gabarito
  durante os 3 segundos de espera. Também usado pelo `ParticipateView`.

### `free/`: slide livre

- **[`FreeSlideView`](../src/components/free/FreeSlideView.tsx)**: exibição
  (projetor, celular, miniatura do resumo). `FreeSlideStage` desenha a moldura
  e os elementos; `FreeSlideView` a coloca num `ScaledFrame`.
- **[`FreeElementContent`](../src/components/free/FreeElementContent.tsx)**:
  conteúdo de um elemento. O texto vira parágrafos e trechos em HTML (com os
  marcadores desenhados por CSS); a imagem respeita o encaixe e os cantos, e
  mostra um espaço reservado enquanto não chega.
- **[`layout.ts`](../src/components/free/layout.ts)**: posição, tamanho,
  rotação e opacidade de cada elemento, e o CSS da caixa de texto, iguais na
  exibição e na edição.
- **[`FreeSlideCanvas`](../src/components/free/FreeSlideCanvas.tsx)**: área de
  trabalho do editor. Arrastar com guias de encaixe, 8 alças de
  redimensionamento que respeitam a rotação, atalhos de teclado, soltar e colar
  imagens (ver [05](05-tipos-de-slide.md#edição)).
- **[`FreeTextEditable`](../src/components/free/FreeTextEditable.tsx)**: a
  caixa de texto em edição, com `contentEditable`. A cada digitação o HTML é
  lido de volta para o modelo (`htmlToParagraphs`) e a seleção é guardada em
  deslocamentos (`getSelectionOffsets`), que sobrevivem à nova renderização. A
  colagem entra só como texto, para não trazer estilos de outras páginas.

A lógica do texto rico fica fora dos componentes, em `utils/`:
[`richText.ts`](../src/utils/richText.ts) (aplicar estilo num intervalo,
partindo e juntando trechos; ler o valor de um intervalo, ou "misto"),
[`richTextDom.ts`](../src/utils/richTextDom.ts) (modelo para HTML e de volta)
e [`freeTextFormat.ts`](../src/utils/freeTextFormat.ts) (formatar a seleção ou
a caixa inteira). As ações que mexem em elementos (adicionar texto e imagens,
trocar imagem, duplicar, excluir, reordenar) ficam em
[`useFreeSlideActions`](../src/hooks/useFreeSlideActions.ts), usadas tanto
pela área de trabalho quanto pelo painel.

### `participate/` — tela do participante

- **[`ParticipateView`](../src/components/participate/ParticipateView.tsx)** —
  escolhe o controle pelo tipo do slide e resolve o alvo da resposta (no
  gabarito, a resposta dada na pergunta). No slide livre, mostra o slide
  inteiro numa caixa com a proporção dele.
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
`AnswerConfig`, `TextConfig`, `FreeSlideConfig`), a lista (`SlideList`), o
menu de adição (`AddSlideMenu`), os dois painéis de opções
(`PresentationSettingsButton` e `SlideSettingsSection`, ambos usando os
controles de `SettingsControls`), o modal do prompt de IA (`AiPromptButton`), o
editor em 3 colunas (`EditorWorkspace`) e os botões "Importar" e "Exportar"
(`ImportExportButtons`), que abrem os modais de importar e de exportar
(`ExportDialog`).

`FreeSlideConfig` é o painel do slide livre: nome, cor de fundo, botões de
adicionar texto e imagem, lista de camadas e, para o elemento selecionado,
posição e tamanho, rotação, opacidade, ordem, duplicar e excluir, mais o painel
de texto ou de imagem (ver [05](05-tipos-de-slide.md#edição)). A lista de
fontes do painel de texto começa pelas fontes embutidas da apresentação.

`ExportDialog` oferece "Apresentação (.json)", que baixa na hora, e
"PowerPoint (.pptx)", que carrega o gerador só nessa hora (`import()`
dinâmico), passa o tema atual da página (claro ou escuro) para os slides
comuns, mostra "Gerando…" e, no fim, os avisos (perguntas viraram slides
estáticos, fonte que não pôde ser embutida).

`ImportExportButtons` abre o modal "Importar" com duas opções: "Apresentação
(.json)", que substitui tudo, e "PowerPoint (.pptx)", com a escolha entre
"Adicionar ao fim" e "Substituir tudo". As duas aceitam o arquivo arrastado. O
leitor de PowerPoint é carregado só nessa hora (`import()` dinâmico), e o modal
mostra o progresso, o resultado (slides, imagens, avisos) ou o erro.

`SettingsControls` monta as linhas de opção sobre os componentes de `ui/`:
`FontSizeRow` e `OverrideFontRow` usam o `Slider`, `OverrideToggleRow` usa o
`Select` (herdar, sim, não) e os demais combinam `Checkbox` e campo numérico.

### `present/`

- **[`ShareRoom`](../src/components/present/ShareRoom.tsx)** — miniatura do QR
  na barra; o modal traz o QR ampliado, o **link curto em texto grande**, o
  código da sala e o link completo com botão de copiar.
- **[`SummarySlide`](../src/components/present/SummarySlide.tsx)** — slide final
  com o botão central **Baixar resultados (PDF)** e a miniatura de cada slide
  (gráficos, nuvem, lista de alternativas com o gabarito ou o próprio slide
  livre reduzido).
- **[`PresenterAccessDenied`](../src/components/present/PresenterAccessDenied.tsx)**:
  tela de quem abre `/present` ou `/edit` sem o token, com atalho para entrar
  como participante.

### `charts/`

`BarChartView` e `PieChartView` (Recharts) aceitam `labelFontSize` e escalam
eixos, legendas e contadores a partir dele. `WordCloudView` implementa o layout
em espiral. `palette.ts` centraliza as 10 cores categóricas, usadas também no
PDF.

### `ui/`: componentes genéricos

Todo controle de formulário da aplicação sai daqui, para manter a mesma
identidade visual (azul de destaque, cinzas neutros, cantos arredondados, anel
de foco azul translúcido) nos temas claro e escuro.

| Componente | Uso | Destaques |
| --- | --- | --- |
| [`Button`](../src/components/ui/Button.tsx) | Ações | 4 variantes x 3 tamanhos; aceita `ref` |
| [`Card`](../src/components/ui/Card.tsx) | Painéis | Borda, fundo e sombra do tema |
| [`Input`, `Textarea`, `Field`](../src/components/ui/Input.tsx) | Texto | Visual comum em [`fieldStyles.ts`](../src/components/ui/fieldStyles.ts), inclusive o estado desativado |
| [`Checkbox`, `Radio`](../src/components/ui/Checkbox.tsx) | Marcar opções | Rótulo e dica opcionais; tom `success` (verde) para a alternativa correta; o `<input>` nativo continua no DOM para teclado e leitor de tela |
| [`ChoiceMark`](../src/components/ui/Checkbox.tsx) | Só o desenho da marcação | Reaproveitado nos botões de voto do participante (`ChoiceInput`) |
| [`Slider`](../src/components/ui/Slider.tsx) | Valores numéricos em faixa | Rótulo à esquerda e valor à direita; trecho percorrido preenchido |
| [`Select`](../src/components/ui/Select.tsx) | Lista suspensa | Padrão "select-only combobox" do WAI-ARIA; lista em portal, que abre para cima quando falta espaço |
| [`ScrollArea`](../src/components/ui/ScrollArea.tsx) | Áreas com rolagem própria | Barra fina nas cores neutras; eixo `y`, `x` ou `both` |
| [`Modal`](../src/components/ui/Modal.tsx) | Janelas modais | Esc e clique fora fecham; Tab preso no painel; foco volta para quem abriu |
| [`ConfirmDialog`](../src/components/ui/ConfirmDialog.tsx) | Confirmar ações | Sobre o `Modal`; foco inicial no botão de confirmar; tom `danger` |
| [`Banner`](../src/components/ui/Banner.tsx) | Avisos no topo da tela | Tons `info`, `warning` e `error`; fechar opcional |
| [`ColorInput`](../src/components/ui/ColorInput.tsx) | Escolher cor | Amostra que abre o seletor do sistema, campo hexadecimal e cores rápidas; estado "misto" e opção "nenhuma" (`allowNone`) |
| [`SegmentedControl`](../src/components/ui/SegmentedControl.tsx) | Escolha entre poucas opções lado a lado | `radiogroup` de botões com texto ou ícone; tamanhos `sm` e `md`; não tira o foco do texto em edição |
| [`ToggleButton`](../src/components/ui/ToggleButton.tsx) | Ligar e desligar (negrito, itálico...) | `aria-pressed`; estado "misto" quando a seleção tem as duas coisas |

Como o `Select` se comporta no teclado:

| Tecla | Lista fechada | Lista aberta |
| --- | --- | --- |
| Setas, Enter, Espaço | Abre na opção escolhida | Setas percorrem; Enter/Espaço escolhem |
| Home, End | Abre na primeira/última | Vai para a primeira/última |
| Letras | Abre na opção que começa com elas (sem diferenciar acentos) | Pula para a opção |
| Esc | Segue para a tela (num modal, fecha o modal) | Fecha só a lista |
| Tab | Segue o foco | Fecha a lista e segue o foco |

Partes que classes utilitárias não alcançam (trilho e polegar do `Slider`,
barra do `ScrollArea`, animação da lista do `Select`) ficam no
[`index.css`](../src/index.css), nas classes `.ui-slider`, `.ui-scroll` e
`.ui-popover`, usando as variáveis de cor do tema do Tailwind
(`--color-blue-600`, `--color-neutral-300`...).

> Antes de criar um controle novo numa tela, procure aqui. Um `<select>`,
> `<input type="checkbox">` ou `<input type="range">` nativo destoa no tema
> escuro: a lista aberta do `<select>`, por exemplo, é desenhada pelo sistema
> operacional e ignora as cores da aplicação.

### `layout/`

`PageShell` (contêiner de página), `ThemeToggle` (claro/escuro) e
`FullScreenMessage` (mensagem centralizada: carregando, erro, sem acesso).

## Hooks

| Hook | O que faz |
| --- | --- |
| `useRoom`, `useResponses`, `useMyResponse`, `useParticipants` | Assinaturas do Firestore ([07](07-tempo-real-e-comunicacao.md)) |
| `useParticipant` | Sessão anônima e uid |
| `usePresenterAccess` | Se este navegador controla a sala: dono atual ou token na URL (reivindica o controle); lembra a sala para "Retomar" |
| `useSlideTimer` | Cronômetro do slide: contagem local para exibir e `closed` (estado da sala) para travar as respostas |
| `useRevealCountdown` | Os 3 segundos de suspense antes de revelar o gabarito — pulados num gabarito já revelado |
| `useApplyTheme` | Alterna a classe `.dark` no `<html>` |
| `useFullscreen` | Fullscreen API, acompanhando a saída por Esc |
| `useRoomAssets` | Imagens de uma sala para os ids pedidos, lidas uma vez e guardadas ([07](07-tempo-real-e-comunicacao.md#imagens-dos-slides-livres)) |
| `useRoomFonts` | Fontes embutidas da sala registradas neste navegador, relidas a cada edição ([07](07-tempo-real-e-comunicacao.md#fontes-embutidas)) |
| `useFreeSlideActions` | Ações do slide livre: adicionar texto e imagens (comprimidas antes), trocar imagem, duplicar, excluir, reordenar |

## Estilo e tema

Tailwind v4 com `@custom-variant dark (&:where(.dark, .dark *))`: o tema é
controlado pela classe no `<html>`, não pelo `prefers-color-scheme` — assim a
escolha do usuário vence a do sistema. O `color-scheme` do `<html>` acompanha a
classe, para os controles que continuam nativos (setas do campo numérico, barra
de rolagem da página) também seguirem o tema escolhido. O
[`index.css`](../src/index.css) também traz as animações da nuvem de palavras,
os ajustes de cor dos textos e tooltips do Recharts nos dois temas, as partes
dos componentes genéricos descritas acima e as regras do texto do slide livre
(`.ft-text`: quebras preservadas e marcadores desenhados por `::before`).
