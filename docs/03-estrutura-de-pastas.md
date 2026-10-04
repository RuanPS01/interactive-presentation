# 03 — Estrutura de pastas

## Raiz

| Arquivo | Papel |
| --- | --- |
| `index.html` | Casca da SPA (favicon inline, meta viewport, `#root`) |
| `vite.config.ts` | `base` para o GitHub Pages, plugins React/Tailwind, chunks manuais |
| `firestore.rules` | Regras de segurança do Firestore (publicadas pela pipeline quando mudam) |
| `firebase.json` | Diz à CLI do Firebase onde está o arquivo de regras |
| `.env.example` | Modelo das variáveis `VITE_FIREBASE_*` |
| `eslint.config.js`, `tsconfig*.json` | Lint e type-check |
| `.github/workflows/deploy.yml` | Build, publicação das regras do Firestore e deploy no GitHub Pages |
| `docs/` | Esta documentação |

## `src/`

```
src/
  main.tsx            Entrada: StrictMode + HashRouter + index.css
  App.tsx             Rotas e aplicação do tema
  index.css           Tailwind, variante `dark`, animações da nuvem, estilos dos gráficos
  vite-env.d.ts       Tipos do ambiente Vite

  types/
    presentation.ts   TODO o domínio: slides, configurações, sala, resposta, presença

  pages/
    HomePage.tsx      Entrada, sessões salvas neste dispositivo (retomar/reexportar)
    CreatePage.tsx    Editor em 3 colunas com rolagem independente
    PresentPage.tsx   Tela do apresentador (projetor): slide, navegação, QR, PDF
    EditRoomPage.tsx  Edição de uma sala já iniciada; salvar recomeça do 1º slide
    JoinPage.tsx      Formulário do código da sala
    RoomPage.tsx      Tela do participante: pedido de nome, presença e controles

  components/
    layout/
      PageShell.tsx         Contêiner de página com largura máxima
      FullScreenMessage.tsx Mensagem centralizada (carregando, erro, sem acesso)
      ThemeToggle.tsx       Botão claro/escuro
    editor/
      EditorWorkspace.tsx           Editor em 3 colunas (criação e edição de sala)
      ImportExportButtons.tsx       "Importar" (modal: JSON ou PowerPoint) e "Exportar JSON"
      AddSlideMenu.tsx              Botões de "adicionar slide" (tipos criáveis)
      SlideList.tsx                 Lista ordenável; marca o gabarito como vinculado
      SlideEditor.tsx               Dispatcher por tipo + seção de opções do slide
      WordCloudConfig.tsx           Formulário da nuvem de palavras
      ChoiceConfig.tsx              Formulário de barras/pizza
      QuizConfig.tsx                Formulário das alternativas + gabarito + revelação
      AnswerConfig.tsx              Painel do slide de gabarito (só renomear)
      TextConfig.tsx                Formulário do slide de texto
      FreeSlideConfig.tsx           Painel do slide livre: fundo, camadas, elemento, texto e imagem
      SlideSettingsSection.tsx      Sobrescritas deste slide (herdar/sim/não, fontes)
      PresentationSettingsButton.tsx Modal com as opções globais
      SettingsControls.tsx          Controles reutilizados pelos dois painéis acima
      AiPromptButton.tsx            Modal com o prompt de IA
      slideTypeIcons.ts             Ícone lucide de cada tipo de slide
    slides/
      SlideDisplay.tsx        Slide na tela do apresentador (título, corpo, rodapé)
      ScaledFrame.tsx         Desenha um conteúdo de tamanho fixo escalado para caber
      OptionsBoard.tsx        Quadro de alternativas (quiz e gabarito)
      NamedResponsesList.tsx  "Nome: resposta" quando a identificação está ligada
      SlideCountdown.tsx      Contagem regressiva grande ("20s"), vermelha no fim
      AnswerSuspense.tsx      "A resposta certa é…" antes de revelar o gabarito
    free/                  Slide livre (exibição e edição)
      layout.ts              Estilos de posição, rotação e caixa de cada elemento
      FreeElementContent.tsx Conteúdo de um texto ou de uma imagem
      FreeSlideView.tsx      Slide livre só para exibição (projetor, celular, miniatura)
      FreeTextEditable.tsx   Caixa de texto em edição (contentEditable)
      FreeSlideCanvas.tsx    Prévia editável: arrastar, alças, guias, teclado, soltar imagens
    participate/
      ParticipateView.tsx  Escolhe o controle conforme o tipo do slide
      ChoiceInput.tsx      Voto em barras/pizza/alternativas + limpar/travar
      WordCloudInput.tsx   Envio de textos + limpar tudo
      AnswerReveal.tsx     Gabarito na tela do participante ("você acertou!")
      NamePrompt.tsx       Pedido de nome antes de entrar
    present/
      ShareRoom.tsx              QR Code, código grande e link curto
      SummarySlide.tsx           Slide final: grade de miniaturas de todos os slides
      PresenterAccessDenied.tsx  Aviso para quem abre /present ou /edit sem o token
    charts/
      BarChartView.tsx   Barras (Recharts) com rótulos quebrados em linhas
      PieChartView.tsx   Pizza (Recharts) com legenda
      WordCloudView.tsx  Nuvem de palavras (layout em espiral próprio, SVG)
      palette.ts         Paleta categórica compartilhada
    ui/                Componentes genéricos, com a identidade visual da aplicação
      Button.tsx         Botão (4 variantes x 3 tamanhos)
      Card.tsx           Painel com borda e sombra
      Input.tsx          Input, Textarea e Field (rótulo + controle + dica)
      fieldStyles.ts     Visual compartilhado dos campos (borda, foco, desativado)
      Checkbox.tsx       Checkbox, Radio e ChoiceMark (o desenho da marcação)
      Slider.tsx         Controle deslizante com trecho preenchido
      Select.tsx         Lista suspensa acessível (substitui o <select> nativo)
      ScrollArea.tsx     Área com rolagem própria e barra fina
      Modal.tsx          Janela modal (Esc, foco preso, rolagem do corpo)
      ConfirmDialog.tsx  Pergunta de confirmação sobre o Modal
      Banner.tsx         Faixa de aviso: informação, alerta ou erro
      ColorInput.tsx     Seletor de cor: amostra, campo hexadecimal e cores rápidas
      SegmentedControl.tsx Grupo de opções lado a lado (radiogroup)
      ToggleButton.tsx   Botão que liga e desliga (negrito, itálico...)

  hooks/
    useRoom.ts             Assina o documento da sala
    useResponses.ts        Assina as respostas de um slide
    useMyResponse.ts       Assina só a própria resposta
    useParticipants.ts     Assina a lista de presentes na sala
    useParticipant.ts      Garante a sessão anônima e devolve o uid
    usePresenterAccess.ts  Decide se este navegador controla a sala (uid ou token)
    useSlideTimer.ts       Contagem regressiva do slide, lida da sala
    useRevealCountdown.ts  Suspense de 3 s antes de revelar o gabarito
    useApplyTheme.ts       Aplica a classe `.dark` no <html>
    useFullscreen.ts       Fullscreen API
    useRoomAssets.ts       Busca as imagens que os slides livres de uma sala usam
    useFreeSlideActions.ts Ações do slide livre (adicionar texto e imagem, excluir...)

  lib/
    firebase.ts           Inicialização (com config de reserva se faltar .env)
    rooms.ts              Criar/assinar/atualizar sala, token de apresentador
    responses.ts          Salvar/limpar/assinar respostas
    participants.ts       Presença na sala
    roomCode.ts           Código da sala e token do apresentador
    presenterSessions.ts  Salas apresentadas neste dispositivo (localStorage)
    participantName.ts    Nome do participante por sala (localStorage)
    shortUrl.ts           Encurtador do link de entrada
    assets.ts             Imagens da sala (subcoleção `assets`): ler, enviar, apagar

  store/
    editorStore.ts   Apresentação em edição (Zustand), um editor por contexto
    themeStore.ts    Tema claro/escuro do usuário (Zustand + localStorage)

  utils/
    settings.ts      Padrões e resolução global -> slide
    timer.ts         Duração do cronômetro por slide e atraso da revelação
    slideFactory.ts  Ids, slides padrão e rótulos dos tipos
    slides.ts        Busca o `quiz` de um slide de gabarito
    aggregate.ts     Contagem de palavras/votos, respostas nomeadas
    validation.ts    Schemas Zod do JSON importado
    importExport.ts  Download/leitura do JSON da apresentação
    exportPdf.ts     Relatório em PDF (jsPDF, sob demanda)
    aiPrompt.ts      Texto do prompt de IA
    freeSlide.ts     Criar, duplicar, reordenar e reenquadrar elementos do slide livre
    richText.ts      Modelo do texto rico: estilos por trecho e por parágrafo
    richTextDom.ts   Texto rico para HTML e de volta; seleção em deslocamentos
    freeTextFormat.ts Formatação da seleção ou da caixa inteira
    images.ts        Comprime imagens para data URL (tamanho e formato)
    canvasText.ts    Desenha texto rico num canvas (PDF, tabelas, SmartArt)
    freeSlideRaster.ts Desenha um slide livre inteiro numa imagem (PDF)
    pptx/            Leitor de PowerPoint, carregado só quando usado
      index.ts       importPptx: slides, imagens, formato e avisos
      package.ts     Abre o .pptx (zip) e resolve as relações entre as partes
      xml.ts         Atalhos de leitura de XML por nome local
      colors.ts      Cores do tema, mapa de cores e modificadores
      geometry.ts    Formas pré-definidas e personalizadas em Path2D
      draw.ts        Preenchimento, contorno, sombra e desenho das formas
      text.ts        Texto com herança de estilos (slide, layout, mestre, tema)
      table.ts       Tabelas desenhadas em canvas
      chart.ts       Gráficos desenhados a partir dos dados salvos no arquivo
```

## Convenções

- **Um assunto por arquivo.** Componentes exportam apenas componentes (o ESLint
  avisa quando um arquivo mistura componentes e utilitários — por isso
  `findQuizSlide` vive em `utils/slides.ts`, e não junto do `SlideDisplay`).
- **Comentários em português**, explicando o *porquê* de decisões não óbvias
  (limites do Firestore, CORS do encurtador, cálculo de layout da nuvem).
- **Nada de `undefined` indo para o Firestore**: campos opcionais são omitidos
  com spread condicional (ver `saveResponse` e `joinRoom`).
- **Português do Brasil** em toda a interface.
