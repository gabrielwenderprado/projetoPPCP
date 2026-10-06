const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA_REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/explosao.json'), 'utf8'));
const ANNUAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/plano-anual.json'), 'utf8'));
const source = fs.readFileSync(path.join(ROOT, 'assets/app.js'), 'utf8');
const start = source.indexOf('function pinsNiguriNormalize');
const end = source.indexOf('function pinsSimulationView');
if (start < 0 || end < 0) throw new Error('bloco NIGURI não encontrado');
const n = value => Number(value) || 0;
const esc = value => String(value ?? '');
let DATA = { ...DATA_REAL, planAnnual: ANNUAL };
let modelNiguriStartWeek = '';
let modelNiguriModel = '';
function itemByCode(code) { return (DATA.items || []).find(item => String(item.code) === String(code)); }
eval(source.slice(start, end));
let tests = 0;
function assert(ok, msg) { tests += 1; if (!ok) throw new Error(`Falha ${tests}: ${msg}`); }

const models = Object.keys(ANNUAL.models);
assert(models.length >= 7, 'plano anual deve possuir os modelos ativos');
for (const model of models) {
  modelNiguriStartWeek = '';
  const timeline = modelNiguriTimeline(model);
  assert(timeline.structureName, `${model} deve encontrar estrutura correspondente`);
  if (!timeline.allSlots.length) {
    assert(Object.keys(ANNUAL.models[model] || {}).length === 0, `${model} sem semanas deve estar sem demanda no plano`);
    continue;
  }
  assert(timeline.allSlots.length > 0, `${model} deve gerar semanas`);
  assert(timeline.slots.length > 0, `${model} deve gerar semanas visíveis`);
  assert(timeline.slots[0].key === timeline.startKey, `${model} inicia na semana escolhida`);
  for (const key of timeline.allSlots.map(slot => slot.key)) {
    modelNiguriStartWeek = key;
    const selected = modelNiguriTimeline(model);
    assert(selected.slots.length > 0, `${model}/${key} deve possuir semanas futuras`);
    assert(selected.slots[0].key === key, `${model}/${key} inicia exatamente na semana selecionada`);
    assert(selected.slots.every(slot => pinsNiguriWeekDate(slot.key) >= pinsNiguriWeekDate(key)), 'não mostrar semana anterior');
  }
}

// Smoke test real: todos os modelos são resolvidos uma vez contra a explosão real.
modelNiguriStartWeek = '';
for (const model of models) {
  const timeline = modelNiguriTimeline(model);
  assert(timeline.structureName, `${model} deve encontrar estrutura real`);
  if (!timeline.slots.length) continue;
  const result = modelNiguriRows(model, 'all', '', 'all');
  assert(Array.isArray(result.rows), `${model} deve retornar linhas reais`);
  assert(result.rows.every(row => row.balances.length === result.timeline.slots.length), `${model} deve ter saldo por semana`);
}

// Cenários sintéticos para verificar recebimento único e carry-forward.
DATA = { items: [{ code: '01.02.03.0000000001', description: 'ITEM SINTÉTICO', analyst: 'ANA', stock: 0, unit: 'UN', safety: 0, orders: { 'PED 10/2026': 100 } }], models: { '10L': [{ code: '01.02.03.0000000001', description: 'ITEM SINTÉTICO', quantity: 1 }] }, planAnnual: { models: { '10L': { '10/2026': 100, '11/2026': 60, '12/2026': 60 } } } };
for (let i = 0; i < 1800; i += 1) {
  const model = '10L';
  const timeline = modelNiguriTimeline(model);
  modelNiguriStartWeek = timeline.allSlots[0].key;
  const row = modelNiguriRows(model).rows[0];
  assert(row, 'item sintético deve aparecer');
  assert(row.balances.reduce((sum, cell) => sum + cell.receipts, 0) === 100, 'pedido mensal deve ser lançado uma única vez');
  assert(row.balances[0].balance === 100 - row.balances[0].consumption, 'recebimento deve entrar antes do consumo final da semana');
  assert(row.totalNeed === row.balances.reduce((sum, cell) => sum + cell.consumption, 0), 'consumo sintético consistente');
  assert(row.status === 'Crítico', 'saldo insuficiente deve ser crítico');
}
console.log(`MODEL_NIGURI_TESTS_OK total=${tests} modelos=${models.length}`);
