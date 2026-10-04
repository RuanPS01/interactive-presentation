# Apresentação Interativa 📊

Aplicação web estilo *Mentimeter* para apresentações interativas em tempo real.
O apresentador cria slides, a plateia participa pelo celular (sem instalar nada e
**sem criar conta**) e os resultados aparecem ao vivo.

- **Frontend estático** (Vite + React + TypeScript + Tailwind CSS), publicado no **GitHub Pages** e no **Firebase Hosting**.
- **Tempo real + banco NoSQL** via **Firebase (Cloud Firestore + Autenticação Anônima)** — sem servidor próprio para manter.

> 📚 **Documentação técnica completa em [`docs/`](docs/)** — arquitetura, modelo
> de dados, tipos de slide, configurações, tempo real, componentes e fluxos.

## Funcionalidades

- **Criar sala** ou **entrar em sala** (só com um código de 6 caracteres).
- **7 tipos de slide** (ver [docs/05](docs/05-tipos-de-slide.md)):
  1. **Nuvem de palavras** — o apresentador escolhe se cada participante envia **1 resposta**, **de 1 até N**, ou **quantas quiser** (padrão). Aceita palavra ou frase.
  2. **Gráfico de barras** — opções definidas pelo apresentador; voto único ou **múltipla escolha** (padrão: único).
  3. **Gráfico de pizza** — mesma configuração das barras; a visualização vira pizza proporcional ao total de votos.
  4. **Alternativas (sem gráfico)** — pergunta e resposta: as alternativas aparecem grandes no centro da tela e no celular, sem revelar a distribuição. Tem **cronômetro** (padrão de 20 s): ao zerar, as respostas são encerradas e a apresentação passa para o gabarito.
  5. **Resposta correta** — slide de gabarito **criado automaticamente** depois de uma pergunta, destacando a alternativa certa e os votos de cada uma. Aparece depois de 3 segundos de “A resposta certa é…”, para todo mundo ver a revelação junto.
  6. **Texto simples** — alinhamento (esquerda/centro/direita) e tamanho da fonte.
  7. **Slide livre**: só exibição, montado com caixas de texto e imagens soltas. Cada texto tem fonte, tamanho, cor, realce, negrito, itálico, sublinhado, tachado, alinhamento e marcadores por trecho; cada elemento pode ser arrastado, redimensionado e girado direto na prévia, com guias de alinhamento e um editor ampliado.
- **Importar PowerPoint (.pptx)**: cada slide vira um slide livre. Os textos continuam editáveis, as fotos continuam imagens, e formas, fundos, SVG, tabelas, gráficos e SmartArt viram imagem. As **fontes embutidas** no arquivo (inclusive as comprimidas pelo PowerPoint) são aproveitadas e valem no editor, no projetor, no celular e no PDF. Tudo é lido no próprio navegador. Ver [docs/09](docs/09-fluxos-de-uso.md#importar-um-powerpoint).
- **Exportar PowerPoint (.pptx)**: a apresentação vira um arquivo para o PowerPoint, Google Slides ou Keynote, com textos e imagens editáveis e as fontes embutidas; as perguntas viram slides estáticos com as alternativas, no tema da página (claro ou escuro). Ver [docs/10](docs/10-exportacoes.md#exportar-powerpoint).
- **Formato dos slides 16:9 (padrão) ou 4:3**: a prévia do editor mostra o slide na proporção escolhida, e o editor ocupa a tela inteira.
- **Opções globais e por slide** (ver [docs/06](docs/06-configuracoes.md)): permitir limpar/trocar a resposta, pedir o nome antes de entrar, identificar cada resposta pelo nome, definir os tamanhos de título, rótulos e corpo e o **tempo do cronômetro** das perguntas (0 desliga).
- **Edição da sala em andamento**: o botão **Editar** da tela de apresentação reabre o editor com as opções gerais, os slides e as opções de cada slide. Ao salvar, uma confirmação avisa que todos os participantes conectados (e o próprio apresentador) serão redirecionados para o início da apresentação; os celulares mostram um aviso explicando o reinício. Ver [docs/09](docs/09-fluxos-de-uso.md#editar-uma-sala-em-andamento).
- **Componentes de formulário próprios** (caixa de seleção, opção única, controle deslizante, lista suspensa, área com rolagem, janelas modais, seletor de cor, controle segmentado e botão de alternância), com a mesma identidade visual nos temas claro e escuro. Ver [docs/08](docs/08-componentes.md#ui-componentes-genéricos).
- **Contagem de participantes** separada de quem já respondeu: quem abre a sala já conta como participante.
- **Compartilhamento**: código grande, QR Code ampliado e **link curto** para quem prefere digitar.
- **Tema claro/escuro** como **preferência de cada usuário**, salva no navegador (localStorage). Apresentador e participantes escolhem o seu de forma independente; não é sincronizado pela sala.
- **Importar** e **Exportar** a apresentação em **JSON** (completa, com imagens e fontes) ou **PowerPoint**.
- **Exportar resultados em PDF** (relatório com os dados enviados pelos participantes, gerado no navegador).
- **Sem limite de participantes** por sala; sincronização em tempo real via Firestore.

## Stack e arquitetura

| Camada | Tecnologia |
| --- | --- |
| Build/Dev | Vite 6 |
| UI | React 18 + TypeScript |
| Estilo/Tema | Tailwind CSS v4 (dark mode por classe) |
| Estado do editor | Zustand |
| Gráficos | Recharts (barras/pizza) + layout próprio em SVG (nuvem) |
| Ícones | lucide-react |
| PDF | jsPDF (carregada sob demanda) |
| PowerPoint | Leitor próprio sobre fflate (zip) e as definições de formas do modern-openxml, carregado sob demanda |
| Backend/Tempo real | Firebase Firestore + Auth Anônima |
| Validação (JSON) | Zod |
| Deploy | GitHub Actions, para o GitHub Pages e o Firebase Hosting |

> **Por que Firebase e não MongoDB?** O acesso direto do navegador ao MongoDB Atlas
> foi descontinuado (Data API/HTTPS Endpoints com fim de vida em set/2025), o que
> exigiria um servidor próprio sempre online e quebraria o requisito de site estático.
> O Firestore oferece tempo real nativo no navegador a partir de uma página 100%
> estática, é NoSQL e não tem limite rígido de conexões no plano gratuito.

## Estrutura de pastas

```
src/
  pages/          Páginas/rotas (Home, Create, Present, EditRoom, Join, Room)
  components/
    layout/       Cabeçalho, alternador de tema, casca de página
    editor/       Editor: lista de slides, menu e formulários por tipo
    slides/       Exibição do slide na tela do apresentador
    free/         Slide livre: exibição e área de trabalho do editor
    participate/  Controles do participante (nuvem, votação, gabarito, nome)
    present/      QR Code / link curto e slide final de resumo
    charts/       Gráficos (Recharts) e nuvem de palavras
    ui/           Componentes genéricos: botão, campos, checkbox, slider, select, rolagem, modal...
  hooks/          useRoom, useResponses, useMyResponse, useParticipants, useParticipant, usePresenterAccess, useRoomAssets, useRoomFonts, useFreeSlideActions, useApplyTheme
  lib/            firebase, rooms, responses, participants, assets, fonts, roomCode, shortUrl
  store/          editorStore (Zustand)
  types/          Tipos do domínio
  utils/          Agregação, configurações, import/export JSON, validação (Zod), fábrica de slides, texto rico, imagens
    pptx/         Leitor de PowerPoint (slides livres a partir de um .pptx)
    pptxExport/   Gerador de PowerPoint (a apresentação em .pptx)
    fonts/        Fontes embutidas: EOT, MicroType Express, WOFF e registro no navegador
docs/             Documentação técnica por assunto
firestore.rules   Regras de segurança do Firestore
.github/workflows/deploy.yml   Pipeline de deploy (GitHub Pages e Firebase Hosting)
```

Detalhes de cada arquivo: [docs/03 — Estrutura de pastas](docs/03-estrutura-de-pastas.md).

## Configuração do Firebase (uma vez)

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. **Build → Firestore Database → Criar banco** (modo de produção, região à sua escolha).
3. **Build → Authentication → Sign-in method → Anônimo → Ativar**.
4. **Configurações do projeto → Seus apps → Web (`</>`)** para registrar um app web e copiar as chaves de configuração.
5. Publique as regras de segurança do arquivo [`firestore.rules`](firestore.rules):
   - Cole o conteúdo em **Firestore → Regras → Publicar**, ou
   - use a Firebase CLI: `firebase deploy --only firestore:rules`.

### Solução de problemas

- **`auth/configuration-not-found` ao iniciar a apresentação**: a Autenticação Anônima
  não está ativada. Vá em **Authentication → Sign-in method → Anônimo → Ativar**
  (passo 3 acima). O app usa login anônimo para identificar o criador da sala.
- **`permission-denied` ao criar sala ou votar**: as regras do `firestore.rules` não
  foram publicadas (o modo produção nega tudo por padrão). Publique-as (passo 5).
- **`Missing or insufficient permissions` / base indisponível**: confirme que o
  Firestore Database foi criado (passo 2).
- **Contagem de participantes travada em zero**: as regras publicadas são
  anteriores à coleção `participants`. Republique o `firestore.rules` (passo 5).

## Rodando localmente

Pré-requisitos: **Node.js 18+**.

```bash
npm install
cp .env.example .env   # e preencha as chaves VITE_FIREBASE_*
npm run dev
```

Abra o endereço mostrado (ex.: `http://localhost:5173`). Para testar o tempo real,
abra **duas janelas**: uma em *Criar sala* (apresentador) e outra em *Entrar na sala*
(participante) com o código gerado.

Scripts:

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Type-check + build de produção (`dist/`) |
| `npm run build:firebase` | Type-check + build para o Firebase Hosting (`dist-firebase/`, `base` na raiz) |
| `npm run preview` | Servir o build localmente |
| `npm run typecheck` | Apenas checagem de tipos |
| `npm run lint` | ESLint |

## Deploy

A action [`deploy.yml`](.github/workflows/deploy.yml) faz três coisas a cada push
na `main`: **publica as regras do Firestore** (quando o `firestore.rules` muda) e
então **publica o site no GitHub Pages e no Firebase Hosting**, em paralelo. As
regras vêm antes para o app nunca ir ao ar sem as regras de que ele depende.

| Destino | Endereço |
| --- | --- |
| GitHub Pages | `https://<usuario>.github.io/<nome-do-repo>/` |
| Firebase Hosting | `https://<id-do-projeto>.web.app/` (e `https://<id-do-projeto>.firebaseapp.com/`) |

1. **Suba o projeto** para um repositório no GitHub.
   - O nome do repositório define o caminho da URL. O workflow ajusta o `base`
     automaticamente para `"/<nome-do-repo>/"` (via `VITE_BASE`).
2. **Settings → Secrets and variables → Actions → New repository secret** e crie:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID` e `FIREBASE_SERVICE_ACCOUNT`.
   - `FIREBASE_SERVICE_ACCOUNT` é o **JSON de uma conta de serviço** com os papéis
     *Firebase Rules Admin*, *Firebase Hosting Admin* e *Firebase Viewer* no
     projeto. É ela que publica as regras e o site no Firebase Hosting. Passo a
     passo em
     [docs/11 (Desenvolvimento)](docs/11-desenvolvimento.md#conta-de-serviço-para-o-deploy).
   - Sem essa secret o GitHub Pages continua sendo publicado normalmente; as
     regras e o Firebase Hosting ficam por sua conta.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. No console do Firebase, abra **Hosting** (menu **Build**) e clique em
   **Começar** uma vez, para criar o site padrão do projeto.
5. **Faça push na branch `main`** (ou rode o workflow manualmente). O site sai
   nos dois endereços da tabela acima.
6. Em **Authentication**, aba **Settings**, seção **Domínios autorizados**, adicione
   `SEU-USUARIO.github.io` para o login anônimo funcionar no GitHub Pages. Os
   domínios do Firebase Hosting já vêm autorizados.

> Como o app usa `HashRouter`, os links diretos (ex.: `.../#/room/ABC123`) funcionam
> no GitHub Pages e no Firebase Hosting sem configuração extra de fallback.

> As chaves `VITE_FIREBASE_*` são identificadores públicos do projeto. Já o JSON em
> `FIREBASE_SERVICE_ACCOUNT` **é um segredo de verdade**: ele autoriza publicar
> regras e o site no seu projeto do Firebase.

## Importar / Exportar

Na tela de criação, o botão **Exportar** abre a escolha entre:

- **Apresentação (.json)**: toda a apresentação (título, opções globais, slides
  com suas configurações e as imagens e fontes dos slides livres), para
  importar de volta aqui.
- **PowerPoint (.pptx)**: um arquivo para abrir em outros programas, gerado no
  navegador, com textos e imagens editáveis e as fontes embutidas. Detalhes em
  [docs/10](docs/10-exportacoes.md#exportar-powerpoint).

O botão **Importar** abre a escolha entre:

- **Apresentação (.json)**: substitui o conteúdo do editor. O JSON é validado no
  import (schema em `src/utils/validation.ts`) e aceita arquivos gerados por
  versões anteriores. Formato completo em
  [docs/04 (Modelo de dados)](docs/04-modelo-de-dados.md).
- **PowerPoint (.pptx)**: converte cada slide visível num slide livre, que entra
  no fim da apresentação ou no lugar dela. Detalhes e limitações em
  [docs/10](docs/10-exportacoes.md#importar).

As imagens e as fontes dos slides livres ficam em subcoleções da sala no
Firestore (`rooms/<código>/assets` e `rooms/<código>/fonts`): as imagens
comprimidas para caber num documento, e as fontes divididas em partes quando
são maiores. O Cloud Storage não é usado porque exige o plano pago do Firebase.

Durante a apresentação, o botão **Exportar PDF** gera um relatório com os resultados
de cada slide (votos, percentuais e palavras enviadas pelos participantes). O PDF é
desenhado no próprio navegador (`src/utils/exportPdf.ts`), sem servidor. Ao final há
um **slide automático de agradecimento** com uma grade de miniaturas de todos os
slides e, no centro, o botão **Baixar resultados (PDF)**.

## Apresentador: token e reentrada

Ao iniciar, a sala ganha um **token secreto de apresentador** embutido na URL
(`/present/<código>/<token>`). Com essa URL o apresentador pode **recarregar a página
ou trocar de navegador** sem perder o controle da sala — quem só tem o código (a
plateia) **não** consegue apresentar. O token é guardado num documento privado
(`rooms/<código>/private/presenter`) que os clientes não podem ler; reivindicar o
controle exige reenviar o mesmo token. O token também fica salvo no `localStorage`
deste dispositivo, então a **tela inicial sugere retomar a sala** (ou exportar os
resultados de novo).

## Segurança

As chaves `VITE_FIREBASE_*` são **identificadores públicos** do projeto (não são
segredo). A proteção real dos dados é feita pelas **Firestore Security Rules**
([`firestore.rules`](firestore.rules)): qualquer um com o código lê a sala, mas só o
**dono atual** (quem criou ou reivindicou com o token) altera a apresentação, as
imagens e as fontes dela, e cada participante só edita a própria resposta. O token do apresentador fica num subdocumento
privado, sem leitura por clientes.
