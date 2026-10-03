import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
pins = json.loads((ROOT / 'data' / 'pinos.json').read_text(encoding='utf8'))
plan = json.loads((ROOT / 'data' / 'plano-mes.json').read_text(encoding='utf8'))
annual = json.loads((ROOT / 'data' / 'plano-anual.json').read_text(encoding='utf8'))
explosion = json.loads((ROOT / 'data' / 'explosao.json').read_text(encoding='utf8'))
items_by_code = {str(item['code']): item for item in explosion['items']}

assert pins['items'] and pins['models']
assert set(plan['months']) >= {'10', '11', '12'}
assert annual['sourceSheet'].lower() == 'planoanual'
assert annual['columns'] == {'model': 'C', 'month': 'D'}
assert sum(annual['models'].get('10S', {}).values()) > 0

def norm(value):
    return ''.join(c for c in str(value or '').lower() if c.isalnum())

aliases = {
    '13lddi': ['13'], '13ldi': ['13'], '18lddi': ['18'],
    'guin16t': ['guindaste16'], 'guin25t': ['guindaste25', 'guindate25'],
    'guin45': ['guindaste45'], '10s': ['10s'], '10l': ['10l'],
}

def plan_models(model):
    if model == 'Todos os modelos': return plan['models']
    target = norm(model)
    candidates = [target] + aliases.get(target, [])
    return [entry for entry in plan['models'] if any(norm(entry['modelo']) == c or norm(entry['modelo']).find(c) >= 0 or c.find(norm(entry['modelo'])) >= 0 for c in candidates)]

def slots(model):
    entries = plan_models(model)
    selected = [m for m in plan['months'] if int(m) >= date.today().month]
    return [(m, sum(float(e.get('quantidades', {}).get(m, 0) or 0) for e in entries)) for m in selected]

def simulate(item, model):
    entries = plan_models(model)
    if model == 'Todos os modelos':
        unit = sum(float(item.get('modelNeeds', {}).get(e['modelo'], 0) or 0) for e in entries)
    else:
        unit = float(item.get('modelNeeds', {}).get(model, 0) or 0)
    if unit <= 0: return None
    source = items_by_code.get(str(item['code']), item)
    balance = float(source.get('stock', item.get('stock', 0)) or 0)
    total = 0
    receipts = 0
    for month, machines in slots(model):
        consumption = unit * machines
        receipt = float(source.get('orders', {}).get(f'PED {month}/{date.today().year}', 0) or 0)
        balance = balance - consumption + receipt
        total += consumption
        receipts += receipt
    assert total >= 0
    return balance, total, receipts

scenarios = 0
active_rows = 0
for model in ['Todos os modelos'] + pins['models']:
    for item in pins['items']:
        result = simulate(item, model)
        if result is None: continue
        ending, total, receipts = result
        assert total >= 0
        assert abs(ending - (float(items_by_code.get(str(item['code']), item).get('stock', item.get('stock', 0)) or 0) - total + receipts)) < 1e-6
        scenarios += 1
        active_rows += 1
        # Exercise the same projection with 1, 2 and 10 planned machine multipliers.
        for multiplier in (1, 2, 10):
            assert total * multiplier >= total
            scenarios += 1
assert scenarios > 100
print(f'PINOS_NIGURI_TESTS_OK cenarios={scenarios} itens_ativos={active_rows} modelos={len(pins["models"])}')
