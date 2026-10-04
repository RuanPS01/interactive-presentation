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
| PowerPoint | Leitor e gerador próprios sobre fflate (zip) e as definições de formas do modern-openxml, carregados sob demanda | [`src/utils/pptx/`](../src/utils/pptx/index.ts), [`src/utils/pptxExport/`](../src/utils/pptxExport/index.ts) |
| Fontes embutidas | Conversores próprios (EOT, MicroType Express, WOFF) e `FontFace` | [`src/utils/fonts/`](../src/utils/fonts/faces.ts) |
| QR Code | react-qr-code | [`src/components/present/ShareRoom.tsx`](../src/components/present/ShareRoom.tsx) |
| Backend/Tempo real | Firebase Firestore + Auth Anônima | `src/lib/` |
| Validação (JSON) | Zod | [`src/utils/validation.ts`](../src/utils/validation.ts) |
| Deploy | GitHub Actions, para o GitHub Pages e o Firebase Hosting | [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) |

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
  resolução de configurações, cronômetro, import/export, geração de PDF,
  leitura e geração de PowerPoint, fontes, texto rico e imagens.
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
| `/edit/:code` | [`EditRoomPage`](../src/pages/EditRoomPage.tsx) | Só o dono atual (mesmo uid) |
| `/edit/:code/:token` | [`EditRoomPage`](../src/pages/EditRoomPage.tsx) | Quem tem o token secreto |
| `/join` | [`JoinPage`](../src/pages/JoinPage.tsx) | Público |
| `/room/:code` | [`RoomPage`](../src/pages/RoomPage.tsx) | Quem tem o código |
| `*` | Redireciona para `/` | — |

## Fluxo de controle da apresentação

A sala guarda `currentSlideIndex`. Só o apresentador escreve nesse campo
(setas do teclado, passador de slides ou os botões do cabeçalho); todos os
outros navegadores **assinam** o documento e reagem. Não há mensagens diretas
entre apresentador e plateia: o documento da sala é o único canal.

O índice `currentSlideIndex === slides.length` é reservado ao **slide final
automático** de agradecimento, com o botão para baixar o PDF dos resultados.

É o mesmo canal que leva todos de volta ao início quando o apresentador edita
uma sala em andamento: a gravação da edição zera `currentSlideIndex`, e cada
navegador conectado simplesmente segue o documento. Detalhes em
[07](07-tempo-real-e-comunicacao.md#edição-de-uma-sala-em-andamento).

As telas `/present` e `/edit` usam a mesma verificação de acesso
([`usePresenterAccess`](../src/hooks/usePresenterAccess.ts)): dono atual ou
token secreto na URL.

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

O pacote `d3-cloud` continua declarado no `package.json` e nesse chunk, mas
não é importado em lugar nenhum: a nuvem de palavras usa um layout próprio
([`WordCloudView`](../src/components/charts/WordCloudView.tsx)).

Ficam **fora** do bundle inicial, importados dinamicamente (`import()`) só
quando usados: a jsPDF (dentro de `exportResultsPdf`, ao exportar um
relatório), o leitor de PowerPoint (`src/utils/pptx/`, ao importar um
`.pptx`) e o gerador de PowerPoint (`src/utils/pptxExport/`, ao exportar).

O `base` do Vite precisa bater com o caminho de publicação, e o site sai em
dois lugares com caminhos diferentes:

| Destino | Comando | `base` | Pasta |
| --- | --- | --- | --- |
| GitHub Pages | `npm run build` | `/interactive-presentation/` (o workflow usa `VITE_BASE=/<nome-do-repo>/`) | `dist/` |
| Firebase Hosting | `npm run build:firebase` (`vite build --mode firebase`) | `/`, a raiz do domínio | `dist-firebase/` |

A env `VITE_BASE` sobrescreve o `base` nos dois casos.

## Deploy

`push` na `main` dispara [`deploy.yml`](../.github/workflows/deploy.yml). O site
é publicado em dois lugares, o **GitHub Pages** e o **Firebase Hosting**, e as
duas publicações esperam o build e as regras:

| Job | Espera | O que faz |
| --- | --- | --- |
| `build` | nada | Compila o app duas vezes, com os secrets `VITE_FIREBASE_*`: uma para o Pages (`base` com o nome do repositório) e outra para o Firebase Hosting (`base` na raiz); envia os dois artefatos |
| `regras-firestore` | nada | Publica o [`firestore.rules`](../firestore.rules), mas **só quando esse arquivo muda** (ou no disparo manual): cada publicação cria um *ruleset* novo no projeto |
| `deploy` | `build` e `regras-firestore` | Publica no GitHub Pages |
| `hosting-firebase` | `build` e `regras-firestore` | Publica no Firebase Hosting (`https://<projeto>.web.app`) |

As duas publicações só rodam depois das regras: assim uma versão do app que
depende de uma coleção recém-liberada nunca vai ao ar antes das regras que a
permitem. Entre si elas são independentes: uma falha no Firebase Hosting não
impede o Pages, e vice-versa.

Sem a secret `FIREBASE_SERVICE_ACCOUNT`, os jobs das regras e do Firebase
Hosting emitem um aviso e terminam com sucesso; o Pages continua publicando
normalmente. Detalhes de
configuração e papéis da conta de serviço em
[11 — Desenvolvimento](11-desenvolvimento.md#pipeline-de-deploy).

As chaves `VITE_FIREBASE_*` são **identificadores públicos** do projeto, não
segredos: quem protege os dados são as
[regras do Firestore](07-tempo-real-e-comunicacao.md#regras-de-segurança). Já o
JSON em `FIREBASE_SERVICE_ACCOUNT` é um segredo de verdade: ele autoriza
publicar regras e o site no projeto.
