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
| `npm run build` | Type-check + build de produção em `dist/` (GitHub Pages) |
| `npm run build:firebase` | Type-check + build com `base` na raiz em `dist-firebase/` (Firebase Hosting) |
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

6. Abra **Hosting** (menu **Build**) e clique em **Começar**; só avance pelas
   telas, sem rodar os comandos sugeridos. Isso cria o site padrão do projeto,
   para onde o workflow publica.

Depois de publicar no GitHub Pages, adicione `SEU-USUARIO.github.io` em
**Authentication → Settings → Domínios autorizados**, senão o login anônimo é
recusado no domínio publicado. Os domínios do Firebase Hosting
(`<projeto>.web.app` e `<projeto>.firebaseapp.com`) já vêm autorizados.

## Pipeline de deploy

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) roda a cada
`push` na `main` (e no disparo manual), com quatro jobs:

| Job | Espera | O que faz |
| --- | --- | --- |
| `build` | nada | `npm ci`, `npm run build` (com os secrets e o `VITE_BASE`) para o Pages, `vite build --mode firebase` para o Firebase Hosting e envio dos dois artefatos |
| `regras-firestore` | nada | Publica o [`firestore.rules`](../firestore.rules) no projeto do Firebase |
| `deploy` | `build` e `regras-firestore` | Publica no GitHub Pages |
| `hosting-firebase` | `build` e `regras-firestore` | Publica no Firebase Hosting |

As duas publicações dependem do `regras-firestore` de propósito: uma versão do
app que usa uma coleção ainda não liberada quebraria com `permission-denied` em
produção. As regras entram antes do código. Entre si, `deploy` e
`hosting-firebase` rodam em paralelo e não dependem um do outro.

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

### Publicação no Firebase Hosting

- **Roda a cada push na `main`**, como o Pages: o site publicado nos dois
  lugares é sempre o mesmo commit.
- **Build próprio.** O Firebase Hosting serve o site na raiz do domínio, então
  o artefato vem de `vite build --mode firebase` (`base` igual a `/`, saída em
  `dist-firebase/`). O type-check roda uma vez só, no build do Pages.
- **Só `hosting`.** O job roda `firebase deploy --only hosting`; as regras ficam
  com o job delas, que só as republica quando o arquivo muda.
- **Cache.** O [`firebase.json`](../firebase.json) manda os navegadores
  revalidarem o `index.html` a cada visita (`no-cache`) e guardarem os arquivos
  de `assets/` por um ano (`immutable`), porque o nome deles muda a cada build.
  Assim ninguém fica com um `index.html` antigo apontando para arquivos que não
  existem mais. Um arquivo inexistente devolve 404 (não há reescrita para o
  `index.html`, que o `HashRouter` dispensa).
- **Sem credenciais, o job avisa e segue**, igual ao das regras.
- Cada publicação vira uma versão no console (**Histórico de versões**, na
  página do Hosting), com o commit na descrição. Dá para voltar a uma versão anterior
  por lá, e limitar quantas versões ficam guardadas.

Para publicar à mão, com a CLI autenticada (`npx firebase-tools login`):

```bash
npm run build:firebase
npx firebase-tools deploy --only hosting --project <id-do-projeto>
```

O `build:firebase` lê as chaves do `.env` local, como o `npm run dev`.

### Configuração (uma vez)

1. Suba o projeto para um repositório no GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions** e crie os secrets abaixo.
4. `push` na `main` (ou rode o workflow manualmente).

| Secret | Para quê |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Build do app |
| `VITE_FIREBASE_AUTH_DOMAIN` | Build do app |
| `VITE_FIREBASE_PROJECT_ID` | Build do app **e** alvo do deploy das regras e do Firebase Hosting |
| `VITE_FIREBASE_STORAGE_BUCKET` | Build do app |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Build do app |
| `VITE_FIREBASE_APP_ID` | Build do app |
| `FIREBASE_SERVICE_ACCOUNT` | JSON da conta de serviço que publica as regras e o site no Firebase Hosting |

### Conta de serviço para o deploy

No **Google Cloud Console** do mesmo projeto (IAM e Admin → Contas de serviço):

1. **Criar conta de serviço** (ex.: `github-actions-deploy`).
2. Conceder os papéis:
   - **Firebase Rules Admin** (`roles/firebaserules.admin`) — cria e publica os
     rulesets;
   - **Firebase Hosting Admin** (`roles/firebasehosting.admin`): envia os
     arquivos e publica as versões do site. Numa conta já criada para as
     regras, basta acrescentar este papel em **IAM**, editando a conta;
   - **Firebase Viewer** (`roles/firebase.viewer`) — a CLI lê o projeto antes de
     publicar.
   - Se o deploy reclamar da Service Usage API, acrescente **Service Usage
     Consumer** (`roles/serviceusage.serviceUsageConsumer`).
   - Alternativa mais simples e mais permissiva: um único **Firebase Admin**
     (`roles/firebase.admin`).
3. Na aba **Chaves**, **Adicionar chave → Criar nova chave → JSON**.
4. Colar o **conteúdo inteiro do JSON** na secret `FIREBASE_SERVICE_ACCOUNT`.

O workflow grava esse JSON num arquivo temporário do runner e aponta
`GOOGLE_APPLICATION_CREDENTIALS` para ele; o arquivo é descartado no fim do job.

> A chave JSON **é um segredo de verdade** (diferente das chaves
> `VITE_FIREBASE_*`, que são identificadores públicos). Nunca a comite; para
> revogar, apague a chave na aba **Chaves** da conta de serviço.

### Sobre o `base` do Vite

O workflow define `VITE_BASE=/<nome-do-repo>/` no build do Pages, então os
assets resolvem no subcaminho do repositório. O build do Firebase Hosting usa o
modo `firebase`, com `base` na raiz. Como a aplicação usa `HashRouter`,
deep-links do tipo `.../#/room/ABC123` funcionam nos dois sem configuração
extra de fallback.

As salas lembradas para "Retomar" ficam no `localStorage`, que é separado por
domínio: quem apresentou pelo GitHub Pages não vê essas salas na tela inicial
do Firebase Hosting, e vice-versa. A sala em si é a mesma (o banco é um só), e
o link com o token funciona em qualquer um dos dois.

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
- **Controles de formulário vêm de `components/ui/`.** Nada de `<select>`,
  checkbox, radio ou range nativos nas telas: eles destoam no tema escuro.
- **Efeitos com dependências estáveis.** Documentos do Firestore mudam de
  identidade a cada snapshot; dependa de um valor derivado (um booleano, um id)
  em vez do objeto, para não disparar escritas em cascata.
- **Código pesado é carregado sob demanda.** A jsPDF e o leitor de PowerPoint
  (com as definições de formas) entram por `import()` dinâmico, só quando
  alguém exporta um PDF ou importa um `.pptx`; o resto da aplicação não paga
  por eles.

## Solução de problemas

| Sintoma | Causa e correção |
| --- | --- |
| `auth/configuration-not-found` ao iniciar | Autenticação Anônima desativada — ative no Console (passo 3) |
| `permission-denied` ao criar sala ou votar | Regras não publicadas — publique o `firestore.rules` (passo 5) |
| `Missing or insufficient permissions` | O Firestore Database não foi criado (passo 2) |
| Página em branco após o deploy | `base` não bate com o caminho do Pages — confira o `VITE_BASE` no workflow |
| Login recusado no domínio publicado | Adicione o domínio em Authentication → Settings → Domínios autorizados |
| Contagem de participantes parada em zero | Regras antigas, sem a seção `participants/{participantUid}` — republique o `firestore.rules` (o job `regras-firestore` faz isso quando o arquivo muda) |
| Job `regras-firestore` falha com `PERMISSION_DENIED` | A conta de serviço não tem **Firebase Rules Admin** / **Firebase Viewer** no projeto |
| Job `regras-firestore` falha com erro de credencial | A secret `FIREBASE_SERVICE_ACCOUNT` não contém o JSON inteiro (inclusive as chaves `{}`) |
| Aviso "Credenciais ausentes" no workflow | Falta `FIREBASE_SERVICE_ACCOUNT` — o Pages publica assim mesmo, mas as regras não sobem |
| Link curto não aparece em desenvolvimento | Esperado: o encurtador recusa `localhost`; use o link completo |
| Job `hosting-firebase` falha com `403` ou `does not have permission` | Falta o papel **Firebase Hosting Admin** na conta de serviço |
| Job `hosting-firebase` não encontra o site do projeto | O Hosting ainda não foi iniciado no console: clique em **Começar** na página do Hosting (passo 6) |
| Site do Firebase Hosting abre em branco | O artefato veio do build do Pages (`base` com o nome do repositório): confira o passo "Build (Firebase Hosting)" do workflow |
| "A sala foi criada, mas as imagens não foram enviadas" | Regras antigas, sem a seção `assets/{assetId}`: republique o `firestore.rules` |
| Imagens dos slides livres aparecem como espaço reservado cinza | A subcoleção `assets` da sala está vazia ou as regras não permitem a leitura; confira as regras e salve a sala de novo pela edição |
| "A apresentação ficou grande demais para uma sala" | O documento da sala passaria de 1 MiB (as imagens não contam): divida a apresentação |
| Um PowerPoint importa com fontes diferentes | A fonte do arquivo não está instalada no aparelho; o navegador usa uma parecida |

## Onde mexer para tarefas comuns

| Quero… | Comece por |
| --- | --- |
| Criar um novo tipo de slide | `types/presentation.ts` → `utils/slideFactory.ts` → `utils/validation.ts` → `components/editor/` → `SlideDisplay` → `ParticipateView` → `exportPdf` → `aiPrompt` |
| Adicionar uma opção global | `types/presentation.ts` (`PresentationSettings`) → `utils/settings.ts` → `utils/validation.ts` → `PresentationSettingsButton` → `SlideSettingsSection` |
| Mudar as cores dos gráficos | `components/charts/palette.ts` (vale também para o PDF) |
| Adicionar um controle de formulário numa tela | Use os componentes de `components/ui/` (`Checkbox`, `Radio`, `Slider`, `Select`, `ScrollArea`, `Modal`); ver [08](08-componentes.md#ui-componentes-genéricos) |
| Mudar o que a edição de sala grava ou reinicia | `saveAndRestartRoom` em `lib/rooms.ts` + [07](07-tempo-real-e-comunicacao.md#edição-de-uma-sala-em-andamento) |
| Ajustar o relatório | `utils/exportPdf.ts` |
| Mexer nas regras de acesso | `firestore.rules` + [07](07-tempo-real-e-comunicacao.md) |
| Mudar a exibição de um elemento do slide livre | `components/free/layout.ts` e `FreeElementContent.tsx` (exibição e edição usam os dois) e, para o PDF, `utils/freeSlideRaster.ts` e `utils/canvasText.ts` |
| Adicionar uma propriedade de texto ao slide livre | `FreeTextStyle` ou `FreeTextParagraph` em `types/presentation.ts`, depois `utils/validation.ts`, `utils/richText.ts`, `utils/richTextDom.ts`, `components/free/layout.ts`, `utils/canvasText.ts`, `FreeSlideConfig` e o leitor em `utils/pptx/text.ts` |
| Mexer na edição do slide livre (arrastar, alças, guias, atalhos) | `components/free/FreeSlideCanvas.tsx`; as ações sobre elementos ficam em `hooks/useFreeSlideActions.ts` |
| Melhorar a importação de PowerPoint | `utils/pptx/index.ts` (o que vira texto, imagem ou é juntado); formas em `geometry.ts` e `draw.ts`; texto em `text.ts`; tabelas e gráficos em `table.ts` e `chart.ts` |
| Mudar a compressão das imagens | `utils/images.ts` (`MAX_ASSET_CHARS`, `MAX_ASSET_DIMENSION`) |
| Mudar onde as imagens ficam guardadas | `lib/assets.ts`, `hooks/useRoomAssets.ts` e a regra `assets/{assetId}` em `firestore.rules` |
