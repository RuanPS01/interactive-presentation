# 11 — Desenvolvimento

## Pré-requisitos

- **Node.js 18+** (o CI usa a 20).
- Um projeto no [Firebase Console](https://console.firebase.google.com/) com
  **Firestore** e **Autenticação Anônima** ativados.

## Rodando localmente

```bash
npm install
```

```bash
cp .env.example .env
```

Preencha as chaves `VITE_FIREBASE_*` (Console → Configurações do projeto → Seus
apps → Config do SDK) e suba o servidor:

```bash
npm run dev
```

Para testar o tempo real, abra **duas janelas**: uma em *Criar sala*
(apresentador) e outra em *Entrar na sala* (participante) com o código gerado.

> Sem `.env`, a aplicação **carrega assim mesmo** (há uma configuração de
> reserva em [`src/lib/firebase.ts`](../src/lib/firebase.ts)) e mostra um aviso.
> Dá para editar slides, ver a prévia e exportar JSON; só as operações de sala
> falham.

## Scripts

| Comando | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (porta 5173) |
| `npm run build` | Type-check + build de produção em `dist/` |
| `npm run preview` | Serve o build localmente |
| `npm run typecheck` | Só a checagem de tipos (`tsc -b`) |
| `npm run lint` | ESLint |

Rode **typecheck e lint antes de commitar**: o build do CI falha em erro de
tipo, e o lint cobre as regras de hooks e de fast-refresh do React.

## Configuração do Firebase (uma vez)

1. Crie o projeto no Firebase Console.
2. **Build → Firestore Database → Criar banco** (modo de produção).
3. **Build → Authentication → Sign-in method → Anônimo → Ativar**.
4. **Configurações do projeto → Seus apps → Web (`</>`)** e copie as chaves.
5. Publique as regras de [`firestore.rules`](../firestore.rules). Depois do
   primeiro deploy isso é automático (ver abaixo); da primeira vez, cole o
   conteúdo em **Firestore → Regras → Publicar** ou rode
   `npx firebase-tools deploy --only firestore:rules --project <id-do-projeto>`.

Depois de publicar no GitHub Pages, adicione `SEU-USUARIO.github.io` em
**Authentication → Settings → Domínios autorizados**, senão o login anônimo é
recusado no domínio publicado.

## Pipeline de deploy

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) roda a cada
`push` na `main` (e no disparo manual), com três jobs:

```
build ──────────────┐
                    ├──> deploy (GitHub Pages)
regras-firestore ───┘
```

| Job | O que faz |
| --- | --- |
| `build` | `npm ci`, `npm run build` (com os secrets e o `VITE_BASE`) e envio do artefato |
| `regras-firestore` | Publica o [`firestore.rules`](../firestore.rules) no projeto do Firebase |
| `deploy` | Publica no GitHub Pages — **espera os dois anteriores** |

O `deploy` depende do `regras-firestore` de propósito: uma versão do app que usa
uma coleção ainda não liberada quebraria com `permission-denied` em produção. As
regras entram antes do código.

### Publicação das regras

- **Só roda quando `firestore.rules` muda** (comparando com o commit anterior do
  push) ou no **disparo manual** do workflow. Cada deploy cria um *ruleset* novo
  no projeto; republicar regras idênticas a cada push consumiria a cota à toa.
- **Só `firestore:rules`.** Incluir `firestore:indexes` faria a CLI apagar
  índices criados pelo console que não estivessem versionados no repositório.
- **Sem credenciais, o job avisa e segue.** Se `FIREBASE_SERVICE_ACCOUNT` ou
  `VITE_FIREBASE_PROJECT_ID` não existirem, o job registra um `::warning::` e
  termina com sucesso — o Pages continua publicando, e as regras ficam por sua
  conta no console.
- O [`firebase.json`](../firebase.json) diz à CLI onde está o arquivo de regras.
  Não há `.firebaserc` no repositório: o id do projeto vem da secret, via
  `--project`, para não ficar fixo num repositório público.

### Configuração (uma vez)

1. Suba o projeto para um repositório no GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions** e crie os secrets abaixo.
4. `push` na `main` (ou rode o workflow manualmente).

| Secret | Para quê |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Build do app |
| `VITE_FIREBASE_AUTH_DOMAIN` | Build do app |
| `VITE_FIREBASE_PROJECT_ID` | Build do app **e** alvo do deploy das regras |
| `VITE_FIREBASE_STORAGE_BUCKET` | Build do app |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Build do app |
| `VITE_FIREBASE_APP_ID` | Build do app |
| `FIREBASE_SERVICE_ACCOUNT` | JSON da conta de serviço que publica as regras |

### Conta de serviço para as regras

No **Google Cloud Console** do mesmo projeto (IAM e Admin → Contas de serviço):

1. **Criar conta de serviço** (ex.: `github-actions-regras`).
2. Conceder os **três** papéis:
   - **Firebase Rules Admin** (`roles/firebaserules.admin`) — cria e publica os
     rulesets;
   - **Firebase Viewer** (`roles/firebase.viewer`) — a CLI lê o projeto antes de
     publicar;
   - **Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`) —
     antes de publicar, a CLI verifica se a API `firestore.googleapis.com` está
     ativa, e essa checagem exige `serviceusage.services.get`. Sem este papel o
     deploy falha com `HTTP Error: 403, Permission denied to get service`.

   Os três podem ser trocados por um único **Firebase Admin**
   (`roles/firebase.admin`), mais simples de conceder e bem mais permissivo.

   Alterações de IAM levam um ou dois minutos para propagar; se o job falhar
   logo depois de conceder um papel, reexecute-o antes de investigar.
3. Na aba **Chaves**, **Adicionar chave → Criar nova chave → JSON**.
4. Colar o **conteúdo inteiro do JSON** na secret `FIREBASE_SERVICE_ACCOUNT`.

O workflow grava esse JSON num arquivo temporário do runner e aponta
`GOOGLE_APPLICATION_CREDENTIALS` para ele; o arquivo é descartado no fim do job.

> A chave JSON **é um segredo de verdade** (diferente das chaves
> `VITE_FIREBASE_*`, que são identificadores públicos). Nunca a comite; para
> revogar, apague a chave na aba **Chaves** da conta de serviço.

### Sobre o `base` do Vite

O workflow define `VITE_BASE=/<nome-do-repo>/`, então os assets resolvem no
subcaminho do Pages. Como a aplicação usa `HashRouter`, deep-links do tipo
`.../#/room/ABC123` funcionam sem configuração extra de fallback.

## Convenções de código

- **TypeScript estrito**; nada de `any` fora dos pontos em que o Recharts obriga
  (marcados com `eslint-disable-next-line` e um comentário do motivo).
- **Comentários explicam o porquê**, não o quê. Quem lê o código vê o que ele
  faz; o comentário existe para a decisão que não está no código (limites do
  Firestore, CORS, o cálculo do layout da nuvem).
- **Interface e comentários em português do Brasil.**
- **Um arquivo de componente exporta componentes.** Funções auxiliares
  compartilhadas vão para `utils/` (a regra `react-refresh/only-export-components`
  do ESLint reclama do contrário).
- **Nunca grave `undefined` no Firestore** — omita o campo com spread
  condicional.
- **Efeitos com dependências estáveis.** Documentos do Firestore mudam de
  identidade a cada snapshot; dependa de um valor derivado (um booleano, um id)
  em vez do objeto, para não disparar escritas em cascata.

## Solução de problemas

| Sintoma | Causa e correção |
| --- | --- |
| `auth/configuration-not-found` ao iniciar | Autenticação Anônima desativada — ative no Console (passo 3) |
| `permission-denied` ao criar sala ou votar | Regras não publicadas — publique o `firestore.rules` (passo 5) |
| `Missing or insufficient permissions` | O Firestore Database não foi criado (passo 2) |
| Página em branco após o deploy | `base` não bate com o caminho do Pages — confira o `VITE_BASE` no workflow |
| Login recusado no domínio publicado | Adicione o domínio em Authentication → Settings → Domínios autorizados |
| Contagem de participantes parada em zero | Regras antigas, sem a seção `participants/{participantUid}` — republique o `firestore.rules` (o job `regras-firestore` faz isso quando o arquivo muda) |
| `403, Permission denied to get service [firestore.googleapis.com]` | Falta o papel **Service Usage Consumer** na conta de serviço |
| Job `regras-firestore` falha com `PERMISSION_DENIED` ao publicar | A conta de serviço não tem **Firebase Rules Admin** / **Firebase Viewer** no projeto |
| Job `regras-firestore` falha com erro de credencial | A secret `FIREBASE_SERVICE_ACCOUNT` não contém o JSON inteiro (inclusive as chaves `{}`) |
| Aviso "Credenciais ausentes" no workflow | Falta `FIREBASE_SERVICE_ACCOUNT` — o Pages publica assim mesmo, mas as regras não sobem |
| Link curto não aparece em desenvolvimento | Esperado: o encurtador recusa `localhost`; use o link completo |

## Onde mexer para tarefas comuns

| Quero… | Comece por |
| --- | --- |
| Criar um novo tipo de slide | `types/presentation.ts` → `utils/slideFactory.ts` → `utils/validation.ts` → `components/editor/` → `SlideDisplay` → `ParticipateView` → `exportPdf` → `aiPrompt` |
| Adicionar uma opção global | `types/presentation.ts` (`PresentationSettings`) → `utils/settings.ts` → `utils/validation.ts` → `PresentationSettingsButton` → `SlideSettingsSection` |
| Mudar as cores dos gráficos | `components/charts/palette.ts` (vale também para o PDF) |
| Ajustar o relatório | `utils/exportPdf.ts` |
| Mexer nas regras de acesso | `firestore.rules` + [07](07-tempo-real-e-comunicacao.md) |
