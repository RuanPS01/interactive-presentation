# 05 — Tipos de slide

Seis tipos. Cinco são adicionados pelo apresentador; o `answer` é gerado
automaticamente.

| Tipo | Rótulo na interface | Interativo | Criável no menu |
| --- | --- | --- | --- |
| `wordcloud` | Nuvem de palavras | sim | sim |
| `bar` | Gráfico de barras | sim | sim |
| `pie` | Gráfico de pizza | sim | sim |
| `quiz` | Alternativas (sem gráfico) | sim | sim |
| `answer` | Resposta correta | não (usa os dados do `quiz`) | **não** — automático |
| `text` | Texto simples | não | sim |

Valores padrão: [`src/utils/slideFactory.ts`](../src/utils/slideFactory.ts).
Exibição no projetor: [`src/components/slides/SlideDisplay.tsx`](../src/components/slides/SlideDisplay.tsx).
Controles do participante: [`src/components/participate/ParticipateView.tsx`](../src/components/participate/ParticipateView.tsx).

---

## `wordcloud` — Nuvem de palavras

```ts
{ type: 'wordcloud', wordLimitMode: 'one' | 'range' | 'unlimited', maxWords: number }
```

O participante envia textos curtos; eles aparecem com tamanho proporcional à
frequência.

- `wordLimitMode`: `unlimited` (padrão), `one` (um envio) ou `range` (até
  `maxWords`, 1–50).
- Envios repetidos pela **mesma pessoa** são recusados (comparação sem
  diferenciar maiúsculas/minúsculas), para ninguém inflar o próprio voto.
- O campo aceita **palavra ou frase** (até 80 caracteres) — a interface diz
  “Entre com seu texto” justamente para não sugerir uma única palavra.
- Com “permitir limpar e trocar a resposta” ligado, o participante remove
  itens individualmente ou usa “Limpar tudo”.

O layout ([`WordCloudView`](../src/components/charts/WordCloudView.tsx)) é
próprio: mede a caixa de tinta de cada palavra num canvas, posiciona em espiral
(testando alguns alongamentos para preencher a área disponível) e reescala o
conjunto para caber sem cortar. O layout é refeito a cada atualização — as
palavras se reacomodam em vez de crescer umas sobre as outras — com transição
em CSS.

## `bar` — Gráfico de barras

```ts
{ type: 'bar', options: ChoiceOption[], allowMultiple: boolean }
```

Votação com resultado em barras verticais, contador acima de cada barra e
rótulos quebrados em até 4 linhas. `allowMultiple` alterna entre caixas de
seleção e escolha única.

## `pie` — Gráfico de pizza

```ts
{ type: 'pie', options: ChoiceOption[], allowMultiple: boolean }
```

Mesmos campos de `bar`. Só fatia opções com votos; cada fatia mostra a
porcentagem e a contagem, e a legenda abaixo traz o rótulo completo. Prefira
pizza quando as opções são mutuamente exclusivas.

## `quiz` — Alternativas (sem gráfico)

```ts
{
  type: 'quiz',
  options: ChoiceOption[],
  allowMultiple: boolean,
  correctOptionIds: string[],   // vazio = pergunta sem gabarito
  revealAnswer: boolean,        // mantém um slide `answer` logo depois
}
```

Formato de **pergunta e resposta**. As alternativas aparecem grandes no centro
da tela do apresentador (com letras A, B, C…) e também na tela dos
participantes — **sem gráfico**.

Por padrão a distribuição fica **oculta**, para não entregar a resposta enquanto
a pergunta está no ar: o rodapé mostra só quantas pessoas já votaram. Ligando
**"Mostrar as respostas dos participantes na tela do apresentador"**
(`showResponses`), cada alternativa passa a exibir votos e porcentagem ao vivo —
e, se a sala identificar as respostas, a lista de nomes aparece junto. Com a
opção desligada essa lista fica suprimida mesmo com a identificação ativa, já
que mostrar "Ana: Lista" revelaria a resposta do mesmo jeito.

### Cronômetro

Por padrão a pergunta fica no ar por **20 segundos** (opção global
`quizTimerSeconds`, com tempo próprio por slide — ver
[06](06-configuracoes.md#cronômetro-das-perguntas)).

A contagem aparece **só no projetor**, num card na base do slide (acima do
rodapé) com os segundos grandes e os milissegundos ao lado, vermelho nos
últimos 5 segundos. No celular ela não aparece: o relógio de cada aparelho
diverge do relógio de quem apresenta, e duas contagens diferentes na mesma sala
confundem mais do que ajudam.

Ao zerar **no projetor**:

1. o apresentador encerra a pergunta para a sala inteira;
2. os controles do participante travam (“Tempo esgotado — as respostas foram
   encerradas”);
3. se houver um slide `answer` logo depois, a apresentação avança sozinha.

A ordem importa: quem trava a plateia é o encerramento gravado na sala, nunca a
conta do próprio celular. Um aparelho adiantado travaria as opções segundos
antes de o tempo acabar na tela grande.

O cronômetro **acompanha o slide, não a apresentação**:

| O apresentador… | O cronômetro… |
| --- | --- |
| sai da pergunta no meio da contagem | **pausa** — nada corre enquanto ele está fora |
| volta para essa pergunta | **retoma de onde parou** |
| volta para uma pergunta que já zerou | **continua zerado** — sem contagem nova, e as respostas seguem congeladas como estavam |

A última linha é o que permite revisitar uma pergunta encerrada para comentá-la
sem reabrir a votação — e sem que a apresentação pule sozinha para o gabarito
de novo.

No editor ([`QuizConfig`](../src/components/editor/QuizConfig.tsx)) cada
alternativa tem um marcador de “correta” ao lado: caixa de seleção quando
`allowMultiple`, botão de opção quando não (clicar de novo desmarca e volta a
“sem gabarito”). Desligar `allowMultiple` mantém no máximo um gabarito; remover
uma alternativa remove o gabarito correspondente.

## `answer` — Resposta correta (automático)

```ts
{ type: 'answer', quizSlideId: string }
```

Não tem conteúdo próprio: aponta para o `quiz` e reexibe as alternativas com a
correta destacada em verde, mais **votos e porcentagem por alternativa**. No
celular, o participante vê “Você acertou!” / “Não foi dessa vez”, quais eram as
corretas e qual foi a sua escolha.

### Suspense antes de revelar

O gabarito não aparece de imediato: por **3 segundos** a tela mostra, no
centro, **“A resposta certa é…”** — e as reticências são a própria contagem,
ganhando um ponto por segundo. Só então as alternativas surgem.

O atraso não é enfeite: cada celular recebe a troca de slide com alguns
milissegundos de diferença, e sem ele quem tem a conexão mais rápida veria a
resposta antes dos colegas. A contagem é local
([`useRevealCountdown`](../src/hooks/useRevealCountdown.ts)).

**Só a primeira vez.** Quando o suspense termina, o apresentador registra o
slide em `room.revealedSlideIds`. A partir daí o gabarito abre direto:

| Situação | O que aparece |
| --- | --- |
| 1ª vez no gabarito | 3 s de “A resposta certa é…” e então a resposta |
| Voltar depois de revelado | A resposta na hora — não há mais nada a sincronizar |
| Sair antes dos 3 s e voltar | O suspense recomeça: a revelação não chegou a acontecer |
| Participante que chega atrasado | A resposta na hora, sem esperar por uma contagem que já passou |

### Ciclo de vida

Gerenciado por `syncAnswerSlides` em
[`src/store/editorStore.ts`](../src/store/editorStore.ts), reaplicado depois de
toda alteração na lista:

| Ação no editor | Efeito |
| --- | --- |
| Ligar “Adicionar um slide de resposta” | Insere o `answer` logo depois do `quiz` |
| Desligar a opção | Remove o `answer` |
| Mover o `quiz` | O `answer` acompanha, sempre logo atrás |
| Apagar o `answer` pela lista | Equivale a desligar a opção no `quiz` |
| Apagar o `quiz` | O `answer` órfão é removido junto |

O slide reaproveitado preserva id, título e sobrescritas — desligar e religar a
opção não perde o que foi personalizado na mesma sessão. Na lista, o gabarito
aparece recuado, com ícone de vínculo e sem botões de mover.

> Ele **é** um slide de verdade na apresentação: ocupa um índice, aparece para
> os participantes e é exportado no JSON. No relatório PDF, porém, não vira
> página própria — a página da pergunta já sai com a alternativa correta
> marcada.

## `text` — Texto simples

```ts
{ type: 'text', content: string, align: 'left'|'center'|'right', fontSize: number }
```

Slide de conteúdo, sem interação. Use para abertura, explicações e transições.
O participante vê o texto na tela do celular.

O `fontSize` do próprio slide **é** o tamanho do corpo: neste tipo, a opção
global/por slide “Tamanho do corpo” fica desativada e cede lugar ao controle
existente (ver [06](06-configuracoes.md)).
