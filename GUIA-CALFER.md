# Controle de estoque Calfer

A aba **Estoque Calfer** usa as abas `calfer.next` e `calfer` da planilha de Explosão como saldos iniciais. `calfer.next` representa o estoque da Next e `calfer` representa o estoque mantido na Calfer.

## Fluxo Next → Calfer

Selecione o modelo, informe a quantidade de máquinas e use **Enviar máquina(s) para Calfer**. Para cada componente, o sistema calcula a necessidade como `quantidade por máquina × quantidade de máquinas`, envia somente o que está disponível no estoque Next e mostra o número de peças faltantes. O estoque Next é reduzido e o estoque Calfer é aumentado pelo mesmo número de peças enviadas.

## Fluxo Calfer → Next

Selecione o modelo, informe a quantidade de máquinas e use **Receber máquina(s) da Calfer**. O sistema calcula a estrutura correspondente, envia somente o que existe no estoque Calfer e reduz o saldo Calfer. **Esse fluxo não aumenta o estoque da Next**; ele serve para controlar a baixa dos componentes que estavam sob responsabilidade da Calfer. Se o estoque da Calfer não for suficiente, o sistema informa a diferença faltante.

A capacidade estimada de máquinas é calculada pelo menor quociente entre o saldo disponível e a quantidade necessária por máquina, considerando todos os componentes do modelo.

## Atualização da planilha

O script `scripts/convert_calfer.py` lê as duas abas e grava `data/calfer.json`. O orquestrador `scripts/atualizar_todos_dados.py` executa esse conversor automaticamente quando a planilha possui as abas obrigatórias.

## Persistência dos movimentos

Nesta versão baseada em arquivo estático, os movimentos realizados pelos botões ficam salvos no `localStorage` do navegador. Isso permite continuar o controle no mesmo computador e navegador, mas não sincroniza automaticamente os saldos entre computadores ou usuários. Para uma versão compartilhada por Next e Calfer, o próximo passo é persistir os movimentos em uma API/banco de dados ou em uma fonte central autorizada.
