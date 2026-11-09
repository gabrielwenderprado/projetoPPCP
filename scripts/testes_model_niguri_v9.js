const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA_REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/explosao.json'), 'utf8'));
const PLAN_MONTH = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/plano-mes.json'), 'utf8'));
const source = fs.readFileSync(path.join(ROOT, 'assets/app.js'), 'utf8');
const monthStart = source.indexOf('function planMonthPeriods');
const monthEnd = source.indexOf('\nfunction currentPlanMonthPeriod', monthStart);
const niguriStart = source.indexOf('function pinsNiguriNormalize');
const niguriEnd = source.indexOf('function pinsSimulationView');
if ([monthStart, monthEnd, niguriStart, niguriEnd].some(index => index < 0)) throw new Error('bloco de calendário/NIGURI não encontrado');
const n = value => Number(value) || 0;
const esc = value => String(value ?? '');
let DATA = { ...DATA_REAL, planMonth: PLAN_MONTH };
let modelNiguriStartWeek = '';
let modelNiguriModel = '';
let modelNiguriAnalyst = 'all';
function itemByCode(code) { return (DATA.items || []).find(item => String(item.code) === String(code)); }
eval(`${source.slice(monthStart, monthEnd)}\n${source.slice(niguriStart, niguriEnd)}`);
let tests = 0;
function assert(ok, msg) { tests += 1; if (!ok) throw new Error(`Falha ${tests}: ${msg}`); }

const models = Object.keys(DATA_REAL.models);
assert(models.length >= 15, 'as estruturas reais da Explosão devem estar carregadas');
for (const model of models) {
  modelNiguriStartWeek = '';
  const timeline = modelNiguriTimeline(model);
  assert(timeline.structureName === modelNiguriStructureName(model), `${model} deve resolver a estrutura existente`);
  assert(timeline.allSlots.length > 0, `${model} deve expor semanas dinâmicas do Plano Mês`);
  assert(timeline.slots.length > 0, `${model} deve exibir semanas futuras`);
  assert(timeline.slots[0].key === timeline.startKey, `${model} inicia na semana escolhida`);
  for (const key of timeline.allSlots.map(slot => slot.key)) {
    modelNiguriStartWeek = key;
    const selected = modelNiguriTimeline(model);
    assert(selected.slots[0]?.key === key, `${model}/${key} inicia exactamente na semana seleccionada`);
    assert(selected.slots.every(slot => pinsNiguriWeekDate(slot.key) >= pinsNiguriWeekDate(key)), `${model}/${key} não mostra semanas anteriores`);
  }
}

// Os nomes no PLANO MES podem incluir capacidade decimal; o alias usa apenas a base numérica.
for (const [label, structure] of [
  ['guindaste 16.5T', 'guin-16T'], ['guindaste 25,5T', 'guin-25T'],
  ['guindaste 45.5T', 'guin-45'], ['guindaste 7,5T', '7T'], ['guindaste 30T', '30-T']
]) assert(modelNiguriStructureName(label) === structure, `${label} deve corresponder a ${structure}`);
assert(modelNiguriStructureName('guindaste 35.5T') === '', '35.5 deve ser associado ao modelo-base 35, mas exige a estrutura guindaste 35 ausente no Excel');
const sevenTonPlan = modelNiguriPlanEntries('7T')[0].quantidades;
assert(sevenTonPlan['11/2026'] === 7, 'NIGURI 7T deve receber as 7 unidades de Novembro do PLANO MES');
const sevenTonTimeline = modelNiguriTimeline('7T');
assert(sevenTonTimeline.allSlots.some(slot => slot.quantity > 0), 'NIGURI 7T deve projectar consumo semanal em Novembro');
assert(sevenTonTimeline.allSlots.reduce((sum, slot) => sum + (slot.month === '11' && slot.year === '2026' ? slot.quantity : 0), 0) === 7, 'as sete unidades de Novembro devem ser distribuídas integralmente pelas semanas ainda abertas');
const fortyFivePlan = modelNiguriPlanEntries('guin-45')[0].quantidades;
assert(fortyFivePlan['10/2026'] === 3, 'guindaste 45 deve agregar o PLANO MES de Outubro pela estrutura correcta');
assert(fortyFivePlan['11/2026'] === 0, 'o snapshot de Novembro não planeia unidade de guindaste 45');
const planFunction = source.slice(source.indexOf('function modelNiguriPlanEntries'), source.indexOf('function modelNiguriRows'));
assert(planFunction.includes('DATA?.planMonth?.models') && !planFunction.includes('DATA?.planAnnual?.rows'), 'NIGURI dos modelos deve usar PLANO MES, não ENs/datas do Plano Anual');

// Smoke test de cálculo de saldo e recebimento numa estrutura sintética.
const now = new Date();
const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
const nextMonth = `${String(nextDate.getMonth() + 1).padStart(2, '0')}/${nextDate.getFullYear()}`;
DATA = {
  items: [{ code: '01.02.03.0000000001', description: 'ITEM SINTÉTICO', analyst: 'ANA', stock: 0, safety: 0, unit: 'UN', orders: { [`PED ${currentMonth}`]: 100 } }],
  models: { '10L': [{ code: '01.02.03.0000000001', description: 'ITEM SINTÉTICO', quantity: 1 }] },
  planMonth: { periods: [{ key: currentMonth, month: currentMonth.slice(0,2), year: currentMonth.slice(3) }, { key: nextMonth, month: nextMonth.slice(0,2), year: nextMonth.slice(3) }], models: [{ modelo: '10L', quantidades: { [currentMonth]: 100, [nextMonth]: 60 } }] }
};
for (let i = 0; i < 100; i += 1) {
  const timeline = modelNiguriTimeline('10L');
  modelNiguriStartWeek = timeline.allSlots[0].key;
  const row = modelNiguriRows('10L').rows[0];
  assert(row, 'item sintético deve aparecer');
  assert(row.balances.reduce((sum, cell) => sum + cell.receipts, 0) === 100, 'pedido mensal deve ser lançado uma única vez');
  assert(row.balances[0].balance === 100 - row.balances[0].consumption, 'recebimento deve entrar antes do consumo semanal');
  assert(row.totalNeed === row.balances.reduce((sum, cell) => sum + cell.consumption, 0), 'consumo sintético consistente');
  assert(row.status === 'Crítico', 'saldo insuficiente deve ser crítico');
}
console.log(`MODEL_NIGURI_TESTS_OK total=${tests} modelos=${models.length} source=PLANO_MES`);
