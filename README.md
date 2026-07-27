# Apresentação Interativa 📊

Aplicação web estilo *Mentimeter* para apresentações interativas em tempo real.
O apresentador cria slides, a plateia participa pelo celular (sem instalar nada e
**sem criar conta**) e os resultados aparecem ao vivo.

- **Frontend estático** (Vite + React + TypeScript + Tailwind CSS) — hospedável no **GitHub Pages**.
- **Tempo real + banco NoSQL** via **Firebase (Cloud Firestore + Autenticação Anônima)** — sem servidor próprio para manter.

## Funcionalidades

- **Criar sala** ou **entrar em sala** (só com um código de 6 caracteres).
- **4 tipos de slide**:
  1. **Nuvem de palavras** — o apresentador escolhe se cada participante envia **1 palavra**, **de 1 até N**, ou **quantas quiser** (padrão).
  2. **Gráfico de barras** — opções definidas pelo apresentador; voto único ou **múltipla escolha** (padrão: único).
  3. **Gráfico de pizza** — mesma configuração das barras; a visualização vira pizza proporcional ao total de votos.
  4. **Texto simples** — alinhamento (esquerda/centro/direita) e tamanho da fonte.
- **Tema claro/escuro** como **preferência de cada usuário**, salva no navegador (localStorage). Apresentador e participantes escolhem o seu de forma independente; não é sincronizado pela sala.
- **Importar/Exportar** a apresentação completa em **JSON**.
- **Exportar resultados em PDF** (relatório com os dados enviados pelos participantes, gerado no navegador).
- **Sem limite de participantes** por sala; sincronização em tempo real via Firestore.

## Stack e arquitetura

| Camada | Tecnologia |
| --- | --- |
| Build/Dev | Vite 6 |
| UI | React 18 + TypeScript |
| Estilo/Tema | Tailwind CSS v4 (dark mode por classe) |
| Estado do editor | Zustand |
| Gráficos | Recharts (barras/pizza) + d3-cloud (nuvem) |
| Ícones | lucide-react |
| PDF | jsPDF (carregada sob demanda) |
| Backend/Tempo real | Firebase Firestore + Auth Anônima |
| Validação (JSON) | Zod |
| Deploy | GitHub Actions → GitHub Pages |

> **Por que Firebase e não MongoDB?** O acesso direto do navegador ao MongoDB Atlas
> foi descontinuado (Data API/HTTPS Endpoints com fim de vida em set/2025), o que
> exigiria um servidor próprio sempre online e quebraria o requisito de site estático.
> O Firestore oferece tempo real nativo no navegador a partir de uma página 100%
> estática, é NoSQL e não tem limite rígido de conexões no plano gratuito.

## Estrutura de pastas

```
src/
  pages/          Páginas/rotas (Home, Create, Present, Join, Room)
  components/
    layout/       Cabeçalho, alternador de tema, casca de página
    editor/       Editor: lista de slides, menu e formulários por tipo
    slides/       Exibição do slide na tela do apresentador
    participate/  Controles do participante (nuvem, votação, texto)
    charts/       Gráficos (Recharts) e nuvem de palavras (d3-cloud)
    ui/           Botão, input, card...
  hooks/          useRoom, useResponses, useMyResponse, useParticipant, useApplyTheme
  lib/            firebase, rooms, responses, roomCode
  store/          editorStore (Zustand)
  types/          Tipos do domínio
  utils/          Agregação, import/export JSON, validação (Zod), fábrica de slides
firestore.rules   Regras de segurança do Firestore
.github/workflows/deploy.yml   Pipeline de deploy no GitHub Pages
```

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
| `npm run preview` | Servir o build localmente |
| `npm run typecheck` | Apenas checagem de tipos |
| `npm run lint` | ESLint |

## Deploy no GitHub Pages

1. **Suba o projeto** para um repositório no GitHub.
   - O nome do repositório define o caminho da URL. O workflow ajusta o `base`
     automaticamente para `"/<nome-do-repo>/"` (via `VITE_BASE`).
2. **Settings → Secrets and variables → Actions → New repository secret** e crie:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Faça push na branch `main`** (ou rode o workflow manualmente). A action
   [`deploy.yml`](.github/workflows/deploy.yml) faz build e publica em
   `https://<usuario>.github.io/<nome-do-repo>/`.
5. Em **Authentication → Settings → Domínios autorizados**, adicione
   `SEU-USUARIO.github.io` para o login anônimo funcionar no domínio publicado.

> Como o app usa `HashRouter`, os links diretos (ex.: `.../#/room/ABC123`) funcionam
> no GitHub Pages sem configuração extra de fallback.

## Importar / Exportar

Na tela de criação, use **Exportar JSON** para baixar toda a apresentação (título,
tema e slides com suas configurações) e **Importar JSON** para carregá-la de volta.
O JSON é validado no import (schema em `src/utils/validation.ts`).

Durante a apresentação, o botão **Exportar PDF** gera um relatório com os resultados
de cada slide (votos, percentuais e palavras enviadas pelos participantes). O PDF é
desenhado no próprio navegador (`src/utils/exportPdf.ts`), sem servidor. Ao final há
um **slide automático de agradecimento** com uma grade de miniaturas de todos os
slides; ao chegar nele, o PDF é baixado automaticamente.

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
**dono atual** (quem criou ou reivindicou com o token) altera a apresentação, e cada
participante só edita a própria resposta. O token do apresentador fica num subdocumento
privado, sem leitura por clientes.
