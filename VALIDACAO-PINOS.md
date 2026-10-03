# Validação da área de Pinos

A área **Pinos por modelo** foi evoluída para um simulador de produção a partir da aba `Pinos` da planilha `CópiadeEXPLOSAO_25.08.xlsm`.

## Funcionamento implementado

O utilizador seleciona um card de modelo, informa a quantidade de máquinas e executa o cálculo. Para cada pino utilizado pelo modelo, o sistema calcula a necessidade total multiplicando a necessidade unitária pelo número de máquinas. Em seguida, compara a necessidade calculada com o estoque físico.

| Situação | Regra |
|---|---|
| **Regular** | O estoque cobre a necessidade calculada |
| **Em atenção** | Existe estoque, mas ele é inferior à necessidade calculada |
| **Crítico** | O estoque é zero e existe necessidade para o modelo |

A tabela apresenta código, descrição, estoque, necessidade por máquina, quantidade de máquinas, necessidade calculada, saldo e situação. Também possui pesquisa por código ou descrição e filtros por situação.

## Dados gerados

O conversor identificou 6 modelos e consolidou 73 códigos de pinos em `data/pinos.json`. Cada código contém descrição, unidade, estoque atual, necessidade por modelo, necessidade total e quantidade de modelos em que é utilizado.

## Arquivos adicionados ou alterados

| Arquivo | Alteração |
|---|---|
| `scripts/convert_pinos.py` | Conversor dedicado da aba `Pinos` |
| `data/pinos.json` | Snapshot consolidado dos pinos |
| `scripts/convert_excel.py` | Geração automática dos pinos no fluxo principal |
| `assets/app.js` | Seleção de modelo, quantidade, cálculo, saldo, classificação, pesquisa e filtros |
| `index.html` | Acesso à área de pinos no menu |
| `assets/styles.css` | Cards selecionáveis, configurador, resumo de resultados, tabela e responsividade |
| `scripts/testes_pinos.py` | 42 testes dedicados aos dados e ao simulador |
| `scripts/testes_revisao.py` | Regressão ampliada para incluir os novos arquivos |
| `scripts/teste_pedidos_excesso.py` | Expectativa atualizada para a explosão atual |
| `README.md` | Documentação da área e dos arquivos |

## Resultado dos testes
A compilação dos scripts Python passou. A verificação de sintaxe do JavaScript passou. Os testes dedicados passaram com **42 verificações aprovadas e 0 falhas**. A bateria geral de regressão passou com **98 verificações aprovadas e 0 falhas**. O teste específico de pedidos em excesso também passou, com 4 casos e soma de 7.300 unidades de excesso.

O servidor local respondeu com HTTP 200 para `index.html`, `assets/app.js`, `assets/styles.css`, `data/pinos.json` e `data/explosao.json`. O HTML servido contém o acesso `Pinos por modelo` e o snapshot contém os modelos extraídos.

## NIGURI dos Pinos

A área `Pinos por modelo` passou a ter uma subaba **NIGURI dos pinos**. Ela calcula, para todos os pinos utilizados pelo modelo selecionado:

- estoque inicial pelo código real do item;
- necessidade unitária pela estrutura da aba `Pinos`;
- programação até dezembro a partir do `plano-mes.json`;
- recebimentos previstos por código, quantidade e data da aba `Obtencao`;
- saldo acumulado por semana;
- necessidade consolidada até 31/12;
- primeira semana com falta prevista;
- filtros por modelo, código/descrição e situação.

Quando a planilha tem data exata de entrega, ela é usada no mês correspondente. Caso o snapshot antigo ainda não tenha o campo detalhado, o sistema mantém compatibilidade usando os pedidos mensais já existentes.

O teste `scripts/testes_pinos_niguri.py` validou **748 cenários** reais de itens, modelos e projeções. O teste Chromium validou login, abertura da tela Pinos, alternância entre as subabas, seleção de modelo, pesquisa, filtro de situação e ausência de erros de console.

## Correção da demanda anual e contraste

O NIGURI agora usa o snapshot `data/plano-anual.json`, gerado pela aba `planoAnual` da planilha. A origem é explícita:

- **coluna C:** Produto/modelo;
- **coluna D:** MÊS/data planejada.

Os produtos comerciais são relacionados aos modelos da aba Pinos (por exemplo, `SKYCITY 10 S` → `10S`, `SKYCITY 13 LDI` → `13LDI`). O saldo semanal é calculado como estoque inicial menos consumo acumulado mais recebimentos previstos. Assim, estoque zero com demanda passa a ficar vermelho a partir da primeira semana em que houver consumo.

Também foram ajustadas as cores do tema escuro, com texto claro e contraste alto nas células verdes, amarelas e vermelhas.
