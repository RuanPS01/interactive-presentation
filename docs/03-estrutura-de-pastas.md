# 03 — Estrutura de pastas

## Raiz

| Arquivo | Papel |
| --- | --- |
| `index.html` | Casca da SPA (favicon inline, meta viewport, `#root`) |
| `vite.config.ts` | `base` para o GitHub Pages, plugins React/Tailwind, chunks manuais |
| `firestore.rules` | Regras de segurança do Firestore (publicar no console ou via CLI) |
| `.env.example` | Modelo das variáveis `VITE_FIREBASE_*` |
| `eslint.config.js`, `tsconfig*.json` | Lint e type-check |
| `.github/workflows/deploy.yml` | Build + publicação no GitHub Pages |
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
    JoinPage.tsx      Formulário do código da sala
    RoomPage.tsx      Tela do participante: pedido de nome, presença e controles

  components/
    layout/
      PageShell.tsx       Contêiner de página com largura máxima
      ThemeToggle.tsx     Botão claro/escuro
    editor/
      AddSlideMenu.tsx              Botões de "adicionar slide" (tipos criáveis)
      SlideList.tsx                 Lista ordenável; marca o gabarito como vinculado
      SlideEditor.tsx               Dispatcher por tipo + seção de opções do slide
      WordCloudConfig.tsx           Formulário da nuvem de palavras
      ChoiceConfig.tsx              Formulário de barras/pizza
      QuizConfig.tsx                Formulário das alternativas + gabarito + revelação
      AnswerConfig.tsx              Painel do slide de gabarito (só renomear)
      TextConfig.tsx                Formulário do slide de texto
      SlideSettingsSection.tsx      Sobrescritas deste slide (herdar/sim/não, fontes)
      PresentationSettingsButton.tsx Modal com as opções globais
      SettingsControls.tsx          Controles reutilizados pelos dois painéis acima
      AiPromptButton.tsx            Modal com o prompt de IA
      slideTypeIcons.ts             Ícone lucide de cada tipo de slide
    slides/
      SlideDisplay.tsx        Slide na tela do apresentador (título, corpo, rodapé)
      OptionsBoard.tsx        Quadro de alternativas (quiz e gabarito)
      NamedResponsesList.tsx  "Nome: resposta" quando a identificação está ligada
    participate/
      ParticipateView.tsx  Escolhe o controle conforme o tipo do slide
      ChoiceInput.tsx      Voto em barras/pizza/alternativas + limpar/travar
      WordCloudInput.tsx   Envio de textos + limpar tudo
      AnswerReveal.tsx     Gabarito na tela do participante ("você acertou!")
      NamePrompt.tsx       Pedido de nome antes de entrar
    present/
      ShareRoom.tsx     QR Code, código grande e link curto
      SummarySlide.tsx  Slide final: grade de miniaturas de todos os slides
    charts/
      BarChartView.tsx   Barras (Recharts) com rótulos quebrados em linhas
      PieChartView.tsx   Pizza (Recharts) com legenda
      WordCloudView.tsx  Nuvem de palavras (layout em espiral próprio, SVG)
      palette.ts         Paleta categórica compartilhada
    ui/
      Button.tsx, Card.tsx, Input.tsx   Primitivas visuais

  hooks/
    useRoom.ts          Assina o documento da sala
    useResponses.ts     Assina as respostas de um slide
    useMyResponse.ts    Assina só a própria resposta
    useParticipants.ts  Assina a lista de presentes na sala
    useParticipant.ts   Garante a sessão anônima e devolve o uid
    useApplyTheme.ts    Aplica a classe `.dark` no <html>
    useFullscreen.ts    Fullscreen API

  lib/
    firebase.ts           Inicialização (com config de reserva se faltar .env)
    rooms.ts              Criar/assinar/atualizar sala, token de apresentador
    responses.ts          Salvar/limpar/assinar respostas
    participants.ts       Presença na sala
    roomCode.ts           Código da sala e token do apresentador
    presenterSessions.ts  Salas apresentadas neste dispositivo (localStorage)
    participantName.ts    Nome do participante por sala (localStorage)
    shortUrl.ts           Encurtador do link de entrada

  store/
    editorStore.ts   Apresentação em edição (Zustand)
    themeStore.ts    Tema claro/escuro do usuário (Zustand + localStorage)

  utils/
    settings.ts      Padrões e resolução global -> slide
    slideFactory.ts  Ids, slides padrão e rótulos dos tipos
    slides.ts        Busca o `quiz` de um slide de gabarito
    aggregate.ts     Contagem de palavras/votos, respostas nomeadas
    validation.ts    Schemas Zod do JSON importado
    importExport.ts  Download/leitura do JSON da apresentação
    exportPdf.ts     Relatório em PDF (jsPDF, sob demanda)
    aiPrompt.ts      Texto do prompt de IA
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
