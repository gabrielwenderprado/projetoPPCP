# Mapa produtivo integrado

A primeira tela do sistema agora é o **Mapa produtivo**. Ela é alimentada pelo snapshot `data/mapa-produtivo.json`, gerado a partir de `planejamento_produtivo.xlsx`.

## Atualização dos dados

Com a planilha de Explosão e a planilha de planejamento produtivo:

```bash
python scripts/atualizar_todos_dados.py explosao.xlsm --mapa planejamento_produtivo.xlsx
```

Se existir uma planilha de Consumíveis separada:

```bash
python scripts/atualizar_todos_dados.py explosao.xlsm consumiveis.xlsx planejamento_produtivo.xlsx
```

## Regra das etapas

Cada etapa possui uma coluna planejada e uma coluna `Status`. Se o `Status` estiver preenchido, a etapa aparece como concluída no mapa.

## Regra do NIGURI

A indicação de itens faltantes no Mapa Produtivo considera a estrutura do modelo e o saldo acumulado de materiais EN por EN. ENs com status normalizado **ENTREGUE**, **VITRINE** ou **VITRINI** ficam sem itens faltantes; ENs com todas as etapas produtivas concluídas — incluindo Montagem Final, Máquina e Integração — também não exibem faltas. Para as demais, o consumo segue a data prevista do Plano Anual, com fallback para a data final do mapa ou semana/ano, e os pedidos previstos são lançados no mês correspondente antes do consumo. Assim, a falta pode surgir nas últimas unidades de uma semana ou período, sem atribuir a mesma quantidade de estoque a cada EN.

A consulta do NIGURI continua disponível modelo a modelo e também em **Todos os modelos**, quando materiais repetidos são consolidados e o consumo das estruturas é somado na semana das ENs do Plano Anual.

## Atualização por arrastar e soltar no Windows

Também é possível arrastar a planilha `planejamento_produtivo.xlsx` diretamente sobre o arquivo:

```text
atualizar-mapa-produtivo.bat
```

O arquivo gera automaticamente `data/mapa-produtivo.json`. Depois, abra o sistema novamente e pressione `Ctrl + F5`.

## Filtros do Mapa produtivo

A tela possui quatro filtros de período:

- **Data inicial** e **Data final**: filtram pela data final prevista do carro;
- **Semana inicial** e **Semana final**: filtram pelo intervalo de semanas do mapa.

Os indicadores e a quantidade de ENs encontradas são recalculados conforme o período escolhido. Use **Limpar filtros** para voltar à visão completa.
