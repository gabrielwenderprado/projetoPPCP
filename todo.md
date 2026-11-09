

## Actualização móvel, liberação semanal e equivalências do NIGURI (09/11/2026)
- [x] Dashboard adaptável em celular: cabeçalho/menu, filtros, controles, cartões, formulários, detalhes e tabelas; validado a 320px e 390px em oito vistas sem alargar o viewport.
- [x] “Carros a liberar” usa ENs, modelos, clientes e datas da aba PLANO ANUAL; mostra só a semana seleccionada e oferece filtro semanal.
- [x] Cada EN mostra modelo, cliente, semana, itens críticos, itens em atenção e previsão se há pedido registado para os materiais em risco.
- [x] Exportação `.xlsx` formatada para apresentação contendo todas as ENs da semana, lista apenas os materiais críticos e assinala “Sem crítico” quando não houver; omite itens em atenção e conserva previsão, auto-filtro, linhas congeladas e orientação horizontal.
- [x] NIGURI agrupa a procura mensal do PLANO MES por capacidade-base do guindaste e distribui-a por semanas dinâmicas; aliases 16,5→16, 25,5→25, 45,5→45 e 7,5→7 cobertos pelos testes.
- [x] 7T projecta as sete unidades de Novembro disponíveis no PLANO MES; 45 resolve para a estrutura `guin-45` e mostra zero quando o Plano Mês tem zero para Novembro.
- [x] Se existir quantidade planeada para um modelo-base sem BOM/estrutura no Excel — actualmente guindaste 35 — o sistema identifica o modelo sem inventar componentes ou necessidades.
