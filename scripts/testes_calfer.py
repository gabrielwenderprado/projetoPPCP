import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data' / 'calfer.json').read_text(encoding='utf-8'))
js = (ROOT / 'assets' / 'app.js').read_text(encoding='utf-8')
html = (ROOT / 'index.html').read_text(encoding='utf-8')

assert data['sourceSheets']['calfer'].lower() == 'calfer'
assert data['meta']['singleSheet'] is True
assert data['calferModels'] and data['items']
assert not data.get('nextModels')

models = {model['name']: model for model in data['calferModels']}
assert {'10L', '10S', '13LDI', '10HDOC'} <= set(models)
for model in models.values():
    assert model['items']
    for item in model['items']:
        assert item['code'] and item['description']
        assert isinstance(item['nextStock'], (int, float))
        assert isinstance(item['quantityPerMachine'], (int, float))
        assert isinstance(item['calferStock'], (int, float))

for model in models.values():
    capacities = [int(max(0, item['calferStock']) // item['quantityPerMachine']) for item in model['items'] if item['quantityPerMachine'] > 0]
    assert capacities and min(capacities) >= 0

for required in [
    'calferSelectedModel', 'calferModelItems', 'calferAvailabilityPlan',
    'calferCompleteMachineCapacity', 'calferView', 'data/calfer.json',
    'Estoque Next', 'Estoque Calfer', 'Máquinas possíveis',
    'O que falta para montar', 'calfer-single-table'
]:
    assert required in js, required

for forbidden in ['send-to-calfer', 'send-to-next', 'Enviar ${fmt(machines)} máquina(s) para Calfer', 'Receber ${fmt(machines)} máquina(s) da Calfer']:
    assert forbidden not in js, forbidden

assert 'data-view="calfer"' in html
print(f'CALFER_SINGLE_VIEW_OK modelos={len(models)} itens={len(data["items"])}')
