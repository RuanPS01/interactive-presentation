# 02 — Arquitetura

## Stack

| Camada | Tecnologia | Onde |
| --- | --- | --- |
| Build/Dev | Vite 6 | [`vite.config.ts`](../vite.config.ts) |
| UI | React 18 + TypeScript 5.7 | `src/` |
| Estilo/Tema | Tailwind CSS v4 (dark mode por classe) | [`src/index.css`](../src/index.css) |
| Roteamento | React Router 7 (`HashRouter`) | [`src/main.tsx`](../src/main.tsx), [`src/App.tsx`](../src/App.tsx) |
| Estado do editor | Zustand | [`src/store/editorStore.ts`](../src/store/editorStore.ts) |
| Gráficos | Recharts (barras/pizza) + layout próprio (nuvem) | `src/components/charts/` |
| Ícones | lucide-react | — |
| PDF | jsPDF (carregada sob demanda) | [`src/utils/exportPdf.ts`](../src/utils/exportPdf.ts) |
| QR Code | react-qr-code | [`src/components/present/ShareRoom.tsx`](../src/components/present/ShareRoom.tsx) |
| Backend/Tempo real | Firebase Firestore + Auth Anônima | `src/lib/` |
| Validação (JSON) | Zod | [`src/utils/validation.ts`](../src/utils/validation.ts) |
| Deploy | GitHub Actions → GitHub Pages | [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) |

### Por que Firebase e não um banco próprio

O acesso direto do navegador ao MongoDB Atlas foi descontinuado (Data API /
HTTPS Endpoints, fim de vida em set/2025), o que exigiria um servidor sempre
online e quebraria o requisito de site estático. O Firestore oferece **tempo
real nativo no navegador** a partir de uma página estática, é NoSQL e não impõe
limite rígido de conexões no plano gratuito.

## Camadas

```
   pages/                      Telas e orquestração (rotas)
      |
      v
   components/                 Apresentação (editor, slides, participação, gráficos, ui)
      |
      v
   hooks/                      Ponte React <-> Firestore (assinaturas em tempo real)
      |
      v
   lib/                        Acesso ao Firebase e ao localStorage
      |
      v
   Firebase (Firestore + Auth)
```

- **`types/`** define o domínio e é importado por todas as camadas.
- **`utils/`** é lógica pura, sem React e sem Firebase: agregação, validação,
  resolução de configurações, import/export, geração de PDF.
- **`store/`** guarda o estado que existe **antes** de haver sala: a
  apresentação sendo montada no editor e a preferência de tema.

A regra prática: **componentes não falam com o Firestore diretamente**. Eles
recebem dados por props (do `pages/`, que usa os hooks) ou disparam funções de
`lib/` para escrever (voto, presença, nome).

## Roteamento

`HashRouter` — os links ficam no formato `.../#/room/ABC123`. Isso evita 404 em
deep-links e refresh no GitHub Pages, que serve arquivos estáticos sem fallback
para `index.html`.

| Rota | Página | Acesso |
| --- | --- | --- |
| `/` | [`HomePage`](../src/pages/HomePage.tsx) | Público |
| `/create` | [`CreatePage`](../src/pages/CreatePage.tsx) | Público (editor local) |
| `/present/:code` | [`PresentPage`](../src/pages/PresentPage.tsx) | Só o dono atual (mesmo uid) |
| `/present/:code/:token` | [`PresentPage`](../src/pages/PresentPage.tsx) | Quem tem o token secreto |
| `/join` | [`JoinPage`](../src/pages/JoinPage.tsx) | Público |
| `/room/:code` | [`RoomPage`](../src/pages/RoomPage.tsx) | Quem tem o código |
| `*` | Redireciona para `/` | — |

## Fluxo de controle da apresentação

A sala guarda `currentSlideIndex`. Só o apresentador escreve nesse campo
(setas do teclado, passador de slides ou os botões do cabeçalho); todos os
outros navegadores **assinam** o documento e reagem. Não há mensagens diretas
entre apresentador e plateia: o documento da sala é o único canal.

O índice `currentSlideIndex === slides.length` é reservado ao **slide final
automático** de agradecimento, que também dispara o download do PDF.

## Build e bundle

[`vite.config.ts`](../vite.config.ts) separa dependências grandes em chunks
próprios para melhorar o cache:

```ts
manualChunks: {
  react:    ['react', 'react-dom', 'react-router-dom'],
  firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
  charts:   ['recharts', 'd3-cloud'],
}
```

A jsPDF fica **fora** do bundle inicial: é importada dinamicamente dentro de
`exportResultsPdf`, então só baixa quando alguém exporta um relatório.

O `base` do Vite precisa bater com o caminho de publicação. O padrão é
`/interactive-presentation/`; o workflow do GitHub Pages o sobrescreve com
`VITE_BASE=/<nome-do-repo>/`.

## Deploy

`push` na `main` dispara [`deploy.yml`](../.github/workflows/deploy.yml):
`npm ci` → `npm run build` (com os secrets `VITE_FIREBASE_*` e o `VITE_BASE`) →
publicação do `dist/` no GitHub Pages.

As chaves `VITE_FIREBASE_*` são **identificadores públicos** do projeto, não
segredos: quem protege os dados são as
[regras do Firestore](07-tempo-real-e-comunicacao.md#regras-de-segurança).
