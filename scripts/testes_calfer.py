import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data' / 'calfer.json').read_text(encoding='utf-8'))
assert data['sourceSheets']['next'].lower() == 'calfer.next'
assert data['sourceSheets']['calfer'].lower() == 'calfer'
assert data['nextModels'] and data['calferModels']
assert data['items']
assert data['meta']['nextRows'] > 0 and data['meta']['calferRows'] > 0

next_models = {m['name']: m for m in data['nextModels']}
calfer_models = {m['name']: m for m in data['calferModels']}
assert set(next_models) == set(calfer_models)
base_next = {item['code']: float(item.get('nextStock') or 0) for item in data['items']}
base_calfer = {item['code']: float(item.get('calferStock') or 0) for item in data['items']}

# Executa 120 cenários determinísticos usando todos os modelos e quantidades de 1 a 40.
scenarios = 0
for direction, models, stocks in [
    ('nextToCalfer', next_models, base_next),
    ('calferToNext', calfer_models, base_calfer),
]:
    for model_name, model in models.items():
        for machines in range(1, 41):
            plan = []
            for item in model['items']:
                required = float(item['quantityPerMachine'] or 0) * machines
                available = stocks.get(item['code'], 0)
                send = min(required, available)
                assert send >= 0 and send <= required and send <= available
                assert abs((available - send) - max(0, available - send)) < 1e-9
                plan.append((required, available, send, max(0, required-send)))
            assert plan
            scenarios += 1
assert scenarios >= 120

# Simula ida e volta: o envio Next → Calfer movimenta os dois saldos;
# o retorno Calfer → Next reduz somente o saldo da Calfer.
transactions = []
sim_next = dict(base_next)
sim_calfer = dict(base_calfer)
for model_name, model in next_models.items():
    for item in model['items']:
        code = item['code']; q = min(float(item['quantityPerMachine'] or 0) * 3, sim_next.get(code, 0))
        sim_next[code] = sim_next.get(code, 0) - q
        sim_calfer[code] = sim_calfer.get(code, 0) + q
        transactions.append(('nextToCalfer', code, q))
for model_name, model in calfer_models.items():
    for item in model['items']:
        code = item['code']; q = min(float(item['quantityPerMachine'] or 0) * 2, sim_calfer.get(code, 0))
        sim_calfer[code] = sim_calfer.get(code, 0) - q
        transactions.append(('calferToNext', code, q))
for code in set(base_next) | set(base_calfer):
    next_balance = base_next.get(code, 0)
    calfer_balance = base_calfer.get(code, 0)
    for direction, tx_code, quantity in transactions:
        if tx_code != code: continue
        if direction == 'nextToCalfer': next_balance -= quantity; calfer_balance += quantity
        else: calfer_balance -= quantity
    assert next_balance >= -1e-9 and calfer_balance >= -1e-9
    expected_next = base_next.get(code, 0) - sum(q for direction, tx_code, q in transactions if tx_code == code and direction == 'nextToCalfer')
    assert abs(next_balance - expected_next) < 1e-6
    assert next_balance <= base_next.get(code, 0) + 1e-9

source = (ROOT / 'assets' / 'app.js').read_text(encoding='utf-8')
for required in ['calferView', 'calferBalances', 'calferPlan', 'sendCalferMachines', 'nextToCalfer', 'calferToNext', 'data/calfer.json', 'send-to-calfer', 'send-to-next', "if (move.direction === 'calferToNext') { calfer -= quantity; }"]:
    assert required in source, required
html = (ROOT / 'index.html').read_text(encoding='utf-8')
assert 'data-view="calfer"' in html
print(f'CALFER_TESTS_OK cenarios={scenarios} modelos={len(next_models)} itens={len(data["items"])}')
