# Validação da atualização completa

## Problema identificado

O script `atualizar-dados.bat` chamava diretamente apenas `convert_excel.py`. Embora esse conversor já regenerasse Explosão, Plano Mês, Pinos, Cilindros e Histórico, não existia um orquestrador que verificasse cada saída nem que chamasse o conversor separado de Consumíveis. Como `consumiveis.json` depende de uma planilha de origem própria, ele permanecia com a data anterior quando o utilizador atualizava somente a planilha de Explosão.

## Correção aplicada

Foi criado `scripts/atualizar_todos_dados.py`. Os scripts `atualizar-dados.bat` e `atualizar-dados.sh` agora chamam esse orquestrador. Ele executa o conversor principal, deteta automaticamente a aba `consumiveis` quando ela estiver na mesma planilha e aceita uma segunda planilha quando os Consumíveis forem uma origem separada.

No fim de cada execução, o orquestrador confirma a existência, o JSON válido e o schema de `explosao.json`, `plano-mes.json`, `pinos.json`, `cilindros.json` e `historico-estoque.json`. Quando há uma origem de Consumíveis, também valida `consumiveis.json`. Sem essa segunda origem, o sistema exibe um aviso explícito em vez de dar a impressão de que o ficheiro foi atualizado.

## Execução recomendada

```bash
./atualizar-dados.sh /caminho/para/explosao.xlsm /caminho/para/consumiveis.xlsx
```

No Windows, o primeiro ficheiro pode ser arrastado sobre `atualizar-dados.bat` e o segundo pode ser informado como segundo argumento. Para planilhas que já contenham a aba `consumiveis`, basta informar apenas o ficheiro principal.

## Resultado da validação

A planilha real `CópiadeEXPLOSAO_25.08.xlsm` foi processada. Foram verificados 5.969 itens da Explosão, 15 modelos do Plano Mês, 91 itens de Pinos, 4 modelos de Cilindros e 1 registo de Histórico. A fonte real não possui uma aba `consumiveis`, portanto o aviso sobre a origem separada foi emitido corretamente.

A regressão final foi concluída com 17 testes do fluxo de atualização, 37 testes de Cilindros, 42 testes de estoque, 42 testes de Pinos e 98 verificações de revisão/pedidos, sem falhas. A sintaxe JavaScript e a compilação dos scripts Python também foram aprovadas.
