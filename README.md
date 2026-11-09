# Dashboard de Estoque e Planejamento de Compras

Esta é uma cópia independente do dashboard baseado na planilha de explosão. O projeto funciona no navegador, não utiliza OAuth, banco de dados remoto, tRPC ou serviços externos, e mantém os dados no ficheiro `data/explosao.json`.

## Como abrir no VS Code

Abra a pasta deste projeto no VS Code ou no Explorador de Ficheiros. No Windows, dê dois cliques em `start-local.bat`. O script verifica o Python, inicia o servidor local na porta 5502 e abre automaticamente o navegador no endereço correto. Se o servidor já estiver ligado, ele não cria outro servidor e apenas abre o dashboard. O script também procura automaticamente o `index.html` dentro das subpastas e inicia o Python com essa pasta como diretório de trabalho explícito, evitando o erro 404 quando o ZIP é extraído dentro de uma pasta adicional.

Também é possível usar a extensão **Live Server** do VS Code. Abra `index.html`, clique com o botão direito sobre o ficheiro e escolha **Open with Live Server**. Nesse caso, utilize a porta mostrada no canto inferior direito do VS Code.

Quando usar o script do projeto, abra:

```text
http://127.0.0.1:5502/index.html
```

Não abra o ficheiro diretamente com `file://`. O navegador bloqueia a leitura de `data/explosao.json` quando a página não é servida por um servidor local. Se aparecer `404 File not found`, feche a janela antiga do servidor e use o `start-local.bat` da nova versão.

Para permitir acesso pela mesma rede Wi‑Fi, descubra o IPv4 do computador com `ipconfig` no Windows. Os colegas poderão abrir `http://SEU_IPV4:5502/index.html`, por exemplo `http://192.168.1.25:5502/index.html`. A janela do servidor pode permanecer aberta enquanto o dashboard estiver em uso. Se ela for fechada, dê novamente dois cliques em `start-local.bat`.

## Como atualizar os dados da planilha

O navegador não lê automaticamente uma planilha Excel local por motivos de segurança. Para atualizar os dados no Windows, arraste o novo ficheiro `.xlsm` sobre `atualizar-dados.bat`. O script chama o orquestrador completo e regrava `data/explosao.json`, `data/plano-mes.json`, `data/pinos.json`, `data/cilindros.json` e `data/historico-estoque.json`, validando o schema de cada ficheiro antes de terminar.

No Linux ou macOS, execute:

```bash
./atualizar-dados.sh /caminho/para/explosao.xlsm [/caminho/para/consumiveis.xlsx]
```

Também é possível executar o orquestrador diretamente:

```bash
python scripts/atualizar_todos_dados.py /caminho/para/explosao.xlsm [/caminho/para/consumiveis.xlsx]
```

O segundo ficheiro é necessário apenas quando a planilha de Consumíveis estiver separada. Se a primeira planilha tiver uma aba chamada `consumiveis`, ela será detetada automaticamente. O conversor direto `convert_excel.py` continua disponível para uso técnico, mas a atualização normal deve ser feita pelos scripts `atualizar-dados.bat` ou `atualizar-dados.sh`.

O conversor lê as abas `Estoque`, `Obtencao`, `Programacao`, `familia`, `estoque segurança` e as abas de modelos. Ele extrai, entre outros dados, família, tipo de obtenção, estoque, estoque de segurança, pedidos `PED` e valor do estoque. A demanda mensal em Estoque e o consumo semanal no NIGURI usam as quantidades por modelo da aba `PLANO MES` multiplicadas pelas estruturas; os cabeçalhos mensais são lidos dinamicamente desde a linha 15. A aba `planoAnual` fornece as ENs, clientes, modelos e datas previstas para a lista semanal de **Carros a liberar** na Visão geral. Na mesma execução, os conversores especializados leem `Pinos`, `cilindros` e `cabines`.

Depois de atualizar o JSON, recarregue o dashboard com `Ctrl + F5`.

## O que o dashboard apresenta

A visão geral mostra materiais cadastrados, valor total do estoque, solicitações de obtenção em aberto, classificação de risco e pedidos previstos por mês. Os filtros globais combinam **Carteira**, **Família** e **Tipo de obtenção**.

Na área **Estoque**, selecione o mês do Plano Mês para ver, na mesma tabela, o pedido `PED` daquele mês e a demanda derivada da estrutura do produto planeado. Os separadores autónomos **Pedidos e demanda** e **Modelos** foram removidos para evitar duplicação: os pedidos continuam na tabela de Estoque e as estruturas continuam carregadas internamente para o NIGURI e as simulações.

O **NIGURI dos modelos** lista as estruturas carregadas das abas de modelos e distribui pelas semanas a quantidade mensal do modelo na aba `PLANO MES`; a quantidade do mês corrente é repartida apenas pelas semanas que ainda estão abertas. Os aliases de guindaste usam a capacidade-base: por exemplo, `guindaste 16,5` corresponde ao modelo-base `guindaste 16`. A lista da Visão geral **Carros a liberar** usa as ENs e as datas da coluna D do `planoAnual`; permite seleccionar uma semana e exportar um `.xlsx` formatado com todas as ENs dessa semana, modelo, cliente, semana, lista de itens críticos e previsão de pedido para os críticos. Quando uma EN não tem itens críticos, o Excel escreve **“Sem crítico”**. Itens em atenção podem continuar visíveis no painel, mas não são incluídos no ficheiro Excel. Uma variante sem BOM correspondente — por exemplo, guindaste 35,5 quando a cópia do Excel não contém uma estrutura guindaste 35 — é assinalada e não recebe consumo inventado. As áreas **Pinos por modelo** e **Cilindros por modelo** mantêm os seus cálculos especializados.

A página **Evolução do estoque** mostra barras mensais para o valor total do estoque e uma tabela com os valores exactos de cada mês.

Ao clicar em um código de material, o dashboard mostra estoque, segurança, consumo mensal, pedidos e quantidade sugerida para compra. O cartão de **Follow-up** abre a relação de pedidos de meses anteriores que precisam ser verificados com o time de compras.

## Organização dos ficheiros

| Ficheiro ou pasta | Função |
|---|---|
| `index.html` | Estrutura da tela de login e do dashboard |
| `assets/styles.css` | Cores, layout, responsividade e estilos dos componentes |
| `assets/app.js` | Login, filtros, cálculos, tabelas, detalhes e navegação |
| `assets/exceljs.min.js` | Biblioteca local para exportação Excel `.xlsx` com estilos, sem dependência externa |
| `assets/login-pcp.png` | Imagem usada na tela de login |
| `NEXT - Logo_edited.avif` | Logo exibido na barra lateral |
| `data/explosao.json` | Dados convertidos da planilha Excel |
| `data/consumiveis.json` | Dados convertidos da planilha de Consumíveis |
| `data/pinos.json` | Dados consolidados da aba Pinos por código e modelo |
| `data/cilindros.json` | Dados consolidados da aba cilindros por código e modelo |
| `scripts/convert_consumiveis.py` | Conversor da planilha de Consumíveis para JSON |
| `scripts/convert_pinos.py` | Conversor da aba Pinos para JSON |
| `scripts/convert_cilindros.py` | Conversor da aba cilindros para JSON |
| `atualizar-consumiveis.bat` | Atualização dos Consumíveis no Windows por arrastar e soltar |
| `scripts/convert_excel.py` | Conversor da explosão Excel para JSON |
| `scripts/atualizar_todos_dados.py` | Orquestrador e verificador de todos os snapshots |
| `scripts/list_sheets.py` | Ferramenta auxiliar para listar abas da planilha |
| `scripts/sample_core.py` | Ferramenta auxiliar para visualizar amostras das abas principais |
| `scripts/sample_sheets.py` | Ferramenta auxiliar para visualizar amostras de abas selecionadas |
| `atualizar-dados.bat` | Atualização dos dados no Windows |
| `atualizar-dados.sh` | Atualização dos dados no Linux ou macOS |
| `start-local.bat` | Inicialização do servidor local no Windows |
| `start-local.sh` | Inicialização do servidor local no Linux ou macOS |
| `GUIA-LOGIN.md` | Instruções para cadastrar e alterar acessos |
| `todo.md` | Histórico e lista de tarefas do projeto |

## Observação sobre segurança

O login desta cópia é uma camada simples no navegador. Os utilizadores e senhas ficam dentro de `assets/app.js`. Isso é útil para controlar o acesso informal da equipa, mas não equivale a uma autenticação segura de servidor. Não utilize esta proteção como única barreira para informação altamente confidencial.

## Controle de ENs / PVs

A área **Controle de ENs / PVs** usa as linhas já existentes em `data/plano-anual.json` e não exige novas colunas no Excel para começar.

Fluxo: anexe o PDF do PV e execute a leitura. O sistema identifica todas as ENs no documento e vincula automaticamente cada uma que existir no plano anual. Se nenhuma EN do PDF estiver no plano, exibe **Nenhuma EN encontrada — verificar plano**; se uma EN ainda não tiver vínculo, a tabela mostra **PV ainda não gerado**. O sistema também identifica o veículo/chassi, o produto e o PV. O modelo do produto é tratado separadamente do chassi: `CESTO AÉREO SKYCITY 10 L` vira `10L`. O texto vermelho dentro da seção de produto é comparado com a estrutura do modelo identificado.

Divergências de modelo, EN ausente no PDF, modelo não identificado ou item crítico não encontrado na estrutura impedem a conclusão. A primeira página do PDF é convertida em uma miniatura real e exibida nos detalhes, junto com as informações extraídas. O checklist e os campos PV/SC/responsável ficam salvos no `localStorage` do navegador. PDFs escaneados sem camada de texto entram em **Confirmação necessária** e não podem ser liberados automaticamente.

Ao clicar em uma EN, o sistema abre a janela de **Itens críticos da estrutura**. Ela calcula os componentes cujo estoque é menor que a necessidade do modelo, mostra pedidos por mês e quantidade, estoque, necessidade e saldo, e permite baixar um arquivo Excel com código, descrição, pedidos e estoque.

A leitura usa PDF.js carregado pelo navegador. O arquivo `scripts/testes_en_pv.js` possui a regressão automatizada da funcionalidade:

```bash
node scripts/testes_en_pv.js
```
