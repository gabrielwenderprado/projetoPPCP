"use strict";
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'assets/app.js'), 'utf8');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/explosao.json'), 'utf8'));
DATA.planAnnual = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/plano-anual.json'), 'utf8'));
const PINS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pinos.json'), 'utf8'));
const PRODUCTION_MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mapa-produtivo.json'), 'utf8'));
const excludedStart = app.indexOf('function annualRowIsExcluded');
const normalizeStart = app.indexOf('function pinsNiguriNormalize');
const end = app.indexOf('function pinsSimulationView', normalizeStart);
if (excludedStart < 0 || normalizeStart < 0 || end < 0) throw new Error('Funções da linha do tempo NIGURI não encontradas');
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...args) { args.length ? super(...args) : super('2026-11-26T12:00:00'); }
  static now() { return new RealDate('2026-11-26T12:00:00').valueOf(); }
}
const context = {
  Date: FixedDate, DATA, PINS, PRODUCTION_MAP, pinsNiguriStartWeek: 'all', selectedPinModel: 'Todos os modelos',
  n: value => Number(value) || 0,
  fmt: value => (Number(value) || 0).toLocaleString('pt-BR'),
  esc: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])),
  itemByCode: code => DATA.items.find(item => String(item.code) === String(code)),
  $: () => null,
  bindMaterialButtons() {},
  bindNiguriPinButtons() {}
};
vm.createContext(context);
vm.runInContext(`${app.slice(excludedStart, app.indexOf('function pinsNiguriNormalize'))}\n${app.slice(normalizeStart, end)}\nthis.api = { pinsNiguriTimeline, pinsNiguriRows, pinsNiguriView, pinsNiguriWeekDate, pinsNiguriWeeklyConsumption };`, context);
const { api } = context;
let checks = 0;
function assert(value, message) { checks += 1; if (!value) throw new Error(`Falha ${checks}: ${message}`); }
const all = api.pinsNiguriRows('Todos os modelos');
assert(all.timeline.annualSource === true, 'projeção deve usar as datas exactas do PLANO ANUAL');
assert(all.timeline.allSlots.length > 10, 'linha do tempo deve ultrapassar os doze blocos semanais antigos');
const last = all.timeline.allSlots.at(-1);
assert(last.month === '03' && last.year === '2027', `horizonte deve chegar a 03/2027 (actual: ${last.month}/${last.year})`);
assert(all.timeline.slots.length === all.timeline.allSlots.length, 'Todas as semanas deve mostrar a linha temporal completa');
const selected = all.timeline.allSlots.find(slot => slot.label === 'S49' && slot.year === '2026');
assert(!!selected, 'deve existir a semana S49 de 2026 na lista de semanas');
context.pinsNiguriStartWeek = selected.key;
const exact = api.pinsNiguriRows('Todos os modelos');
assert(exact.timeline.slots.length === 1 && exact.timeline.slots[0].key === selected.key, 'seleccionar S49 deve apresentar apenas S49');
assert(exact.timeline.calculationSlots.at(-1)?.key === selected.key, 'saldo de S49 deve acumular até essa semana e não avançar para semanas posteriores');
assert(exact.rows.length > 0 && exact.rows.every(item => item.balances.length === 1), 'tabela filtrada deve apresentar uma única coluna semanal por pino');
assert(exact.rows.every(item => item.totalNeed === item.balances[0].consumption), 'necessidade apresentada deve ser apenas a da semana seleccionada');
const targetPinCode = '02.02.01.0000085281';
const targetPin = exact.rows.find(item => item.code === targetPinCode);
assert(!!targetPin, `pino ${targetPinCode} deve existir na projecção conjunta`);
assert(targetPin.balances[0].consumption === 2, `na S49, apenas a EN 15LDDI prevista consome 2 unidades deste pino (actual: ${targetPin.balances[0].consumption})`);
const targetPinData = PINS.items.find(item => item.code === targetPinCode);
const simulated18 = api.pinsNiguriWeeklyConsumption(targetPinData, '18LDDI', { plannedEntries: [{ modelo: '18LDDI', estrutura: '18LDDI' }] });
assert(simulated18 === 2, `a BOM de 18LDDI deve fornecer 2 unidades por EN mesmo que o snapshot semanal antigo indique outro valor (actual: ${simulated18})`);
context.pinsNiguriStartWeek = 'all';
const html = api.pinsNiguriView();
assert(html.includes('Todas as semanas') && html.includes('Semana analisada'), 'interface deve permitir restaurar a visão de todas as semanas');
assert(html.includes('março de 2027') && html.includes('PLANO ANUAL'), 'interface deve indicar a fonte e o horizonte de março de 2027');
console.log(`NIGURI_PIN_HORIZON_OK checks=${checks} weeks=${all.timeline.allSlots.length} through=${last.month}/${last.year} single=${selected.label}`);
