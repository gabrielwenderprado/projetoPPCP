const fs = require('fs');
const source = fs.readFileSync('assets/app.js', 'utf8');
const start = source.indexOf('function planAnnualPinConsumption');
const end = source.indexOf('function pinsNiguriMonthSlots', start);
if (start < 0 || end < 0) throw new Error('Funções de consumo mensal não encontradas');
const n = value => Number(value) || 0;
const fmt = value => String(value);
const PINS = { models: ['18LDDI', '15LDDI', '13LDDI', '10S', '13AT', '10L', '13LDI'], items: [] };
const DATA = { planAnnual: { models: {} }, items: [] };
function itemByCode(code) { return DATA.items.find(item => String(item.code) === String(code)); }
eval(source.slice(start, end));
let checks = 0;
function assert(condition, message) { checks += 1; if (!condition) throw new Error(`Falha ${checks}: ${message}`); }

for (const model of PINS.models) DATA.planAnnual.models[model] = { '10/2026': 2, '11/2026': 3, '12/2026': 4 };
for (let i = 0; i < 150; i += 1) {
  const code = `PIN-${i}`;
  const modelNeeds = Object.fromEntries(PINS.models.map((model, index) => [model, (i + index) % 4]));
  const pin = { code, description: `Pino ${i}`, unit: 'UN', stock: i, modelNeeds };
  PINS.items.push(pin);
  const orders = { 'PED 10/2026': i % 5, 'PED 11/2026': i % 7, 'PED 12/2026': i % 9 };
  DATA.items.push({ code, description: pin.description, unit: 'UN', stock: i, orders, demands: {} });
  const rows = planAnnualPinConsumption(code);
  assert(rows.length === 3, `meses do pino ${i}`);
  const expected = rows.map((row, monthIndex) => PINS.models.reduce((sum, model, modelIndex) => sum + ([2,3,4][monthIndex] * modelNeeds[model]), 0));
  assert(rows.every((row, index) => row.quantity === expected[index]), `consumo calculado ${i}`);
  const orderRows = pinPlanOrderRows(code);
  assert(orderRows[0].order === i % 5 && orderRows[1].order === i % 7 && orderRows[2].order === i % 9, `pedidos mensais ${i}`);
  assert(orderRows.every(row => row.message.includes('Já tem pedido') || row.message.includes('Colocar')), `mensagem de pedido ${i}`);
}
for (const model of PINS.models) {
  for (let i = 0; i < 100; i += 1) {
    const code = `PIN-${i}`;
    const rows = planAnnualPinConsumption(code, model);
    const unit = PINS.items[i].modelNeeds[model];
    assert(rows.length === (unit > 0 ? 3 : 0), `modelo selecionado ${model} caso ${i}`);
    if (unit > 0) assert(rows[0].quantity === 2 * unit && rows[1].quantity === 3 * unit && rows[2].quantity === 4 * unit, `demanda por modelo ${model} caso ${i}`);
  }
}
console.log(`DEMANDA_PINOS_V6_OK checks=${checks}`);
