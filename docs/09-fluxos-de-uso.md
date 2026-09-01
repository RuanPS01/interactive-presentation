# 09 — Fluxos de uso

## Apresentador: da criação à exportação

1. **Início → “Criar sala”** (`/create`). O editor abre vazio, com o título
   “Minha apresentação”.
2. **Monta os slides** na coluna 1 (5 tipos criáveis), configura na coluna 2 e
   confere na coluna 3, que mostra a prévia com as fontes reais.
3. **Ajusta as opções** em **Opções** (globais) e, se precisar, em “Opções deste
   slide” (individuais) — ver [06](06-configuracoes.md).
4. *(Opcional)* **Prompt de IA** → cola num assistente, salva a resposta como
   `.json` e usa **Importar JSON**. Ou **Exportar JSON** para guardar o que
   montou (o editor não persiste ao recarregar).
5. **Iniciar apresentação**:
   - autentica anonimamente (se ainda não estiver);
   - `createRoom` sorteia um código livre e grava sala + token;
   - a sessão é salva no `localStorage` deste dispositivo;
   - navega para `/present/<código>/<token>`.
6. **Apresenta**: `→`, `PageDown` ou `Espaço` avançam; `←` e `PageUp` voltam
   (funciona com passador de slides). Os botões do cabeçalho fazem o mesmo, e o
   cabeçalho pode ser ocultado (reaparece ao encostar o mouse no topo).
7. **Compartilha**: o código aparece grande no cabeçalho; clicar no QR abre o
   modal com o QR ampliado, o **link curto** e o link completo.
8. **Acompanha ao vivo**: gráficos e nuvem se atualizam a cada resposta; o
   rodapé mostra “N participantes · M responderam · …”.
9. **Passa do último slide** → slide final de agradecimento, com a grade de
   miniaturas, e o **PDF de resultados baixa automaticamente** (uma vez por
   sessão). O botão **Exportar PDF** gera o mesmo relatório a qualquer momento.

### Retomar uma sala

A tela inicial lista as salas apresentadas naquele dispositivo:
**Retomar** volta para `/present/<código>/<token>` e **Exportar PDF** rebaixa o
relatório sem reabrir a apresentação. Abrir a URL com o token em **outro**
navegador também funciona: `claimPresenter` prova o token e transfere o
controle.

## Participante: da entrada à resposta

1. **Entra** pelo QR, pelo link curto ou por “Entrar na sala” + código
   (`/join` normaliza para maiúsculas e sem espaços).
2. **Nome** (se a sala pedir): preenche uma vez; fica salvo por sala neste
   dispositivo.
3. **Presença**: assim que a tela do slide abre, o participante é registrado em
   `participants/{uid}` — já conta no número do apresentador, mesmo sem
   responder nada.
4. **Responde** conforme o tipo do slide:
   - nuvem de palavras: digita textos (palavra ou frase) e envia;
   - barras/pizza/alternativas: toca na opção; a resposta é gravada na hora;
   - gabarito: vê se acertou;
   - texto: só acompanha.
5. **Troca a resposta** (se permitido): “Limpar resposta” / “Limpar tudo”, ou
   simplesmente escolhe outra opção. Se não for permitido, a resposta trava
   depois do primeiro envio.
6. **A tela acompanha o apresentador** automaticamente. Ao fim, aparece o
   agradecimento.

## Ciclo de uma resposta

```
Participante toca na opção
      |
      v
saveResponse() -> setDoc em rooms/{code}/responses/{slideId}__{uid}
      |
      +--> onSnapshot do apresentador (useResponses)
      |         -> aggregateChoices -> gráfico/quadro se redesenha
      |
      +--> onSnapshot do próprio participante (useMyResponse)
                -> o botão aparece marcado (e reflete em outras abas dele)
```

Não há confirmação nem botão “enviar” nos slides de escolha: o toque **é** o
envio, e o estado exibido vem sempre do Firestore — nunca de um estado local
otimista. É isso que mantém abas e dispositivos do mesmo participante em sincronia.

## Fluxo de pergunta e resposta (`quiz` + `answer`)

1. O apresentador cria um slide **Alternativas (sem gráfico)**, escreve a
   pergunta, marca a alternativa correta e liga **“Adicionar um slide de
   resposta logo depois”** — o gabarito aparece na lista, recuado.
2. Na apresentação, o slide da pergunta mostra as alternativas grandes, sem
   revelar a distribuição (só quantos já votaram), com a contagem regressiva
   logo abaixo do enunciado.
3. Os participantes votam pelo celular enquanto há tempo.
4. **O tempo acaba**: os controles do celular travam e a apresentação passa
   sozinha para o gabarito. (Sem cronômetro — `0` segundos — o apresentador
   avança quando quiser.)
5. Por 3 segundos a tela mostra **“A resposta certa é…”**, ganhando um ponto por
   segundo, e só então o gabarito destaca a correta em verde com votos e
   porcentagem por alternativa. No celular, cada pessoa vê se acertou.

## O que acontece em situações de borda

| Situação | Comportamento |
| --- | --- |
| Participante abre `/present/<código>` sem token | Tela “Acesso de apresentador necessário”, com atalho para entrar como participante |
| Código inexistente | “Sala não encontrada. Verifique o código com o apresentador.” |
| Apresentador recarrega a página | O token na URL reivindica o controle de volta |
| Apresentação sem slides | “Esta apresentação ainda não tem slides.” |
| Firebase sem configuração (`.env` vazio) | A interface carrega normalmente e mostra um aviso; só as chamadas de rede falham |
| Encurtador indisponível (ou `localhost`) | O modal mostra o link completo e um botão “Tentar de novo” |
| Gabarito cuja pergunta foi removida | “A pergunta deste gabarito não existe mais.” (o editor remove órfãos sozinho) |
| Tempo esgotado sem slide de gabarito depois | A pergunta continua no ar, já travada para novas respostas; o apresentador avança |
| Apresentador sai de uma pergunta no meio da contagem | O cronômetro pausa; voltar retoma de onde parou |
| Apresentador volta para uma pergunta que já zerou | Continua zerada: sem contagem nova, respostas congeladas e sem avanço automático |
| Apresentador volta para um gabarito já revelado | A resposta aparece na hora, sem repetir os 3 s de suspense |
| Apresentador sai do gabarito antes dos 3 s | Nada foi revelado ainda: voltar refaz o suspense |
| Apresentador recarrega com o tempo já esgotado | A apresentação passa direto para o gabarito |
