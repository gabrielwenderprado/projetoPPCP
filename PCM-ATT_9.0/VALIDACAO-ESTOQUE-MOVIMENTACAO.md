# Validação — Estoque, Última movimentação e Follow-up

## Alterações implementadas

A aplicação passou a oferecer o filtro global de estoque com as opções Todos, Igual a zero e Maior que zero. A área de Pinos também possui o seu filtro de estoque próprio, porque utiliza um snapshot separado.

As tabelas que possuem estoque passaram a apresentar a coluna **Última movimentação**. A explosão utiliza o valor convertido da planilha; Pinos e Consumíveis aproveitam a movimentação da explosão quando o código correspondente existe; quando não existe informação, é apresentado `não tem`.

A decisão operacional foi separada do risco físico. Um item com estoque zero continua **Crítico**. Um item com estoque parcial continua **Em atenção**. Um item com cobertura suficiente fica **Regular**.

Quando o item em risco possui um pedido no mês de referência ou um pedido atrasado, a decisão passa a ser **Follow-up** e não é disponibilizado o botão de compra. Quando não existe pedido aplicável, a decisão é **Comprar**. O estado de risco permanece visível independentemente da decisão.

## Verificações executadas

| Conjunto | Resultado |
|---|---:|
| Testes dedicados de estoque e movimentação | 37 aprovados, 0 falhas |
| Testes gerais de regressão | 98 aprovados, 0 falhas |
| Testes dedicados de Pinos | 42 aprovados, 0 falhas |
| Teste de pedidos em excesso | Aprovado |
| Sintaxe JavaScript | Aprovada |
| Compilação dos scripts Python | Aprovada |
| Recursos HTTP principais | HTTP 200 |

A suíte dedicada cobre filtros zero/positivo, preservação de Crítico, Em atenção e Regular, bloqueio de compra por Follow-up, mês de referência, pedidos atrasados, simulação, tabelas, alertas, Consumíveis, Pinos, snapshots e navegação principal.

## Observação de validação visual

A página de login e os recursos foram carregados pelo servidor local. A transição automática após o login ultrapassou o tempo limite do navegador de validação devido à mensagem inicial e ao splash screen de dez segundos já existentes no projeto. A validação funcional foi concluída pelos testes automatizados, pela verificação de sintaxe e pela validação HTTP dos arquivos.
