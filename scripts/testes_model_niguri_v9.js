const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DATA_REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/explosao.json'), 'utf8'));
const PLAN_ANNUAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/plano-anual.json'), 'utf8'));
const source = fs.readFileSync(path.join(ROOT, 'assets/app.js'), 'utf8');
const monthStart = source.indexOf('function planMonthPeriods');
const monthEnd = source.indexOf('\nfunction currentPlanMonthPeriod', monthStart);
const niguriStart = source.indexOf('function pinsNiguriNormalize');
const niguriEnd = source.indexOf('function pinsSimulationView');
if ([monthStart, monthEnd, niguriStart, niguriEnd].some(index => index < 0)) throw new Error('bloco de calendário/NIGURI não encontrado');

const RealDate = global.Date;
global.Date = class FixedDate extends RealDate {
  constructor(...args) { args.length ? super(...args) : super('2026-11-14T12:00:00'); }
  static now() { return new RealDate('2026-11-14T12:00:00').valueOf(); }
};

const n = value => Number(value) || 0;
const esc = value => String(value ?? '');
let DATA = { ...DATA_REAL, planAnnual: PLAN_ANNUAL };
let modelNiguriStartWeek = '';
let modelNiguriModel = '';
let modelNiguriAnalyst = 'all';
function itemByCode(code) { return (DATA.items || []).find(item => String(item.code) === String(code)); }
eval(`${source.slice(monthStart, monthEnd)}\n${source.slice(niguriStart, niguriEnd)}`);
let tests = 0;
function assert(ok, message) { tests += 1; if (!ok) throw new Error(`Falha ${tests}: ${message}`); }

const models = Object.keys(DATA_REAL.models);
assert(models.length >= 15, 'as estruturas reais da Explosão devem estar carregadas');
for (const model of models) {
  const structure = modelNiguriStructureName(model);
  assert(structure === model, `${model} deve resolver a sua estrutura real`);
  if (model !== 'replica-helio-base') assert(modelNiguriStructureRows(model).length > 0, `${model} deve ter componentes consumíveis`);
}

for (const [label, structure] of [
  ['guindaste 16.5T', 'guin-16T'], ['guindaste 25,5T', 'guin-25T'],
  ['guindaste 45.5T', 'guin-45'], ['guindaste 7,5T', '7T'],
  ['guindaste 21.5T', '21T'], ['guindaste 30.5T', '30-T']
]) assert(modelNiguriStructureName(label) === structure, `${label} deve corresponder à estrutura ${structure}`);
assert(modelNiguriStructureName('guindaste 35.5T') === '', '35.5 deve continuar sem consumo inventado quando a estrutura 35 não existe');
assert(modelNiguriUnmatchedCraneProducts('guin-45').some(entry => /45\.5T TRAVE 4H 3M/i.test(entry.produto)), 'a variante 45.5T 4H/3M sem BOM exacta deve ser sinalizada, não consumida como 5H/3M');

const planFunction = source.slice(source.indexOf('function modelNiguriPlanEntries'), source.indexOf('function modelNiguriOrders'));
assert(planFunction.includes('DATA?.planAnnual?.rows') && !planFunction.includes('DATA?.planMonth?.models'), 'NIGURI dos modelos deve ler as linhas do Plano Anual, não os totais do Plano Mês');

const plan21 = modelNiguriPlanEntries('21T')[0];
assert(plan21.rows.length === 9, '21T deve encontrar as nove ENs datadas do Plano Anual');
const timeline21 = modelNiguriTimeline('21T');
const week21First = timeline21.allSlots.find(slot => slot.label === 'S46' && slot.month === '11' && slot.year === '2026');
const week21Last = timeline21.allSlots.find(slot => slot.label === 'S49' && slot.month === '11' && slot.year === '2026');
assert(week21First?.quantity === 1, 'a EN 21T de 12/11/2026 deve entrar na S46');
assert(week21Last?.quantity === 8, 'as oito ENs 21T de 30/11/2026 devem entrar na S49');
assert(timeline21.allSlots.reduce((sum, slot) => sum + slot.quantity, 0) === 9, 'as nove ENs do guindaste 21 devem ser contabilizadas exactamente uma vez');
const expected21 = 9 * modelNiguriStructureRows('21T').reduce((sum, item) => sum + item.quantity, 0);
const actual21 = modelNiguriRows('21T').rows.reduce((sum, item) => sum + item.totalNeed, 0);
assert(actual21 === expected21, 'a necessidade de materiais do 21T deve ser a estrutura por nove ENs, sem rateio mensal');

const plan30 = modelNiguriPlanEntries('30-T')[0];
assert(plan30.rows.length === 1 && plan30.rows[0].data === '2026-12-04', '30-T deve ler a EN de 04/12/2026 no Plano Anual');
const timeline30 = modelNiguriTimeline('30-T');
assert(timeline30.allSlots.some(slot => slot.label === 'S49' && slot.quantity === 1), 'a EN 30-T de 04/12/2026 deve ser projectada na S49');
assert(timeline30.allSlots.reduce((sum, slot) => sum + slot.quantity, 0) === 1, 'a única EN 30-T deve ser contabilizada uma vez');

const plan7 = modelNiguriPlanEntries('7T')[0];
assert(plan7.rows.length === 7, 'NIGURI 7T deve encontrar as sete ENs do Plano Anual');
assert(modelNiguriTimeline('7T').allSlots.some(slot => slot.label === 'S53' && slot.quantity === 7), 'as sete ENs 7T devem entrar na semana exacta S53');

// Smoke test com datas exactas e recebimentos mensais e datados.
const now = new Date();
const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 4);
const nextIso = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
const currentMonth = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
DATA = {
  items: [{ code: '01.02.03.0000000001', description: 'ITEM SINTÉTICO', analyst: 'ANA', stock: 0, safety: 0, unit: 'UN', orders: { [`PED ${currentMonth}`]: 100 }, obtention: [{ quantity: 10, plannedDate: nextIso }] }],
  models: { '10L': [{ code: '01.02.03.0000000001', description: 'ITEM SINTÉTICO', quantity: 1 }] },
  planAnnual: { rows: [
    { pedido: 'EN-CURRENT', modelo: '10L', estrutura: '10L', data: currentDate },
    { pedido: 'EN-NEXT', modelo: '10L', estrutura: '10L', data: nextIso }
  ] }
};
for (let i = 0; i < 25; i += 1) {
  modelNiguriStartWeek = '';
  const timeline = modelNiguriTimeline('10L');
  assert(timeline.allSlots.reduce((sum, slot) => sum + slot.quantity, 0) === 2, 'cada linha datada do Plano Anual representa um veículo');
  const row = modelNiguriRows('10L').rows[0];
  assert(row, 'item sintético deve aparecer');
  assert(row.totalNeed === 2, 'duas ENs em semanas exactas devem gerar duas unidades de consumo');
  assert(row.balances.reduce((sum, cell) => sum + cell.receipts, 0) === 110, 'pedido mensal e recebimento com data exacta devem entrar uma única vez');
  assert(row.balances[0].receipts === 100, 'pedido mensal deve entrar na primeira semana desse mês');
  const exactWeek = pinsNiguriWeekKey(nextIso);
  assert(row.balances.find(cell => cell.key === exactWeek)?.receipts === 10, 'recebimento datado deve entrar na semana ISO da sua data');
  assert(row.balances[row.balances.length - 1].balance === 108, 'saldo semanal deve acumular recebimentos e consumo na ordem correta');
}

global.Date = RealDate;
console.log(`MODEL_NIGURI_TESTS_OK total=${tests} modelos=${models.length} source=PLANO_ANUAL exact_week_dates=true`);
