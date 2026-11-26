from __future__ import annotations
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
payload = json.loads((ROOT / 'data' / 'mapa-produtivo.json').read_text(encoding='utf-8'))
passed = 0
failed = []
def check(name, condition):
    global passed
    if condition: passed += 1
    else: failed.append(name)
check('schema sourceFile', bool(payload.get('sourceFile')))
check('schema sourceSheet', bool(payload.get('sourceSheet')))
check('schema records', isinstance(payload.get('records'), list))
check('schema summary', isinstance(payload.get('summary'), dict))
excluded = {'ENTREGUE', 'VITRINE', 'VITRINI'}
check('schema exclui entregue e as variantes vitrine', set(payload['summary'].get('excludedStatuses', [])) == excluded)
check('total matches records', payload['summary'].get('totalENs') == len(payload['records']))
check('active plus excluded', payload['summary'].get('activeENs', 0) + payload['summary'].get('excludedFromNiguri', 0) == len(payload['records']))
check('stage columns', len(payload.get('stageColumns', [])) == 8)
records = payload['records']
for i, row in enumerate(records):
    check(f'{i}: EN', bool(row.get('en')))
    check(f'{i}: status normalized', isinstance(row.get('productionStatusNormalized'), str))
    check(f'{i}: status consistency', row.get('productionStatusNormalized') == (str(row.get('productionStatus') or '').upper().replace('Í','I').replace('É','E').strip() or 'SEM STATUS'))
    check(f'{i}: stages list', isinstance(row.get('stages'), list) and len(row['stages']) == 8)
    check(f'{i}: schedule fields', 'finalDate' in row and 'week' in row and 'month' in row)
    for j, stage in enumerate(row['stages']):
        check(f'{i}/{j}: stage name', bool(stage.get('name')))
        check(f'{i}/{j}: completed boolean', isinstance(stage.get('completed'), bool))
        check(f'{i}/{j}: status value key', 'statusValue' in stage)
        check(f'{i}/{j}: planned key', 'planned' in stage)
actual_excluded = sum(row.get('productionStatusNormalized') in excluded for row in records)
check('excluded count is exact', actual_excluded == payload['summary'].get('excludedFromNiguri'))
converter = (ROOT / 'scripts' / 'convert_mapa_produtivo.py').read_text(encoding='utf-8')
app = (ROOT / 'assets' / 'app.js').read_text(encoding='utf-8')
check('conversor registra as três condições de estado excluído', all(repr(status) in converter for status in excluded))
check('dashboard trata as três condições de estado excluído', all(f"'{status}'" in app for status in excluded))
check('faltas consultam etapas concluídas e projeção acumulada', 'productionMapStagesComplete(row)' in app and 'function productionMapMissingItems(row)' in app and 'balances.set(entry.code, balanceWithOrder)' in app)
print(f'MAPA_PRODUTIVO_TESTS_OK checks={passed} failures={len(failed)} records={len(records)}')
if failed:
    print('\n'.join(failed[:20])); raise SystemExit(1)
