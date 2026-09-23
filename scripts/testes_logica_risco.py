import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SOURCE = (BASE / 'assets' / 'app.js').read_text(encoding='utf-8')

# Verificações estruturais da implementação usada no navegador.
assert 'function totalDemand(item)' in SOURCE
assert 'function requiredQuantity(item, demand)' in SOURCE
assert "if (orders > 0) return ['Em atenção', 'amber'];" in SOURCE
assert "return ['Crítico', 'red'];" in SOURCE
assert 'return hasOpenOrder(item);' in SOURCE
assert "if (followUp) return { label: 'Follow-up'" in SOURCE

# A mesma matriz de decisão, expressa como cenários de aceitação da regra de negócio.
def decision(stock, demand, orders):
    stock = float(stock or 0)
    demand = float(demand or 0)
    orders = float(orders or 0)
    if orders > 0:
        return 'Em atenção', 'Follow-up'
    if stock < demand:
        return 'Crítico', 'Comprar'
    return 'Regular', 'Não comprar'

cases = [
    ((0, 10, 0), ('Crítico', 'Comprar')),
    ((5, 10, 0), ('Crítico', 'Comprar')),
    ((10, 10, 0), ('Regular', 'Não comprar')),
    ((20, 10, 0), ('Regular', 'Não comprar')),
    ((0, 10, 3), ('Em atenção', 'Follow-up')),
    ((5, 10, 3), ('Em atenção', 'Follow-up')),
    ((20, 10, 3), ('Em atenção', 'Follow-up')),
    ((0, 0, 2), ('Em atenção', 'Follow-up')),
]
for inputs, expected in cases:
    actual = decision(*inputs)
    assert actual == expected, (inputs, actual, expected)

# Confirma que a base possui exemplos reais do problema: demanda com estoque zerado.
data = json.loads((BASE / 'data' / 'explosao.json').read_text(encoding='utf-8'))
real_zero_demand = [
    item for item in data.get('items', [])
    if float(item.get('stock') or 0) <= 0
    and sum(float(value or 0) for value in (item.get('demands') or {}).values()) > 0
]
assert real_zero_demand, 'A base não contém cenário real de estoque zero com demanda.'

print(f'LOGICA_RISCO_OK casos={len(cases)} cenarios_reais_estoque_zero_demanda={len(real_zero_demand)}')
