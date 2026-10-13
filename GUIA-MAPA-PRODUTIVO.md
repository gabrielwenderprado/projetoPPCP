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

O NIGURI cruza as ENs do `plano-anual.json` com o `mapa-produtivo.json`. ENs com status normalizado **ENTREGUE** ou **VITRINI** são mantidas visíveis no mapa, mas não entram no consumo projetado do NIGURI.

As demais ENs continuam compondo a demanda dos modelos.

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
