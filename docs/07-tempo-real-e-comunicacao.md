# 07. Tempo real e comunicação

Não existe servidor da aplicação. Todos os navegadores conversam **através do
Firestore**: quem escreve grava um documento, quem lê mantém uma assinatura
(`onSnapshot`) e recebe a atualização em milissegundos.

## Como o sincronismo funciona

É o que permite à plateia interagir com a apresentação enquanto ela acontece:
o apresentador troca de slide e todos os celulares acompanham; um aluno toca
numa alternativa e o gráfico do projetor muda; o tempo acaba e as respostas
travam para todos juntos.

**A ideia:** o estado da apresentação mora em documentos do Firestore; cada
navegador escreve só a sua parte e **assina** (`onSnapshot`) os documentos de
que precisa; o Firestore empurra cada mudança para todos os ouvintes. Não há
mensagem direta entre apresentador e aluno, nem um processo central: o
documento compartilhado é o canal.

- **Publicar** é gravar (`setDoc`, `updateDoc`, `deleteDoc`, `writeBatch`).
- **Assinar** é abrir um ouvinte (`onSnapshot`): ele entrega primeiro o estado
  atual completo e depois uma versão nova a cada mudança, até ser cancelado no
  cleanup do `useEffect`.
- A tela **nunca guarda cópia própria** do estado compartilhado: o React só
  desenha o último snapshot recebido.

### Quem escreve e quem ouve

| Dado | Caminho | Quem escreve | Quem ouve |
| --- | --- | --- | --- |
| Slide atual, status, cronômetros, gabaritos revelados e publicados, slides (sem gabarito), opções, revisão | `rooms/{code}` | Só o apresentador | Projetor, todos os celulares e a tela de edição (`useRoom`) |
| Gabaritos das perguntas | `secret/answers` | Só o apresentador, no lote que cria ou edita a sala | Só o projetor (`useRoomAnswers`); a edição e o PDF da tela inicial leem uma vez (`fetchAnswers`) |
| Resposta de um aluno num slide | `responses/{slideId}__{uid}` | Só o próprio aluno | O projetor (consulta das respostas do slide no ar, `useResponses`) e o próprio aluno (só o documento dele, `useMyResponse`) |
| Presença | `participants/{uid}` | Só o próprio aluno | Projetor e tela de edição (`useParticipants`) |
| Imagens e fontes | `assets`, `fonts` | Apresentador | Ninguém assina: leitura única sob demanda, com cache |

Consequências: alunos nunca disputam o mesmo documento (cada um grava só o
que tem o próprio `uid` no id); a sala tem um único escritor; e cada tela ouve
só o que mostra (o aluno não baixa as respostas dos colegas, e o projetor só
ouve as do slide no ar).

### Fluxos

**Troca de slide.** O apresentador avança; `goTo` calcula o índice e os
cronômetros (`advanceTimers`) e grava os dois numa **única** escrita
(`setCurrentSlide`). A tela dele muda na hora; o Firestore valida pelas regras
e envia a versão nova a todos os ouvintes da sala. Em cada celular, a
`RoomPage` recalcula o slide atual; a `key={currentSlide.id}` da
`ParticipateView` recria os controles limpos; `useMyResponse` passa a ouvir a
resposta do novo slide (se o aluno já tinha respondido, ela reaparece). No
projetor, `useResponses` troca de consulta e o primeiro snapshot já traz todas
as respostas existentes daquele slide.

**Resposta.** O aluno toca na opção; `saveResponse` faz `setDoc` no documento
`{slideId}__{uid}` (os botões ficam ocupados até a confirmação, para evitar
toque duplo). O ouvinte do próprio celular marca a opção na hora; o Firestore
valida e confirma; o ouvinte do projetor recebe a mudança, e `aggregateChoices`
ou `aggregateWords` recalculam o gráfico, a nuvem e o rodapé. Outra aba do
mesmo aluno também atualiza. Limpar é um `deleteDoc` que chega do mesmo jeito,
e desmarcar a última opção de uma múltipla escolha também apaga o documento.

**Entrada.** `useParticipant` garante o `uid`; `useRoom` entrega o estado
atual completo (slide no ar, cronômetros, gabaritos revelados), então quem
chega atrasado não precisa de "replay"; `joinRoom` grava a presença e o
contador do projetor sobe. Numa sala encerrada, o celular vai direto para a
tela final.

**Tempo e revelação.** O apresentador grava só o instante final
(`timers[id].endsAt`); cada aparelho conta localmente. Quem trava a plateia é
o encerramento gravado pelo projetor (`closed`), nunca o relógio do celular.
No gabarito, cada aparelho conta 3 s localmente a partir de quando recebeu a
troca de slide, absorvendo a diferença de milissegundos entre celulares; depois
o projetor grava, numa escrita só, `revealedSlideIds` e as corretas da pergunta
em `revealedAnswers`. O celular só mostra o resultado quando as corretas
chegaram, e quem chega atrasado vê a resposta na hora. Detalhes em
[Cronômetro](#cronômetro) e [Gabarito protegido](#gabarito-protegido).

**Fim.** Passar do último slide (ou "Encerrar") grava o índice do slide final
e `status: 'ended'` numa escrita só. Os celulares mostram a tela final, o
projetor desativa a navegação e as regras passam a recusar mudanças na sala e
respostas novas. Detalhes em [Encerramento da sala](#encerramento-da-sala).

**Reinício após edição.** Uma escrita grava `currentSlideIndex: 0`, zera
cronômetros e revelações e soma 1 em `revision`; todos seguem o índice e os
celulares mostram o aviso. Detalhes em
[Edição de uma sala em andamento](#edição-de-uma-sala-em-andamento).

### Por que a resposta aparece na hora (compensação de latência)

O código não mantém estado otimista próprio. O próprio SDK do Firestore aplica
a escrita no cache local e dispara os ouvintes daquele navegador antes da
confirmação do servidor:

| Momento | Celular do aluno | Projetor |
| --- | --- | --- |
| Toque | Ouvinte local recebe a versão pendente: botão marcado | Nada ainda |
| Confirmação | Nada muda; a promessa do `setDoc` resolve e os botões voltam a ficar livres | Recebe a resposta; o gráfico atualiza |
| Escrita recusada pelas regras (raro) | O SDK desfaz e o ouvinte recebe o estado anterior | Nada muda |

### Garantias de consistência

- **Fonte única da verdade**: o Firestore.
- **O que precisa chegar junto vai na mesma escrita**: índice e cronômetros;
  encerramento e avanço para o gabarito; registro da revelação e gabarito
  publicado; índice final e `status: 'ended'`; o reinício da edição (sala e
  gabaritos, num lote).
- **Ids determinísticos**: reenviar não duplica e apagar não precisa de
  consulta.
- **Escritas idempotentes** para marcas de evento (`arrayUnion`, `increment`).
- **Última escrita vence** em cada documento; como cada aluno só escreve os
  próprios documentos e a sala tem um escritor, não há conflito (a exceção é o
  apresentador com duas abas do projetor abertas).
- **Ordem**: versões de um mesmo documento chegam em ordem; entre documentos
  diferentes não há ordem global, e o projeto não depende dela.
- **Efeitos com dependências estáveis** (ids e booleanos, nunca o objeto da
  sala), para os snapshots não dispararem escritas em cascata.

### Conexão instável, recarregar e trocar de aparelho

| Situação | O que acontece |
| --- | --- |
| A rede cai por alguns segundos | O SDK reconecta sozinho e os ouvintes recebem o estado atual |
| O aluno responde sem rede | A marcação aparece pela compensação local; a escrita fica na fila em memória e sai quando a conexão volta, se a página continuar aberta (não há persistência em disco configurada) |
| O aluno recarrega | O `uid` anônimo continua o mesmo, o nome vem do `localStorage` e a resposta reaparece |
| O aluno troca de aparelho | Ganha outro `uid`: conta como outro participante e começa sem respostas |
| O apresentador recarrega | O token reivindica o controle; slide, cronômetros e revelações estão no documento. Se o tempo acabou com a página fechada, ao abrir ele encerra e avança para o gabarito |
| O projetor fica fechado no meio de uma pergunta | Ninguém encerra a pergunta: os alunos continuam respondendo até o projetor reabrir |
| Uma resposta chega depois do fim da apresentação | As regras recusam (a sala não está mais `live`); a tela do aluno já mostra o fim |

### Custo do sincronismo

Cada mudança entregue a um ouvinte conta como leitura, e o ouvinte de um
documento recebe o documento inteiro. Por isso a sala fica pequena (imagens e
fontes em subcoleções lidas uma vez), cada resposta é um documento próprio (em
vez de contadores na sala, que seriam um único documento disputado por toda a
plateia), o cronômetro grava só o instante final e não há heartbeat de
presença. A [especificação completa](especificacao-completa.md#80-como-o-sincronismo-em-tempo-real-funciona)
traz uma estimativa de operações por aula e como reproduzir este sincronismo
com outra tecnologia (WebSocket, Socket.IO, Supabase Realtime).

## Autenticação

[`useParticipant`](../src/hooks/useParticipant.ts) garante uma sessão anônima:

1. `onAuthStateChanged` informa se já há um usuário neste navegador;
2. sem usuário, `signInAnonymously` cria um;
3. o hook devolve o `uid`.

O uid persiste entre recarregamentos no mesmo navegador. É ele que identifica o
dono da sala e o autor de cada resposta. Nenhum dado pessoal é pedido pelo
Firebase: o nome, quando existe, é digitado pela pessoa e guardado pela
própria aplicação.

## Assinaturas

| Hook | Assina | Quem usa |
| --- | --- | --- |
| [`useRoom`](../src/hooks/useRoom.ts) | `rooms/{code}` | Apresentador e participante |
| [`useResponses`](../src/hooks/useResponses.ts) | `responses` filtradas por `slideId` | Apresentador |
| [`useMyResponse`](../src/hooks/useMyResponse.ts) | `responses/{slideId}__{uid}` | Participante |
| [`useParticipants`](../src/hooks/useParticipants.ts) | `participants` | Apresentador |
| [`useRoomAnswers`](../src/hooks/useRoomAnswers.ts) | `secret/answers` (só o dono lê) | Apresentador |
| [`useRoomAssets`](../src/hooks/useRoomAssets.ts) | `assets/{id}` (leitura única, não é assinatura) | Apresentador e participante |
| [`useRoomFonts`](../src/hooks/useRoomFonts.ts) | `fonts` (uma consulta por versão da sala) | Apresentador e participante |

Todos devolvem a função de cancelamento do `onSnapshot` no cleanup do
`useEffect`, então trocar de slide ou sair da página encerra a escuta.

### Navegação

O apresentador escreve `currentSlideIndex` na sala; os participantes só
**observam**. Como a `RoomPage` usa `key={currentSlide.id}` na `ParticipateView`,
trocar de slide reinicia os controles do participante.

No slide de gabarito, apresentador e participante assinam as respostas do
**`quiz` de origem** (`resultsSlideId`), não as do próprio slide `answer`, que
nunca recebe respostas.

Os atalhos do projetor (setas, `PageDown`, `PageUp` e `Espaço`) não valem
dentro de campos, modais (`[role="dialog"]`) e menus (`[role="menu"]`): lá as
teclas são deles. Numa sala encerrada, a navegação fica desativada.

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
| Volta a um slide esgotado | nada muda: continua em zero |

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
que torna a escrita idempotente) e, na mesma escrita, publica as corretas da
pergunta em `revealedAnswers` (`markAnswerRevealed`). É esse registro que faz
voltar ao gabarito (ou chegar atrasado nele) mostrar a resposta na hora.

> **Por que pausar em vez de deixar correr.** Se o tempo continuasse passando
> fora do slide, pular para uma referência no meio da pergunta queimaria o
> tempo da plateia. E um cronômetro esgotado **não** reinicia ao voltar: a
> pergunta encerrada é para ser revista, não refeita; daí `frozen` em
> `useSlideTimer`, que também impede a troca automática para o gabarito
> disparar de novo.

Duas consequências assumidas:

- **O desvio do relógio não é medido.** A contagem só aparece no projetor, que
  compara o `endsAt` que ele mesmo gravou com o próprio relógio, e o bloqueio
  do voto vem do estado da sala (`closed`), não do relógio do celular. Medir o
  desvio de cada aparelho (com um `serverTimestamp()`) não mudaria nada do que
  a plateia vê. O tempo restante é limitado à duração do slide para nunca
  começar acima dela, e a troca para o gabarito quem decide é o apresentador.
- **O bloqueio do cronômetro é da interface, não das regras.** Ao zerar, os
  controles do participante travam, mas as regras do Firestore não conhecem o
  cronômetro: uma resposta já em trânsito ainda pode ser gravada. As regras
  só barram respostas depois do **fim da apresentação** (sala `ended`). É o
  mesmo nível de confiança do resto da sala: quem tem o código participa.

## Presença

[`src/lib/participants.ts`](../src/lib/participants.ts)

```ts
joinRoom(code, uid, name?)  // getDoc e depois setDoc(..., { merge: true }) em participants/{uid}
```

Chamado pela [`RoomPage`](../src/pages/RoomPage.tsx) assim que a pessoa entra,
antes de qualquer resposta. Lê o documento primeiro: `joinedAt` só vai na
criação; nas reentradas, só `lastSeenAt` (e o nome, se houver). É isso que separa os dois números do rodapé:

- **participantes** = `participants.length` (quem abriu a sala);
- **responderam** = `answeredCount(responses)` (uids distintos com resposta
  naquele slide).

Duas decisões deliberadas:

- **Sem heartbeat.** A escrita acontece na entrada e quando o nome muda. Um
  heartbeat por minuto multiplicaria as escritas por participante sem mudar a
  contagem pedida (“quem conectou já é participante”).
- **Dependência estável no efeito.** O efeito de presença depende de
  `Boolean(room)`, não do objeto `room`, que muda a cada snapshot, inclusive
  quando o apresentador troca de slide. Sem esse cuidado, cada participante
  reescreveria a presença a cada slide.

## Respostas

[`src/lib/responses.ts`](../src/lib/responses.ts)

```ts
saveResponse(code, slideId, uid, type, value, participantName?)  // setDoc: cria ou sobrescreve; lista vazia apaga
clearResponse(code, slideId, uid)                                // deleteDoc
MAX_RESPONSE_ITEMS = 100                                         // itens por resposta (o mesmo limite das regras)
```

O id determinístico `${slideId}__${uid}` garante uma resposta por pessoa por
slide (ver [04](04-modelo-de-dados.md)). `participantName` só é gravado quando a
sala pede identificação: campos `undefined` não são aceitos pelo Firestore, por
isso o spread condicional. Uma lista vazia (a múltipla escolha toda
desmarcada) vira `clearResponse`, para a pessoa não contar em "responderam"
sem ter resposta.

## Controle do apresentador

Ao criar a sala, `createRoom` grava **em lote**:

- `rooms/{code}` com a apresentação (os quizzes sem gabarito) e
  `creatorUid = uid`;
- `rooms/{code}/private/presenter` com `{ token, ownerUid }`;
- `rooms/{code}/secret/answers` com os gabaritos.

O token vai na URL: `/present/<código>/<token>`. Ao abrir essa URL em outro
navegador (ou depois de limpar os dados), `claimPresenter`:

1. faz `update` no documento privado reenviando **o mesmo token** (as regras só
   aceitam se ele bater), e é esse passo que concede o controle;
2. tenta assumir `creatorUid` na sala, para as escritas seguintes não precisarem
   consultar o documento privado (falhar aqui não impede apresentar).

O token também fica no `localStorage`
([`presenterSessions`](../src/lib/presenterSessions.ts)), o que permite à tela
inicial listar as salas apresentadas naquele dispositivo. Ela lê cada sala uma
vez (`getRoom`) para mostrar a situação ("No ar", "Encerrada" ou "Não existe
mais"), oferece “Retomar” só para as que estão no ar e “Exportar PDF” para as
que existem (com os gabaritos lidos por `fetchAnswers`).

## Gabarito protegido

[`src/lib/answers.ts`](../src/lib/answers.ts) ·
[`useRoomAnswers`](../src/hooks/useRoomAnswers.ts)

O documento da sala tem leitura pública (o código é a chave). Se o gabarito
ficasse nele, qualquer participante poderia lê-lo pelas ferramentas do
navegador antes da revelação. Por isso:

| Onde | O que fica |
| --- | --- |
| `rooms/{code}` | Cada `quiz` com `correctOptionIds: []`, `answersHidden: true` e `revealedAnswers` (as corretas já reveladas, pelo id do quiz) |
| `rooms/{code}/secret/answers` | `{ [idDoQuiz]: idsDasCorretas }`, legível só pelo dono atual |

| Função | Papel |
| --- | --- |
| `splitAnswers(slides)` | Separa os gabaritos dos slides (usada por `createRoom` e `saveAndRestartRoom`) |
| `withAnswers(slides, answers)` | Visão do dono: devolve os gabaritos aos slides (projetor, edição, PDF, "Apresentar de novo") |
| `withRevealedAnswers(room)` | Visão da plateia: cada pergunta só com as corretas já publicadas |
| `isAnswerPublished(room, quizId)` | As corretas desta pergunta já chegaram à plateia? |
| `subscribeAnswers` / `fetchAnswers` | Assinatura (projetor) e leitura única (sem permissão, devolve `null`) |

A publicação acontece no fim do suspense: `markAnswerRevealed(code,
answerSlideId, quizSlideId, correctOptionIds)` grava
`revealedAnswers.<idDoQuiz>` (com `FieldPath`, porque o id pode ter caracteres
que um caminho com pontos não aceitaria) junto com `revealedSlideIds:
arrayUnion(answerSlideId)`. No celular, `revealPending = reveal.pending ||
!answerPublished`: se a contagem local terminar antes de a escrita chegar, a
tela continua no suspense até o gabarito existir.

Uma edição salva regrava os gabaritos no mesmo lote da sala e zera
`revealedAnswers`. Salas criadas antes desta proteção não têm `answersHidden`:
nelas, `withRevealedAnswers` e `withAnswers` usam o gabarito do próprio slide.

## Encerramento da sala

[`endRoom` e `setCurrentSlide`](../src/lib/rooms.ts) ·
[`PresentPage`](../src/pages/PresentPage.tsx)

| Gatilho | Escrita |
| --- | --- |
| Avançar do último slide para o slide final | `setCurrentSlide(code, slides.length, timers, { status: 'ended' })` |
| Botão "Encerrar" (com a confirmação "Encerrar a apresentação?") | `endRoom(code, slides.length, timers)`, com o cronômetro do slide no ar pausado |

Índice final e status vão na mesma escrita, então nenhum aparelho vê o slide
final com a sala ainda aberta. Depois disso:

- **Projetor**: navegação desativada, efeitos de cronômetro e revelação
  parados, faixa "A apresentação foi encerrada." com **Apresentar de novo**,
  que lê os gabaritos, monta a apresentação com `loadRoomPresentation`, cria
  uma sala **nova** (`createRoom`) e navega para ela.
- **Celular**: tela final ("Obrigado por participar!"), com **Rever os slides**
  (`/view/<código>`) e, se `settings.allowDownload`, **Baixar slides**.
- **Edição** (`/edit/...`): não abre o editor; mostra que a apresentação foi
  encerrada, com "Voltar à apresentação".
- **Regras**: `update` só com a sala `live`, então a sala encerrada não muda
  mais (nem índice, nem cronômetro, nem dono), e respostas só com a sala
  `live`.

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

Ao abrir, a tela de edição também busca as imagens e as fontes dos slides
livres da sala e guarda o que a sala já tem. Ao salvar, depois da confirmação,
as imagens e fontes novas são enviadas primeiro (para nenhum aparelho ver um
slide sem elas) e então uma única escrita no documento da sala grava:

| Campo | Valor |
| --- | --- |
| `title`, `slides`, `settings` | A versão editada (opções completadas com os padrões) |
| `currentSlideIndex` | `0`: todos voltam ao primeiro slide |
| `timers` | `{}`: os cronômetros recomeçam |
| `revealedSlideIds` | `[]`: os gabaritos voltam a ter o suspense |
| `answersHidden`, `revealedAnswers` | `true` e `{}`: nenhum gabarito publicado |
| `status` | `live` |
| `revision` | `increment(1)` |

A escrita da sala e a dos gabaritos (`secret/answers`) vão num lote
(`writeBatch`): ninguém vê as perguntas novas com o gabarito antigo. Uma sala
encerrada não pode ser editada (as regras recusam o `update`).

Por fim, as imagens e fontes que nenhum slide usa mais são apagadas das
subcoleções (todas as partes de cada fonte); se essa limpeza falhar, só sobra
um arquivo sem uso, nada quebra.

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
- **Nenhuma regra especial.** Gravar a edição é um `update` comum, já
  permitido ao dono atual com a sala no ar. Os gabaritos seguem a regra de
  `secret`, e as imagens a de `assets`, que exigem o mesmo dono.
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

**Escrita.** `createRoom` grava a sala, o documento privado e os gabaritos no
lote atômico de sempre e só depois envia as imagens, porque as regras só deixam o dono da sala
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
| Download dos slides e modo leitura da sala | Todas, na hora de gerar ou de abrir |

Enquanto uma imagem não chega, o lugar dela mostra um espaço reservado cinza;
o slide não espera por ela.

**Tamanho da sala.** Mesmo sem as imagens, a sala pode crescer com muitos
slides livres cheios de texto. `createRoom` e `saveAndRestartRoom` medem o JSON
antes de gravar e, se passar de 1 MB, recusam com uma mensagem que pede para
dividir a apresentação.

## Fontes embutidas

[`src/lib/fonts.ts`](../src/lib/fonts.ts) ·
[`useRoomFonts`](../src/hooks/useRoomFonts.ts) ·
[`src/utils/fonts/faces.ts`](../src/utils/fonts/faces.ts)

As fontes que vieram de um PowerPoint ficam em `rooms/{code}/fonts`, pelo
mesmo motivo das imagens. Uma fonte pode ter alguns megabytes, então cada uma
é dividida em partes de até 700 mil caracteres (`{fontId}`, `{fontId}~1`...).

**Escrita.** `createRoom` envia as fontes junto com as imagens, depois da sala.
Na edição, só as fontes que a sala ainda não tem são enviadas, e as que
deixaram de ser usadas são apagadas, com todas as partes.

**Leitura.** Diferente das imagens, as fontes não são pedidas por id: cada
aparelho faz uma consulta à subcoleção inteira, junta as partes de cada fonte
e registra todas no navegador com `FontFace`, usando o nome da família que os
textos citam. A partir daí o texto já na tela troca de fonte sozinho, sem
precisar desenhar nada de novo. A consulta só acontece quando a sala tem
slides livres, fica guardada em memória e é refeita a cada edição da sala
(`revision`), porque uma edição pode trocar as fontes.

| Tela | Quando lê |
| --- | --- |
| Projetor e celular | Ao abrir a sala e a cada edição |
| Edição da sala | Antes de abrir o editor (e a lista de fontes mostra as embutidas) |
| PDF (projetor e tela inicial) | Antes de gerar, porque os slides livres são desenhados em canvas |

Se uma fonte não carregar, o texto usa a próxima fonte da lista (uma parecida
do sistema): não é um erro de tela.

## Regras de segurança

[`firestore.rules`](../firestore.rules). A pipeline as publica sozinha sempre
que o arquivo muda (job `regras-firestore`, ver
[02](02-arquitetura.md#deploy)); dá para publicá-las à mão no console ou com
`npx firebase-tools deploy --only firestore:rules --project <id>`.

| Caminho | Leitura | Escrita |
| --- | --- | --- |
| `rooms/{code}` | pública (o código é a chave) | criar: autenticado, `creatorUid == uid` e `status == 'live'`; alterar: dono atual **ou** quem reivindicou pelo doc privado, e só com a sala `live`; excluir: o dono |
| `rooms/{code}/private/{doc}` | **negada a todos** | criar: autenticado e `ownerUid == uid`; atualizar: autenticado, reenviando o **mesmo token** e com `ownerUid == uid`; excluir: negado |
| `rooms/{code}/secret/{doc}` | só o dono atual (`isRoomOwner`) | criar e atualizar: o dono, conferido na sala **depois** da escrita (`getAfter`), porque na criação a sala nasce no mesmo lote; excluir: negado |
| `rooms/{code}/participants/{uid}` | pública | criar e atualizar: só o próprio uid (id do doc e `data.uid` precisam bater com `request.auth.uid`), só com as chaves `uid`, `name`, `joinedAt` e `lastSeenAt`, nome até 40 caracteres; excluir: só o próprio uid |
| `rooms/{code}/responses/{id}` | pública | criar e atualizar: `participantUid == uid`, só as chaves de `ResponseDoc`, `slideId` texto de até 200 caracteres, id igual a `slideId + '__' + uid`, `type` `word` ou `choice`, `value` lista de até 100 itens, `createdAt` número, nome até 40 caracteres e sala `live`; excluir: só o autor (sempre) |
| `rooms/{code}/assets/{id}` | pública | criar, atualizar e excluir: autenticado e dono da sala (`isRoomOwner`) |
| `rooms/{code}/fonts/{id}` | pública | criar, atualizar e excluir: autenticado e dono da sala (`isRoomOwner`) |

Consequências práticas:

- Quem tem o código **lê** a sala e os resultados, mas não apresenta.
- Ninguém consegue ler o token de outra pessoa, nem mesmo o dono, depois de
  gravado.
- Ninguém além do dono lê o gabarito antes da revelação.
- Uma sala encerrada não muda mais e não recebe respostas.
- Campos extras, listas enormes e nomes longos são recusados; a resposta não
  pode ser gravada num id que não seja o do próprio autor.
- Ninguém edita nem apaga a resposta alheia, nem forja presença com outro uid.
- Como a leitura das respostas é pública, **não envie dados sensíveis** por
  esses campos: qualquer pessoa com o código pode consultá-los.

As regras podem ser testadas sem tocar no projeto real, com os emuladores do
Firebase: ver [11](11-desenvolvimento.md#emuladores-do-firebase).

## Limites e custos

- Escrita típica por participante: **1 doc de presença** (com uma leitura
  antes) + 1 doc por slide respondido (sobrescrito, não acumulado). Cada
  escrita de resposta custa também uma leitura da sala nas regras (a
  conferência de que ela está no ar).
- Leitura típica do apresentador: 1 assinatura da sala + 1 das respostas do
  slide atual + 1 dos participantes + 1 dos gabaritos.
- O relatório em PDF faz uma leitura única de **todas** as respostas da sala
  (`getAllResponses`).
- Fontes: uma consulta por aparelho e por versão da sala, só em salas com
  slides livres; cada parte conta como uma leitura.
- Imagens: uma leitura por imagem por aparelho, só quando o slide que a usa
  está no ar ou é o próximo. Uma imagem de 900 mil caracteres conta como cerca
  de 900 KB no armazenamento do Firestore (1 GiB no plano gratuito).
- Não há expiração automática: salas, respostas, imagens e fontes antigas
  ficam no Firestore até serem apagadas manualmente.
