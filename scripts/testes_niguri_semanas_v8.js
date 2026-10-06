const fs = require('fs');
const source = fs.readFileSync('assets/app.js', 'utf8');
const start = source.indexOf('function pinsNiguriNormalize');
const end = source.indexOf('function pinsNiguriView');
if (start < 0 || end < 0) throw new Error('Bloco do NIGURI não encontrado');
const n = value => Number(value) || 0;
let pinsNiguriStartWeek = '';
let DATA = { planAnnual: { models: { '10L': { '10/2026': 4, '11/2026': 4, '12/2026': 4 } } }, planMonth: { models: [], months: ['10','11','12'] } };
let PINS = { models: ['10L'], items: [] };
function itemByCode(code) { return PINS.items.find(item => String(item.code) === String(code)); }
eval(source.slice(start, end));
let total = 0;
function assert(condition, message) { total += 1; if (!condition) throw new Error(`Falha ${total}: ${message}`); }

const baseTimeline = pinsNiguriTimeline('10L', '');
assert(baseTimeline.allSlots.length >= 10, 'linha do tempo deve conter semanas de outubro a dezembro');
assert(baseTimeline.slots[0].key === baseTimeline.currentKey, 'padrão inicia na semana atual');
const optionKeys = baseTimeline.allSlots.map(slot => slot.key);
for (const key of optionKeys) {
  const timeline = pinsNiguriTimeline('10L', key);
  assert(timeline.slots[0].key === key, `seleção deve iniciar em ${key}`);
  assert(timeline.slots.every(slot => pinsNiguriWeekDate(slot.key) >= pinsNiguriWeekDate(key)), `não pode mostrar semana anterior a ${key}`);
  total += 1;
}

for (let scenario = 0; scenario < 1800; scenario += 1) {
  const stock = scenario % 61;
  const receipt = scenario % 121;
  const code = `TEST-${scenario}`;
  PINS.items = [{ code, description: 'PINO TESTE', unit: 'UN', stock, safety: 0, modelNeeds: { '10L': 1 }, orders: { 'PED 10/2026': receipt } }];
  pinsNiguriStartWeek = baseTimeline.allSlots[0].key;
  const rowsResult = pinsNiguriRows('10L');
  assert(rowsResult.rows.length === 1, 'item sintético deve aparecer');
  const row = rowsResult.rows[0];
  const monthlyConsumption = rowsResult.timeline.allSlots.filter(slot => slot.month === '10').reduce((sum, slot) => sum + slot.quantity, 0);
  const receiptTotal = row.balances.reduce((sum, cell) => sum + cell.receipts, 0);
  assert(receiptTotal === receipt, `recebimento deve entrar uma única vez: ${receiptTotal} != ${receipt}`);
  assert(row.balances[0].balance === stock - row.balances[0].consumption + receipt, 'recebimento deve ser aplicado na primeira semana');
  const expectedEnd = stock - row.totalNeed + receiptTotal;
  assert(row.balances[row.balances.length - 1].balance === expectedEnd, 'saldo final precisa obedecer estoque - consumo + recebimentos');
  assert(row.totalNeed === row.balances.reduce((sum, cell) => sum + cell.consumption, 0), 'necessidade total deve somar os consumos semanais');
  assert(monthlyConsumption > 0, 'mês com demanda deve distribuir consumo');
  const firstReceiptCell = row.balances.find(cell => cell.receipts > 0);
  assert(!receipt || firstReceiptCell, 'pedido positivo deve aparecer na linha do tempo');
  if (receipt) assert(firstReceiptCell.receipts === receipt, 'quantidade do recebimento deve ser preservada');
  total += 1;
}

console.log(`NIGURI_WEEK_TESTS_OK total=${total} cenarios_recebimento=1800 semanas=${optionKeys.length}`);
