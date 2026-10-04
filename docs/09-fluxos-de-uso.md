# 09 — Fluxos de uso

## Apresentador: da criação à exportação

1. **Início → “Criar sala”** (`/create`). O editor abre vazio, com o título
   “Minha apresentação”.
2. **Monta os slides** na coluna 1 (6 tipos criáveis), configura na coluna 2 e
   confere na coluna 3, que mostra a prévia com as fontes reais, na proporção
   escolhida (16:9 ou 4:3). No slide livre, a própria prévia é editável.
3. **Ajusta as opções** em **Opções** (globais) e, se precisar, em “Opções deste
   slide” (individuais) — ver [06](06-configuracoes.md).
4. *(Opcional)* **Prompt de IA** → cola num assistente, salva a resposta como
   `.json` e usa **Importar**, opção "Apresentação (.json)". Ou importa um
   PowerPoint (ver abaixo). **Exportar** guarda o que montou: em JSON, com as
   imagens e as fontes, para importar de volta; ou em PowerPoint, para abrir
   em outros programas (o editor não persiste ao recarregar).
5. **Iniciar apresentação**:
   - usa o uid anônimo obtido ao abrir a página (se a conexão ainda não
     terminou, pede para aguardar um instante; sem slides, pede para
     adicionar ao menos um);
   - `createRoom` sorteia um código livre e grava sala + token, e depois as
     imagens e as fontes dos slides livres nas subcoleções `assets` e `fonts`;
   - a sessão é salva no `localStorage` deste dispositivo;
   - navega para `/present/<código>/<token>`.
6. **Apresenta**: `→`, `PageDown` ou `Espaço` avançam; `←` e `PageUp` voltam
   (funciona com passador de slides). Os botões do cabeçalho fazem o mesmo, e o
   cabeçalho pode ser ocultado (reaparece ao encostar o mouse no topo).
7. **Compartilha**: o código aparece grande no cabeçalho; clicar no QR abre o
   modal com o QR ampliado, o código e o **link curto** em letra grande (um
   botão alterna para o link completo, e outro copia o link em destaque).
8. **Acompanha ao vivo**: gráficos e nuvem se atualizam a cada resposta; o
   rodapé mostra “N participantes · M responderam · …”.
9. **Passa do último slide** → slide final de agradecimento, com a grade de
   miniaturas e, no centro, o botão **Baixar resultados (PDF)**. Nada baixa
   sozinho: o PDF só é gerado quando o apresentador pede. O botão **Exportar
   PDF** do cabeçalho gera o mesmo relatório a qualquer momento.

### Importar um PowerPoint

1. **Importar** abre o modal com as duas opções. Em "PowerPoint (.pptx)",
   escolha antes onde os slides entram: **Adicionar ao fim** (padrão) ou
   **Substituir tudo**. O arquivo pode ser escolhido ou arrastado para a opção.
2. O leitor ([`src/utils/pptx`](../src/utils/pptx/index.ts)) é baixado nessa
   hora e lê o arquivo no próprio navegador, sem enviar nada a servidor. O
   modal mostra o progresso slide a slide.
3. Para cada slide visível, o leitor percorre o slide, o layout e o mestre e
   monta um slide livre: textos viram caixas de texto editáveis, fotos viram
   imagens, e formas, fundos, tabelas, gráficos e SmartArt são desenhados num
   canvas e viram imagens (itens gráficos vizinhos viram uma imagem só). Ver a
   tabela em [05](05-tipos-de-slide.md#o-que-vem-de-um-powerpoint).
4. Toda imagem é comprimida e identificada pelo conteúdo; uma imagem repetida
   em vários slides (um logotipo do mestre, por exemplo) é guardada uma vez.
5. No fim, o modal mostra quantos slides e imagens entraram e os avisos do que
   não pôde ser reproduzido. **Concluir** fecha e deixa o primeiro slide novo
   selecionado.

Formato: com "Substituir tudo", ou com o editor vazio, a apresentação adota o
formato do arquivo (16:9 ou 4:3). Adicionando ao fim de uma apresentação em
outro formato, os slides importados mantêm o tamanho do arquivo e aparecem com
faixas nas bordas; o modal avisa. Um PowerPoint numa proporção que não é 16:9
nem 4:3 (16:10, A4) também mantém a própria proporção.

Avisos que podem aparecer:

| Aviso | Motivo |
| --- | --- |
| Imagens em formato EMF, WMF ou TIFF ficaram de fora | Navegadores não desenham esses formatos |
| Textos verticais foram importados na horizontal | O slide livre só tem texto horizontal |
| Vídeos e áudios viraram apenas a imagem de capa | A plataforma não reproduz mídia |
| Gráficos viraram imagens simplificadas | São redesenhados a partir dos dados salvos no arquivo, com estilo próprio |
| SmartArt virou imagem (ou ficou de fora, sem desenho salvo) | O desenho salvo pelo PowerPoint é usado; sem ele, não há o que desenhar |
| Alguns objetos ficaram de fora | Objetos OLE, controles e afins |
| N slide(s) oculto(s) ficaram de fora | Slides marcados como ocultos não entram |
| Não foi possível usar a(s) fonte(s) embutida(s) X | O arquivo da fonte está corrompido ou num formato que o navegador recusa |

**Fontes.** As fontes que o PowerPoint embutiu no arquivo (Arquivo, Opções,
Salvar, "Incorporar fontes no arquivo") são aproveitadas: o modal lista as
famílias no resultado, e o texto passa a usá-las no editor, no projetor, no
celular e no PDF. O PowerPoint guarda essas fontes em EOT, quase sempre
comprimidas no formato MicroType Express; o leitor descomprime tudo no próprio
navegador ([`src/utils/fonts/`](../src/utils/fonts/mtx.ts)). Com "Incorporar
somente os caracteres usados", a fonte vem só com as letras do arquivo:
letras novas digitadas depois aparecem numa fonte parecida.

As fontes que não vieram embutidas são mantidas só pelo nome; se o aparelho
não tiver a fonte, o navegador usa uma parecida, e as quebras de linha podem
mudar um pouco.

### Exportar um PowerPoint

1. **Exportar** abre o modal com as duas opções. "Apresentação (.json)" baixa
   na hora; "PowerPoint (.pptx)" gera o arquivo no navegador (o gerador é
   baixado nessa hora) e começa o download.
2. O arquivo sai no formato da apresentação (16:9 ou 4:3). Slides livres em
   outra proporção são reenquadrados para caber, sem distorcer.
3. No fim, o modal mostra os avisos: as perguntas viraram slides estáticos e,
   se for o caso, alguma fonte não pôde ser embutida.

O que cada slide vira está em [10](10-exportacoes.md#exportar-powerpoint).

### Montar um slide livre do zero

1. **Adicionar slide** e escolha "Slide livre". Ele nasce com fundo branco,
   no formato da apresentação, e um título de exemplo ("Clique duas vezes para
   editar").
2. **Adicionar texto** cria uma caixa nova, já em edição. **Adicionar
   imagem** (ou arrastar arquivos para a prévia, ou colar com Ctrl+V) insere as
   imagens comprimidas.
3. Arraste os elementos e use as alças para redimensionar; as guias mostram o
   alinhamento com o slide e com os outros elementos.
4. Clique duas vezes num texto para editar. Selecione um trecho e use a barra
   de texto do painel (ou Ctrl+B, Ctrl+I, Ctrl+U) para formatar só ele; sem
   seleção, a formatação vale para a caixa inteira.
5. Para mais espaço, **Ampliar** abre o editor na tela inteira.

### Retomar uma sala

A tela inicial lista as salas apresentadas naquele dispositivo:
**Retomar** volta para `/present/<código>/<token>` e **Exportar PDF** rebaixa o
relatório sem reabrir a apresentação. Abrir a URL com o token em **outro**
navegador também funciona: `claimPresenter` prova o token e transfere o
controle.

### Editar uma sala em andamento

1. Na tela de apresentação, **Editar** abre o mesmo editor da criação, já com o
   que está no ar: título, opções gerais (botão **Opções**), slides e as opções
   de cada slide. Uma faixa no topo lembra que a sala está em andamento.
2. Enquanto o apresentador edita, nada muda para a plateia: cada pessoa continua
   no slide em que estava.
3. **Salvar alterações** só fica ativo quando algo mudou. Ao clicar, uma
   confirmação diz quantos participantes estão na sala e avisa que todos serão
   redirecionados para o início da apresentação, assim como o apresentador.
4. Confirmando, a sala é gravada e recomeça do primeiro slide: o apresentador
   volta para a tela de apresentação no slide 1, e os celulares vão para o
   slide 1 com o aviso "O apresentador atualizou a apresentação e todos
   voltaram para o início". Cronômetros recomeçam, gabaritos voltam a ter o
   suspense, e as respostas já enviadas continuam guardadas.
5. **Voltar à apresentação** com alterações não salvas pede para descartá-las;
   descartando, a sala fica como estava e ninguém é redirecionado.

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
   - texto e slide livre: só acompanha.
5. **Troca a resposta** (se permitido): “Limpar resposta” / “Limpar tudo”, ou
   simplesmente escolhe outra opção. Se não for permitido, a resposta trava
   depois do primeiro envio.
6. **A tela acompanha o apresentador** automaticamente. Ao fim, aparece o
   agradecimento.

## Ciclo de uma resposta

1. O participante toca na opção.
2. `saveResponse()` faz `setDoc` em `rooms/{code}/responses/{slideId}__{uid}`;
   os botões ficam ocupados até a confirmação.
3. O ouvinte do próprio participante (`useMyResponse`) recebe na hora a
   versão local da escrita: o botão aparece marcado (e reflete em outras abas
   dele).
4. O Firestore valida pelas regras e confirma.
5. O ouvinte do apresentador (`useResponses`) recebe a mudança;
   `aggregateChoices` recalcula e o gráfico ou o quadro se redesenha.

Não há confirmação nem botão "enviar" nos slides de escolha: o toque **é** o
envio, e o estado exibido vem sempre de um snapshot do Firestore, nunca de um
estado local otimista guardado pela aplicação. A marcação aparece na hora
porque o próprio SDK do Firestore entrega a escrita pendente ao ouvinte local
(compensação de latência). É isso que mantém abas e dispositivos do mesmo
participante em sincronia. O mecanismo completo está em
[07](07-tempo-real-e-comunicacao.md#como-o-sincronismo-funciona).

## Fluxo de pergunta e resposta (`quiz` + `answer`)

1. O apresentador cria um slide **Alternativas (sem gráfico)**, escreve a
   pergunta, marca a alternativa correta e liga **“Adicionar um slide de
   resposta logo depois”** — o gabarito aparece na lista, recuado.
2. Na apresentação, o slide da pergunta mostra as alternativas grandes, sem
   revelar a distribuição (só quantos já votaram), com o card do cronômetro na
   base da tela.
3. Os participantes votam pelo celular enquanto há tempo. O celular não mostra
   contagem: quem marca o tempo é o projetor.
4. **O tempo acaba no projetor**: o apresentador encerra a pergunta, os
   controles do celular travam e a apresentação passa sozinha para o gabarito.
   (Sem cronômetro — `0` segundos — o apresentador avança quando quiser.)
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
| Relógio do celular adiantado ou atrasado | Não muda nada: a votação só trava quando o projetor encerra a pergunta |
| Apresentador sai de uma pergunta no meio da contagem | O cronômetro pausa; voltar retoma de onde parou |
| Apresentador volta para uma pergunta que já zerou | Continua zerada: sem contagem nova, respostas congeladas e sem avanço automático |
| Apresentador volta para um gabarito já revelado | A resposta aparece na hora, sem repetir os 3 s de suspense |
| Apresentador sai do gabarito antes dos 3 s | Nada foi revelado ainda: voltar refaz o suspense |
| Apresentador recarrega com o tempo já esgotado | A apresentação passa direto para o gabarito |
| Apresentador salva uma edição da sala | Todos (inclusive ele) voltam ao primeiro slide; cronômetros e gabaritos recomeçam; respostas ficam |
| A edição liga "Solicitar o nome" | Quem já estava na sala sem nome vê o pedido de nome antes do primeiro slide |
| A edição remove o slide em que a plateia estava | Não há problema: todos voltam ao primeiro slide de qualquer forma |
| Participante entra depois de uma edição | Vê a sala atualizada, sem o aviso de reinício |
| Alguém abre `/edit/<código>` sem o token | Tela "Acesso de apresentador necessário", igual à da apresentação |
| A edição esvazia a lista de slides | Salvar é recusado: a apresentação precisa de ao menos um slide |
| Imagem de um slide livre ainda não chegou ao celular | O lugar dela mostra um espaço reservado cinza até a imagem chegar; o resto do slide aparece na hora |
| Imagem que não existe mais na sala | Fica o espaço reservado cinza, com o ícone de imagem ausente, sem quebrar o slide |
| A apresentação passa de 1 MB sem contar as imagens | Criar ou salvar é recusado com o tamanho e a sugestão de dividir a apresentação |
| A sala é criada, mas o envio das imagens falha | A mensagem diz que a sala existe sem as imagens; reabrir a edição e salvar envia de novo |
| Arquivo .ppt antigo, ou outro arquivo na opção de PowerPoint | Recusado, com a orientação de salvar como .pptx |
| Arquivo .pptx na opção de JSON | É lido como PowerPoint |
| PowerPoint sem slides visíveis | "O arquivo não tem slides visíveis para importar." |
| Fonte embutida que o navegador recusa | Fica de fora com um aviso; o texto usa uma fonte parecida |
| Fonte maior que um documento do Firestore | É dividida em partes na sala e remontada em cada aparelho |
| Texto com uma fonte embutida apagado na edição da sala | A fonte deixa de ser usada e é apagada da sala ao salvar |
| Fonte OpenType (CFF) na exportação para PowerPoint | Não é embutida (o PowerPoint só embute TrueType); o modal avisa |
| Troca de formato com slides livres | Os slides livres no formato antigo são reenquadrados para caber, sem distorcer |
