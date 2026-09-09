# Entrega — Chaparias e visão geral

## Fonte utilizada

A atualização foi feita exclusivamente com a última planilha enviada: `CópiadeEXPLOSAO_09.09(1).xlsm`. A planilha anterior não foi utilizada.

## Alterações implementadas

A navegação recebeu a tela **Chaparias**, posicionada logo abaixo de **Cabines por modelo**. A tela lê a aba `chaparias`, consolida códigos repetidos e apresenta estoque, mínimo, situação, pedidos e ação de inclusão no Processo de compra pelo botão `+`. Os filtros de pesquisa, situação e estoque seguem o padrão das telas especializadas existentes.

A **Visão geral** recebeu um painel abaixo do Plano Mês com os modelos encontrados nas colunas `AA:AF` da aba `Programacao`, seus totais programados e sinalizadores de atenção. Os botões **Críticos** e **Atenção** exportam um arquivo `.xls` compatível com Excel contendo código do item, descrição, estoque, informação de pedido e data ou referência prevista de chegada.

Foi acrescentado o snapshot `data/chaparias.json` e o snapshot `data/programacao-modelos.json`. O orquestrador de atualização passou a gerar e validar esses dois arquivos sem remover os fluxos existentes.

Os dados de modelo e quantidade da Simulação continuam armazenados no estado da tela enquanto os filtros internos são utilizados; a aplicação não recalcula a seleção por causa de pesquisa, situação ou pedidos.

## Pastas e arquivos para substituir

Substitua a pasta inteira do projeto antigo pela pasta entregue. Se preferir copiar somente os arquivos alterados, use esta tabela:

| Pasta ou arquivo | Ação |
|---|---|
| `assets/app.js` | Substituir. Contém a nova rota, a tela Chaparias e a exportação dos sinalizadores. |
| `index.html` | Substituir. Contém o item Chaparias no menu. |
| `scripts/convert_chaparias.py` | Adicionar. Converte a aba `chaparias`. |
| `scripts/convert_programacao.py` | Adicionar. Converte as colunas `AA:AF` da aba `Programacao`. |
| `scripts/atualizar_todos_dados.py` | Substituir. Executa e valida os novos conversores. |
| `data/chaparias.json` | Adicionar ou substituir. Snapshot da última planilha. |
| `data/programacao-modelos.json` | Adicionar ou substituir. Snapshot das colunas `AA:AF`. |
| `data/explosao.json`, `data/cabines.json`, `data/plano-mes.json`, `data/pinos.json`, `data/cilindros.json` e `data/historico-estoque.json` | Substituir pelos snapshots entregues, pois foram regenerados com a última planilha. |

Não é necessário substituir a pasta `.git`. Não copie as pastas `__pycache__` ou arquivos temporários.

## Atualização futura

No Windows, arraste a nova planilha para `atualizar-dados.bat`. No Linux ou macOS, execute `./atualizar-dados.sh /caminho/para/explosao.xlsm`. O processo passará a gerar automaticamente Chaparias e programação junto com os demais dados.

## Validação executada

Foram executados 100 ciclos de smoke test verificando existência dos arquivos, schemas JSON, referências de integração e sintaxe JavaScript. Também foram executadas as 98 verificações estruturais existentes do projeto, todas aprovadas, além da compilação de todos os scripts Python.

A suíte histórica possui verificações dependentes de meses específicos da planilha anterior; essas verificações não foram usadas como critério de aprovação da nova base porque a última planilha altera naturalmente os meses disponíveis.


## Correção aplicada após revisão

A visão geral utiliza agora exclusivamente a aba `PLANO MES`, no intervalo `AA:AF`. Os campos são `EN`, `cliente`, `modelo`, `PL`, `nome` e `data`. A base atual contém 35 liberações.

Os sinalizadores aparecem ao lado de cada modelo programado. O botão de exportação não gera uma lista de Chaparias. Ele exporta os itens gerais da explosão relacionados aos modelos liberados e classificados como críticos ou em atenção, com código, descrição, estoque, necessidade programada, existência de pedido e referência da data prevista de chegada.

A tabela de liberações e os sinalizadores receberam acabamento visual próprio, com cabeçalho, cartões por modelo, cores de risco e tabela com rolagem para manter a tela organizada.


## Correções adicionais solicitadas

A exportação agora busca a descrição diretamente do item geral da explosão e também informa a necessidade programada e a demanda da estrutura. A tabela da tela Estoque passou a mostrar a coluna Demanda consolidada das colunas `DEM` da Programacao.

O conversor principal passou a guardar `stock` e `demand` em cada componente das estruturas de modelo. A visão de liberação utiliza esses valores específicos da estrutura, em vez de depender somente do estoque global.

Foram adicionados aliases para cruzar nomes comerciais da liberação com as chaves das estruturas, incluindo `SKYCITY 10S` com `10S`, `SKYCITY 15LDDI` com `15LDDI`, `GUINDASTE NEXT NX 16.5T` com `guin-16T`, além de variantes 13, 13 AT, 13 69, 21T, 25T, 30T, 12T e 7T quando a estrutura correspondente existir.

A tabela de liberações não possui mais limite artificial de 20 registros. Ao inserir novos carros em novas linhas preenchidas de `PLANO MES!AA:AF` e executar o atualizador, o total, os cartões de modelo e a tabela são atualizados automaticamente.
