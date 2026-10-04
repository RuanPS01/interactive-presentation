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
| [`useRoomAssets`](../src/hooks/useRoomAssets.ts) | `assets/{id}` (leitura única, não é assinatura) | Apresentador e participante |

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
| A contagem do projetor zera | `{ endsAt: null, remainingMs: 0 }` (`closeTimer`) |
| Volta a um slide esgotado | nada muda — continua em zero |

Só o apresentador escreve, e sempre junto da troca de slide
(`setCurrentSlide`) ou por `saveSlideTimers`, ao assumir uma sala parada num
slide com tempo e ao encerrar a pergunta. Uma escrita por troca de slide, e não
uma por segundo, que multiplicaria a cota do plano gratuito pelo número de
segundos da apresentação.

#### Quem exibe e quem encerra

[`useSlideTimer`](../src/hooks/useSlideTimer.ts) separa duas coisas que parecem
a mesma:

| Campo | De onde vem | Quem usa |
| --- | --- | --- |
| `remainingMs` / `endsAt` | relógio **local**, a partir de `endsAt` | só o projetor, para desenhar a contagem |
| `closed` | estado **da sala** (`endsAt: null` e `remainingMs: 0`) | todos, para travar as respostas |
| `runOut` | relógio **local** zerou com o cronômetro correndo | só o apresentador, como gatilho para encerrar |

A separação é o que corrige um erro real: quando cada celular decidia pelo
próprio relógio, um aparelho poucos segundos adiantado bloqueava as opções
antes de o tempo acabar no projetor. Agora o aparelho pode até achar que o
tempo já foi (`runOut`), mas nada trava enquanto a sala não disser `closed`.

A contagem em milissegundos é animada dentro do próprio
[`SlideCountdown`](../src/components/slides/SlideCountdown.tsx), com
`requestAnimationFrame`: só o card se redesenha a cada quadro, sem arrastar
junto o quadro de alternativas e os gráficos do slide.

A revelação do gabarito segue a mesma ideia: quando o suspense termina, o
apresentador acrescenta o id do slide a `revealedSlideIds` (com `arrayUnion`,
que torna a escrita idempotente). É esse registro que faz voltar ao gabarito —
ou chegar atrasado nele — mostrar a resposta na hora.

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

## Edição de uma sala em andamento

[`EditRoomPage`](../src/pages/EditRoomPage.tsx) ·
[`saveAndRestartRoom`](../src/lib/rooms.ts)

O botão **Editar** da tela do apresentador abre `/edit/<código>/<token>`, com a
mesma verificação de acesso da apresentação
([`usePresenterAccess`](../src/hooks/usePresenterAccess.ts)). O editor é
carregado **uma única vez** com o que está no ar; os snapshots seguintes do
documento (troca de slide, cronômetro) não atropelam o que está sendo editado.

Enquanto o apresentador edita, nada é gravado e a plateia continua no slide em
que estava. Se uma pergunta com cronômetro estiver no ar, ela não é encerrada
durante a edição, porque quem encerra é a tela de apresentação: descartando, o
encerramento acontece assim que essa tela volta a abrir; salvando, os
cronômetros recomeçam com o tempo cheio.

Ao abrir, a tela de edição também busca as imagens dos slides livres da sala
e guarda a lista de ids que a sala já tem. Ao salvar, depois da confirmação,
as imagens novas são enviadas primeiro (para nenhum aparelho ver um slide sem a
imagem) e então uma única escrita no documento da sala grava:

| Campo | Valor |
| --- | --- |
| `title`, `slides`, `settings` | A versão editada (opções completadas com os padrões) |
| `currentSlideIndex` | `0`: todos voltam ao primeiro slide |
| `timers` | `{}`: os cronômetros recomeçam |
| `revealedSlideIds` | `[]`: os gabaritos voltam a ter o suspense |
| `status` | `live` |
| `revision` | `increment(1)` |

Por fim, as imagens que nenhum slide usa mais são apagadas da subcoleção; se
essa limpeza falhar, só sobra uma imagem sem uso, nada quebra.

Não existe mensagem direta para "redirecionar" ninguém: cada navegador segue
`currentSlideIndex`, então zerar o índice leva todos ao início ao mesmo tempo,
inclusive quem estava no slide final de agradecimento. O apresentador também
volta: a tela de edição navega para `/present/...`, que abre no primeiro slide.

Na tela do participante, a [`RoomPage`](../src/pages/RoomPage.tsx) guarda o
`revision` que encontrou ao abrir. Quando chega um maior, mostra por 10
segundos (ou até ser fechado) o aviso "O apresentador atualizou a apresentação
e todos voltaram para o início". Quem entra depois da edição não vê aviso.

Decisões:

- **As respostas ficam.** Cada resposta pertence a um slide pelo id, que o
  editor preserva, e as regras só deixam o próprio autor apagá-la. Respostas de
  um slide removido ficam órfãs e não aparecem em lugar nenhum; votos em uma
  opção removida deixam de ser contados.
- **As regras do documento da sala não mudam.** Gravar a edição é um `update`
  comum, já permitido ao dono atual. As imagens seguem a regra da subcoleção
  `assets`, que exige o mesmo dono.
- **O editor é só da tela de edição.** Ela cria o próprio `editorStore` (ver
  [08](08-componentes.md#editorstore-em-detalhe)), então o rascunho da tela de
  criação não é tocado.

## Imagens dos slides livres

[`src/lib/assets.ts`](../src/lib/assets.ts) ·
[`useRoomAssets`](../src/hooks/useRoomAssets.ts)

As imagens ficam em `rooms/{code}/assets/{assetId}`, uma por documento, e não
no documento da sala. A sala é lida por todos os aparelhos a cada troca de
slide e tem limite de 1 MiB; com as imagens dentro, ela estouraria o limite e
cada troca de slide baixaria tudo de novo.

O Firestore foi escolhido no lugar do Cloud Storage porque o Storage exige o
plano pago (Blaze) do Firebase, e o projeto roda no plano gratuito. Para caber
num documento, toda imagem é comprimida antes de entrar (no máximo 1920 px no
lado maior e 900 mil caracteres de data URL).

**Escrita.** `createRoom` grava a sala e o documento privado no lote atômico de
sempre e só depois envia as imagens, porque as regras só deixam o dono da sala
gravá-las. As imagens vão em lotes de até 8 documentos ou 7 MB. Na edição, só
as imagens que a sala ainda não tem são enviadas (o id vem do conteúdo, então
id igual é imagem igual).

**Leitura.** Não há assinatura: o id muda junto com o conteúdo, então uma
imagem lida nunca fica desatualizada. Cada aparelho lê cada imagem uma vez e a
guarda em memória (as leituras em andamento também, para duas telas pedindo a
mesma imagem gerarem uma leitura só). Cada tela pede só o que vai mostrar:

| Tela | Imagens lidas |
| --- | --- |
| Projetor | As do slide no ar e do seguinte; no slide final, todas (miniaturas) |
| Celular | As do slide no ar e do seguinte |
| Edição da sala | Todas, antes de abrir o editor |
| PDF (projetor e tela inicial) | Todas, na hora de gerar |

Enquanto uma imagem não chega, o lugar dela mostra um espaço reservado cinza;
o slide não espera por ela.

**Tamanho da sala.** Mesmo sem as imagens, a sala pode crescer com muitos
slides livres cheios de texto. `createRoom` e `saveAndRestartRoom` medem o JSON
antes de gravar e, se passar de 1 MB, recusam com uma mensagem que pede para
dividir a apresentação.

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
| `rooms/{code}/assets/{id}` | pública | criar, atualizar e excluir: autenticado e dono da sala (`isRoomOwner`) |

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
- Imagens: uma leitura por imagem por aparelho, só quando o slide que a usa
  está no ar ou é o próximo. Uma imagem de 900 mil caracteres conta como cerca
  de 900 KB no armazenamento do Firestore (1 GiB no plano gratuito).
- Não há expiração automática: salas, respostas e imagens antigas ficam no
  Firestore até serem apagadas manualmente.
