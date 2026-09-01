# 07 — Tempo real e comunicação

Não existe servidor da aplicação. Todos os navegadores conversam **através do
Firestore**: quem escreve grava um documento, quem lê mantém uma assinatura
(`onSnapshot`) e recebe a atualização em milissegundos.

## Autenticação

[`useParticipant`](../src/hooks/useParticipant.ts) garante uma sessão anônima:

```
onAuthStateChanged -> sem usuário? -> signInAnonymously -> uid
```

O uid persiste entre recarregamentos no mesmo navegador. É ele que identifica o
dono da sala e o autor de cada resposta. Nenhum dado pessoal é pedido pelo
Firebase — o nome, quando existe, é digitado pela pessoa e guardado pela
própria aplicação.

## Assinaturas

| Hook | Assina | Quem usa |
| --- | --- | --- |
| [`useRoom`](../src/hooks/useRoom.ts) | `rooms/{code}` | Apresentador e participante |
| [`useResponses`](../src/hooks/useResponses.ts) | `responses` filtradas por `slideId` | Apresentador |
| [`useMyResponse`](../src/hooks/useMyResponse.ts) | `responses/{slideId}__{uid}` | Participante |
| [`useParticipants`](../src/hooks/useParticipants.ts) | `participants` | Apresentador |

Todos devolvem a função de cancelamento do `onSnapshot` no cleanup do
`useEffect`, então trocar de slide ou sair da página encerra a escuta.

### Navegação

O apresentador escreve `currentSlideIndex` na sala; os participantes só
**observam**. Como a `RoomPage` usa `key={currentSlide.id}` na `ParticipateView`,
trocar de slide reinicia os controles do participante.

No slide de gabarito, apresentador e participante assinam as respostas do
**`quiz` de origem** (`resultsSlideId`), não as do próprio slide `answer` — que
nunca recebe respostas.

### Cronômetro

O documento da sala guarda **um instante final por slide**, não uma contagem:

```ts
timers: {
  s4: { endsAt: 1735689600000, remainingMs: 20000 },  // correndo
  s7: { endsAt: null,          remainingMs: 12000 },  // pausado (fora do slide)
  s9: { endsAt: null,          remainingMs: 0 },      // esgotado, congelado
}
```

Três estados, e a transição entre eles está toda em `advanceTimers`
([`utils/timer.ts`](../src/utils/timer.ts)), chamada pelo apresentador a cada
troca de slide:

| Situação | Escrita |
| --- | --- |
| Entra num slide pela 1ª vez | `{ endsAt: agora + duração, remainingMs: duração }` |
| Sai do slide correndo | `{ endsAt: null, remainingMs: o que sobrou }` |
| Volta a um slide pausado | `{ endsAt: agora + remainingMs, remainingMs }` |
| Volta a um slide esgotado | nada muda — continua em zero |

Só o apresentador escreve, e sempre junto da troca de slide
(`setCurrentSlide`) ou ao assumir uma sala parada num slide com tempo
(`saveSlideTimers`). Cada navegador conta localmente a partir do mesmo
`endsAt` ([`useSlideTimer`](../src/hooks/useSlideTimer.ts)) — uma escrita por
troca de slide, e não uma por segundo, que multiplicaria a cota do plano
gratuito pelo número de segundos da apresentação.

> **Por que pausar em vez de deixar correr.** Se o tempo continuasse passando
> fora do slide, pular para uma referência no meio da pergunta queimaria o
> tempo da plateia. E um cronômetro esgotado **não** reinicia ao voltar: a
> pergunta encerrada é para ser revista, não refeita — daí `frozen` em
> `useSlideTimer`, que também impede a troca automática para o gabarito
> disparar de novo.

Duas consequências assumidas:

- **A comparação usa o relógio de cada dispositivo.** Um celular adiantado ou
  atrasado vê alguns segundos a mais ou a menos; o tempo restante é limitado à
  duração do slide para nunca começar acima dela. A troca para o gabarito quem
  decide é o apresentador, então a apresentação continua sincronizada.
- **O bloqueio é da interface, não das regras.** Ao zerar, os controles do
  participante travam, mas as regras do Firestore não conhecem o cronômetro —
  uma resposta já em trânsito ainda pode ser gravada. É o mesmo nível de
  confiança do resto da sala: quem tem o código participa.

## Presença

[`src/lib/participants.ts`](../src/lib/participants.ts)

```ts
joinRoom(code, uid, name?)  // setDoc(..., { merge: true }) em participants/{uid}
```

Chamado pela [`RoomPage`](../src/pages/RoomPage.tsx) assim que a pessoa entra —
e antes de qualquer resposta. É isso que separa os dois números do rodapé:

- **participantes** = `participants.length` (quem abriu a sala);
- **responderam** = `answeredCount(responses)` (uids distintos com resposta
  naquele slide).

Duas decisões deliberadas:

- **Sem heartbeat.** A escrita acontece na entrada e quando o nome muda. Um
  heartbeat por minuto multiplicaria as escritas por participante sem mudar a
  contagem pedida (“quem conectou já é participante”).
- **Dependência estável no efeito.** O efeito de presença depende de
  `Boolean(room)`, não do objeto `room` — que muda a cada snapshot, inclusive
  quando o apresentador troca de slide. Sem esse cuidado, cada participante
  reescreveria a presença a cada slide.

## Respostas

[`src/lib/responses.ts`](../src/lib/responses.ts)

```ts
saveResponse(code, slideId, uid, type, value, participantName?)  // setDoc: cria ou sobrescreve
clearResponse(code, slideId, uid)                                // deleteDoc
```

O id determinístico `${slideId}__${uid}` garante uma resposta por pessoa por
slide (ver [04](04-modelo-de-dados.md)). `participantName` só é gravado quando a
sala pede identificação — campos `undefined` não são aceitos pelo Firestore, por
isso o spread condicional.

## Controle do apresentador

Ao criar a sala, `createRoom` grava **em lote**:

- `rooms/{code}` com a apresentação e `creatorUid = uid`;
- `rooms/{code}/private/presenter` com `{ token, ownerUid }`.

O token vai na URL: `/present/<código>/<token>`. Ao abrir essa URL em outro
navegador (ou depois de limpar os dados), `claimPresenter`:

1. faz `update` no documento privado reenviando **o mesmo token** — as regras só
   aceitam se ele bater, e é esse passo que concede o controle;
2. tenta assumir `creatorUid` na sala, para as escritas seguintes não precisarem
   consultar o documento privado (falhar aqui não impede apresentar).

O token também fica no `localStorage`
([`presenterSessions`](../src/lib/presenterSessions.ts)), o que permite à tela
inicial oferecer “Retomar” e “Exportar PDF” das salas apresentadas naquele
dispositivo.

## Regras de segurança

[`firestore.rules`](../firestore.rules) — a pipeline as publica sozinha sempre
que o arquivo muda (job `regras-firestore`, ver
[02](02-arquitetura.md#deploy)); dá para publicá-las à mão no console ou com
`npx firebase-tools deploy --only firestore:rules --project <id>`.

| Caminho | Leitura | Escrita |
| --- | --- | --- |
| `rooms/{code}` | pública (o código é a chave) | criar: autenticado e `creatorUid == uid`; alterar/excluir: dono atual **ou** quem reivindicou pelo doc privado |
| `rooms/{code}/private/{doc}` | **negada a todos** | criar/atualizar: autenticado e reenviando o **mesmo token**; excluir: negado |
| `rooms/{code}/participants/{uid}` | pública | só o próprio uid (id do doc e `data.uid` precisam bater com `request.auth.uid`) |
| `rooms/{code}/responses/{id}` | pública | criar/atualizar: `participantUid == uid`; excluir: só o autor |

Consequências práticas:

- Quem tem o código **lê** a sala e os resultados, mas não apresenta.
- Ninguém consegue ler o token de outra pessoa — nem mesmo o dono, depois de
  gravado.
- Ninguém edita nem apaga a resposta alheia, nem forja presença com outro uid.
- Como a leitura das respostas é pública, **não envie dados sensíveis** por
  esses campos: qualquer pessoa com o código pode consultá-los.

## Limites e custos

- Escrita típica por participante: **1 doc de presença** + 1 doc por slide
  respondido (sobrescrito, não acumulado).
- Leitura típica do apresentador: 1 assinatura da sala + 1 das respostas do
  slide atual + 1 dos participantes.
- O relatório em PDF faz uma leitura única de **todas** as respostas da sala
  (`getAllResponses`).
- Não há expiração automática: salas e respostas antigas ficam no Firestore até
  serem apagadas manualmente.
