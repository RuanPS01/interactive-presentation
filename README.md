# Apresentação Interativa 📊

Aplicação web estilo *Mentimeter* para apresentações interativas em tempo real.
O apresentador cria slides, a plateia participa pelo celular (sem instalar nada e
**sem criar conta**) e os resultados aparecem ao vivo.

- **Frontend estático** (Vite + React + TypeScript + Tailwind CSS) — hospedável no **GitHub Pages**.
- **Tempo real + banco NoSQL** via **Firebase (Cloud Firestore + Autenticação Anônima)** — sem servidor próprio para manter.

> 📚 **Documentação técnica completa em [`docs/`](docs/)** — arquitetura, modelo
> de dados, tipos de slide, configurações, tempo real, componentes e fluxos.

## Funcionalidades

- **Criar sala** ou **entrar em sala** (só com um código de 6 caracteres).
- **6 tipos de slide** (ver [docs/05](docs/05-tipos-de-slide.md)):
  1. **Nuvem de palavras** — o apresentador escolhe se cada participante envia **1 resposta**, **de 1 até N**, ou **quantas quiser** (padrão). Aceita palavra ou frase.
  2. **Gráfico de barras** — opções definidas pelo apresentador; voto único ou **múltipla escolha** (padrão: único).
  3. **Gráfico de pizza** — mesma configuração das barras; a visualização vira pizza proporcional ao total de votos.
  4. **Alternativas (sem gráfico)** — pergunta e resposta: as alternativas aparecem grandes no centro da tela e no celular, sem revelar a distribuição.
  5. **Resposta correta** — slide de gabarito **criado automaticamente** depois de uma pergunta, destacando a alternativa certa e os votos de cada uma.
  6. **Texto simples** — alinhamento (esquerda/centro/direita) e tamanho da fonte.
- **Opções globais e por slide** (ver [docs/06](docs/06-configuracoes.md)): permitir limpar/trocar a resposta, pedir o nome antes de entrar, identificar cada resposta pelo nome e definir os tamanhos de título, rótulos e corpo.
- **Contagem de participantes** separada de quem já respondeu: quem abre a sala já conta como participante.
- **Compartilhamento**: código grande, QR Code ampliado e **link curto** para quem prefere digitar.
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
    participate/  Controles do participante (nuvem, votação, gabarito, nome)
    present/      QR Code / link curto e slide final de resumo
    charts/       Gráficos (Recharts) e nuvem de palavras
    ui/           Botão, input, card...
  hooks/          useRoom, useResponses, useMyResponse, useParticipants, useParticipant, useApplyTheme
  lib/            firebase, rooms, responses, participants, roomCode, shortUrl
  store/          editorStore (Zustand)
  types/          Tipos do domínio
  utils/          Agregação, configurações, import/export JSON, validação (Zod), fábrica de slides
docs/             Documentação técnica por assunto
firestore.rules   Regras de segurança do Firestore
.github/workflows/deploy.yml   Pipeline de deploy no GitHub Pages
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
| `npm run preview` | Servir o build localmente |
| `npm run typecheck` | Apenas checagem de tipos |
| `npm run lint` | ESLint |

## Deploy

A action [`deploy.yml`](.github/workflows/deploy.yml) faz duas coisas a cada push
na `main`: **publica as regras do Firestore** (quando o `firestore.rules` muda) e
**publica o site no GitHub Pages** — nessa ordem, para o app nunca ir ao ar antes
das regras de que ele depende.

1. **Suba o projeto** para um repositório no GitHub.
   - O nome do repositório define o caminho da URL. O workflow ajusta o `base`
     automaticamente para `"/<nome-do-repo>/"` (via `VITE_BASE`).
2. **Settings → Secrets and variables → Actions → New repository secret** e crie:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID` e `FIREBASE_SERVICE_ACCOUNT`.
   - `FIREBASE_SERVICE_ACCOUNT` é o **JSON de uma conta de serviço** com os papéis
     *Firebase Rules Admin*, *Firebase Viewer* e *Service Usage Consumer* no
     projeto — é ela que publica as regras. Passo a passo em
     [docs/11 — Desenvolvimento](docs/11-desenvolvimento.md#conta-de-serviço-para-as-regras).
   - Sem essa secret o site continua sendo publicado normalmente; só as regras
     ficam por sua conta no console do Firebase.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. **Faça push na branch `main`** (ou rode o workflow manualmente). O site sai em
   `https://<usuario>.github.io/<nome-do-repo>/`.
5. Em **Authentication → Settings → Domínios autorizados**, adicione
   `SEU-USUARIO.github.io` para o login anônimo funcionar no domínio publicado.

> Como o app usa `HashRouter`, os links diretos (ex.: `.../#/room/ABC123`) funcionam
> no GitHub Pages sem configuração extra de fallback.

> As chaves `VITE_FIREBASE_*` são identificadores públicos do projeto. Já o JSON em
> `FIREBASE_SERVICE_ACCOUNT` **é um segredo de verdade**: ele autoriza publicar
> regras no seu projeto do Firebase.

## Importar / Exportar

Na tela de criação, use **Exportar JSON** para baixar toda a apresentação (título,
opções globais e slides com suas configurações) e **Importar JSON** para carregá-la
de volta. O JSON é validado no import (schema em `src/utils/validation.ts`) e
aceita arquivos gerados por versões anteriores. Formato completo em
[docs/04 — Modelo de dados](docs/04-modelo-de-dados.md).

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
