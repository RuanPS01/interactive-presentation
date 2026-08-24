# 10 — Exportações e integrações

## Exportar / importar JSON

[`src/utils/importExport.ts`](../src/utils/importExport.ts) ·
[`src/utils/validation.ts`](../src/utils/validation.ts)

- **Exportar JSON** serializa o `Presentation` inteiro (título, slides e opções
  globais) e baixa um arquivo com nome derivado do título (sem acentos nem
  símbolos).
- **Importar JSON** lê o arquivo, valida com Zod e carrega no editor. Erros são
  mostrados no formato `caminho: mensagem`, apontando o campo problemático.

O formato e as garantias de compatibilidade estão em
[04 — Modelo de dados](04-modelo-de-dados.md#formato-json-importexport).

> A importação **substitui** o conteúdo do editor. Exporte antes se não quiser
> perder o que estava montado.

## Exportar PDF dos resultados

[`src/utils/exportPdf.ts`](../src/utils/exportPdf.ts)

Relatório vetorial gerado no próprio navegador. A jsPDF é importada
dinamicamente, então só é baixada quando alguém exporta.

Estrutura:

1. **Capa** — faixa azul, título, data/hora, número de slides e quantos
   participantes responderam.
2. **Uma página por slide** (com quebra automática quando não cabe):
   - `bar`/`pie`: barra horizontal por opção, com votos e porcentagem;
   - `quiz`: o mesmo, com a alternativa correta em **verde** e marcada como
     `[correta]`;
   - `wordcloud`: os textos enviados, com tamanho proporcional à frequência;
   - `text`: o conteúdo, respeitando o alinhamento;
   - `answer`: **não vira página** — a página da pergunta já traz o gabarito.
3. **Uma página de tabela logo depois de cada slide interativo que recebeu
   respostas**, com o que cada pessoa respondeu:

   | Participante | Resposta | Resultado |
   | --- | --- | --- |
   | Ana Paula | Lista | Correta |
   | Bruno | Conjunto | Incorreta |

   - A coluna **Resultado** só aparece em perguntas (`quiz`) com gabarito.
   - Com nomes coletados, as linhas vêm em **ordem alfabética**; sem nomes, a
     tabela cai para **“Participante N”**, numerado pela ordem de chegada das
     respostas — assim a página continua útil sem inventar uma identidade que
     ninguém informou.
   - Tabelas longas quebram em várias páginas, **repetindo o cabeçalho**.
4. **Rodapé** com “N responderam · M voto(s)” na página do slide, e com o total
   de participantes na página da tabela.

> A tabela sai no relatório mesmo com a identificação desligada nas opções.
> Essa opção controla o que aparece **no projetor**, à vista da plateia; o PDF é
> o material do apresentador.

Quando é gerado:

- automaticamente ao chegar no slide final (uma vez por sessão);
- pelo botão **Exportar PDF** no cabeçalho do apresentador;
- pela tela inicial, em qualquer sala apresentada naquele dispositivo.

## Prompt de IA

[`src/utils/aiPrompt.ts`](../src/utils/aiPrompt.ts) ·
[`AiPromptButton`](../src/components/editor/AiPromptButton.tsx)

Texto pronto que descreve **todo o formato JSON aceito** — campos comuns, os
seis tipos de slide, as opções globais, as sobrescritas por slide, as regras de
preenchimento e um exemplo completo válido. O fluxo é: copiar → colar no
assistente → trocar o tema → salvar a resposta como `.json` → **Importar JSON**.

O prompt instrui explicitamente a IA a **não** gerar slides `answer`: eles são
criados pela plataforma a partir do `revealAnswer` do `quiz`.

> Ao mexer em `utils/validation.ts`, atualize este prompt — ele é a
> documentação que a IA lê.

## Encurtador do link da sala

[`src/lib/shortUrl.ts`](../src/lib/shortUrl.ts) ·
[`ShareRoom`](../src/components/present/ShareRoom.tsx)

O modal do QR mostra o link curto **em texto grande**, para quem prefere digitar
a apertar a câmera.

Como funciona:

1. Ao abrir o modal, a aplicação encurta o link de entrada da sala.
2. O resultado vai para o `localStorage`, indexado pela URL longa: reabrir o
   modal não cria um link novo.
3. O texto exibido perde o `https://` e o `www.` (fica, por exemplo,
   `tinyurl.com/2xoh2ngp`).
4. Se falhar, o modal mostra o link completo e um botão **“Tentar de novo”**.

### Decisões

- **O QR sempre codifica a URL completa.** Se o encurtador sair do ar, a câmera
  continua funcionando; o link curto é uma conveniência, não uma dependência.
- **Serviço: TinyURL.** Sendo um site estático, a chamada sai do navegador e o
  serviço precisa responder com CORS liberado. Entre os encurtadores públicos
  testados (**is.gd, cleanuri, spoo.me, ulvis**), só o TinyURL envia
  `Access-Control-Allow-Origin` — os demais são bloqueados pelo navegador. O
  redirecionamento do TinyURL **preserva o fragmento** `#/room/<código>`, que o
  `HashRouter` exige.
- **Só sob demanda.** A URL da sala só é enviada ao serviço externo quando o
  apresentador abre o QR — não em toda visita à página.
- **Em `localhost` o encurtamento falha** (o serviço recusa endereços locais).
  É esperado em desenvolvimento: a interface cai no link completo.
