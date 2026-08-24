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
5. Publique as regras de [`firestore.rules`](../firestore.rules) — cole em
   **Firestore → Regras → Publicar** ou rode
   `firebase deploy --only firestore:rules`.

Depois de publicar no GitHub Pages, adicione `SEU-USUARIO.github.io` em
**Authentication → Settings → Domínios autorizados**, senão o login anônimo é
recusado no domínio publicado.

## Deploy no GitHub Pages

1. Suba o projeto para um repositório no GitHub.
2. **Settings → Secrets and variables → Actions** e crie os secrets
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
3. **Settings → Pages → Source: GitHub Actions**.
4. `push` na `main` (ou rode o workflow manualmente).

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
| Contagem de participantes parada em zero | Regras antigas, sem a seção `participants/{participantUid}` — republique o `firestore.rules` |
| Link curto não aparece em desenvolvimento | Esperado: o encurtador recusa `localhost`; use o link completo |

## Onde mexer para tarefas comuns

| Quero… | Comece por |
| --- | --- |
| Criar um novo tipo de slide | `types/presentation.ts` → `utils/slideFactory.ts` → `utils/validation.ts` → `components/editor/` → `SlideDisplay` → `ParticipateView` → `exportPdf` → `aiPrompt` |
| Adicionar uma opção global | `types/presentation.ts` (`PresentationSettings`) → `utils/settings.ts` → `utils/validation.ts` → `PresentationSettingsButton` → `SlideSettingsSection` |
| Mudar as cores dos gráficos | `components/charts/palette.ts` (vale também para o PDF) |
| Ajustar o relatório | `utils/exportPdf.ts` |
| Mexer nas regras de acesso | `firestore.rules` + [07](07-tempo-real-e-comunicacao.md) |
