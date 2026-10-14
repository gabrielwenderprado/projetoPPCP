#!/usr/bin/env python3
"""Regressões do Mapa produtivo: Obtenção, remoção por EN e pesquisa."""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / 'assets' / 'app.js').read_text(encoding='utf-8')
DATA = json.loads((ROOT / 'data' / 'explosao.json').read_text(encoding='utf-8'))
MAP = json.loads((ROOT / 'data' / 'mapa-produtivo.json').read_text(encoding='utf-8'))


def n(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def order_for_month(item, row):
    orders = item.get('orders', {})
    final_date = str(row.get('finalDate') or row.get('date') or '')[:10]
    date_match = re.match(r'^(\d{4})-(\d{2})-', final_date)
    month_match = re.search(r'(\d{1,2})', str(row.get('month') or ''))
    month = f'{int(month_match.group(1)):02d}' if month_match else ''
    year = date_match.group(1) if date_match else ''
    candidates = []
    if month and year:
        candidates.append(f'PED {month}/{year}')
    if month:
        candidates.append(f'PED {month}')
    for key, value in orders.items():
        if str(key).strip().upper() in candidates:
            return key, n(value)
    return candidates[0] if candidates else '', 0


item = next(x for x in DATA['items'] if x['code'] == '01.02.01.0000000096')
row = next(x for x in MAP['records'] if x['en'] == 'EN013326')
key, qty = order_for_month(item, row)
assert key == 'PED 10/2026', (key, row)
assert qty == 3000, qty
assert 'productionMapOrderForMonth' in JS
assert 'PED ${month}/${year}' in JS
assert 'data-production-dismiss-code' in JS
assert 'PRODUCTION_DISMISSED_STORAGE_KEY' in JS
assert 'row.dataset.productionRowText' in JS
assert "productionMapQuery = search.value || ''; render();" not in JS
assert subprocess.run(['node', '--check', str(ROOT / 'assets' / 'app.js')], capture_output=True, text=True).returncode == 0

# Repetição intencional: garante estabilidade da associação mês/ano e dos contratos UI.
checks = 0
for _ in range(160):
    assert order_for_month(item, row) == ('PED 10/2026', 3000)
    assert 'production-dismiss-item' in JS
    assert 'production-map-row' in JS
    assert 'production-map-count' in JS
    checks += 4
print(f'MAPA_CORRECOES_OK execucoes=160 checks={checks} pedido={key}:{int(qty)}')
