"""Testes de regressão para estoque zero, movimentação e decisão mensal."""
from __future__ import annotations
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
js = (ROOT / 'assets/app.js').read_text(encoding='utf-8')
html = (ROOT / 'index.html').read_text(encoding='utf-8')
passed = 0
failed: list[str] = []

def check(name: str, condition: bool) -> None:
    global passed
    if condition:
        passed += 1
        print(f'[OK {passed:02d}] {name}')
    else:
        failed.append(name)
        print(f'[FALHA] {name}')

def run(command: list[str]) -> bool:
    return subprocess.run(command, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0

check('JavaScript passa pela verificação de sintaxe', run(['node', '--check', 'assets/app.js']))
check('filtro de estoque possui estado próprio', "let stockFilter = 'all'" in js)
check('filtro zero compara estoque numérico com zero', "stockFilter === 'zero'" in js and 'n(item.stock) === 0' in js)
check('filtro positivo compara estoque numérico maior que zero', "stockFilter === 'positive'" in js and 'n(item.stock) > 0' in js)
check('filtro global aparece com opção Igual a zero', 'Igual a zero' in js and 'id="stock-filter"' in js)
check('filtro global é ligado aos eventos da vista', "['#stock-filter', value => { stockFilter = value; }]" in js)
check('filtro também funciona na vista de consumíveis', 'matchesStockFilter(item)' in js and 'function consumablesFilteredItems' in js)
check('filtro textual OK/Comprar dos consumíveis permanece ativo', 'stockStatusOk' in js and 'consumables-stock-status' in js)
check('filtro textual combina com o filtro numérico', 'stockValueOk && stockStatusOk' in js)
check('pinos possuem filtro de estoque próprio', 'id="pins-stock-filter"' in js and 'selectedStockFilter' in js)
check('risco com estoque zero permanece Crítico', "if (stock <= 0) return ['Crítico', 'red'];" in js)
check('estoque parcial permanece Em atenção', "return ['Em atenção', 'amber'];" in js)
check('estoque suficiente permanece Regular', "if (stock >= needed) return ['Regular', 'green'];" in js)
check('existe decisão operacional Comprar', "label: 'Comprar'" in js)
check('existe decisão operacional Follow-up', "label: 'Follow-up'" in js)
check('Follow-up bloqueia compra', 'canBuy: false' in js and 'hasFollowUpOrder' in js)
check('visão geral usa decisão mensal', 'procurementAction(item' in js and 'procurementDecision(item' in js)
check('mês selecionado é passado à tabela de pedidos', 'table(monthItems, 150, true, chosen)' in js)
check('atraso também gera Follow-up', 'overdueOrders(item).length > 0' in js)
check('sugestão de compra é zero quando há Follow-up', 'if (hasFollowUpOrder(item, demandLabel || demand)) return 0;' in js)
check('simulação usa o mês inicial da janela', 'referenceDemandLabel' in js and 'start.slice(5, 7)' in js)
check('simulação exibe decisão em vez de compra cega', '<th>Decisão</th>' in js and 'decision.color' in js)
check('tabela principal exibe Última movimentação', 'movementDate(item.lastMovement)' in js and '<th>Última movimentação</th>' in js)
check('Follow-up exibe Última movimentação', 'function followUpRows' in js and 'movementDate(item.lastMovement)' in js)
check('excesso exibe Última movimentação', 'function excessRows' in js and 'movementDate(row.lastMovement)' in js)
check('consumíveis exibem Última movimentação', 'function consumableRows' in js and 'movementDate(item.lastMovement)' in js)
check('pinos exibem Última movimentação', 'function pinSimulationRows' in js and 'movementDate(item.lastMovement)' in js)
check('alertas exibem Última movimentação', 'movementDate(alert.lastMovement)' in js and 'lastMovement: item?.lastMovement' in js)
check('pinos aproveitam movimentação da explosão', 'itemByCodeMap.get(String(item.code))?.lastMovement' in js)
check('consumíveis aproveitam movimentação da explosão', 'CONSUMABLES.items = (CONSUMABLES.items || []).map' in js)
check('filtro de estoque também se aplica aos alertas', 'matchesStockFilter(alert)' in js)
check('filtro é limpo ao limpar filtros de alertas', "stockFilter = 'all'; render();" in js)
check('HTML mantém a navegação principal', 'data-view="stock"' in html and 'data-view="pins"' in html)

explosao = json.loads((ROOT / 'data/explosao.json').read_text(encoding='utf-8'))
consumiveis = json.loads((ROOT / 'data/consumiveis.json').read_text(encoding='utf-8'))
pinos = json.loads((ROOT / 'data/pinos.json').read_text(encoding='utf-8'))
check('explosão contém itens com estoque zero', any(float(item.get('stock', 0) or 0) == 0 for item in explosao.get('items', [])))
check('explosão mantém pedidos e demandas', all('orders' in item and 'demands' in item for item in explosao.get('items', [])[:100]))
check('consumíveis carregam itens', isinstance(consumiveis.get('items'), list) and len(consumiveis['items']) > 0)
check('pinos carregam modelos e itens', isinstance(pinos.get('models'), list) and isinstance(pinos.get('items'), list) and len(pinos['items']) > 0)

print(f'\nResultado: {passed} aprovados; {len(failed)} falhas.')
if failed:
    print('\n'.join(f'- {item}' for item in failed))
    raise SystemExit(1)
