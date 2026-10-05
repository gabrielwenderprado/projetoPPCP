const fs = require('fs');
const source = fs.readFileSync('assets/app.js', 'utf8');
const start = source.indexOf('function pvNormalize');
const end = source.indexOf('// Reconstrói o conteúdo da tela sempre que uma área ou filtro muda.');
if (start < 0 || end < 0) throw new Error('Funções EN/PV não encontradas');
const n = value => Number(value) || 0;
const fmt = value => String(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const PINS = { models: ['18LDDI', '15LDDI', '13LDDI', '10S', '13AT', '10L', '13LDI'] };
const DATA = { models: {
  '10L': [
    { code: 'CRIT-10L', description: 'BLOQUEIO DE ELEVACAO DO CESTO', quantity: 1 },
    { code: 'SENS-10L', description: 'SENSOR DE BRACOS DO BERCO', quantity: 1 },
    { code: 'PAD-10L', description: 'MANGUEIRA HIDRAULICA', quantity: 1 }
  ],
  '10S': [{ code: 'SENS-10S', description: 'SENSOR DE BRACOS DO BERCO' }],
  '13AT': [{ code: 'ITEM-13AT', description: 'ITEM PADRAO 13 AT' }],
  '18LDDI': [{ code: 'ITEM-18', description: 'ITEM PADRAO 18 LDDI' }]
}, planAnnual: { rows: [] }, planMonth: { liberacoes: [] }, items: [] };
let EN_PV_REVIEWS = {};
let currentUser = { name: 'Teste' };
function saveENPVReviews() {}
function itemByCode(code) { return DATA.items.find(item => String(item.code) === String(code)); }
const availabilityStart = source.indexOf('function availabilityStatus');
const pvStart = source.indexOf('function pvNormalize');
if (availabilityStart < 0 || pvStart < 0) throw new Error('Regra de status não encontrada');
eval(source.slice(availabilityStart, pvStart));
eval(source.slice(start, end));
const ordersStart = source.indexOf('function ordersItemsForMonth');
const ordersEnd = source.indexOf('function demandPanel', ordersStart);
eval(source.slice(ordersStart, ordersEnd));
let total = 0;
function assert(condition, message) { total += 1; if (!condition) throw new Error(`Falha ${total}: ${message}`); }

const modelCases = [
  ['CESTO AEREO SKYCITY 10 L', '10L'], ['CESTO AÉREO SKYCITY 10 L', '10L'], ['SKYCITY 10L', '10L'], ['SKY CITY 10 L', '10L'], ['10 L', '10L'],
  ['CESTO AEREO SKYCITY 10 S', '10S'], ['SKY CITY 10S', '10S'], ['10 S', '10S'], ['SKYCITY 13,5 AT', '13AT'], ['SKY CITY 13.5 AT', '13AT'],
  ['13 AT', '13AT'], ['SKYCITY 15 LDDI', '15LDDI'], ['15 LDDI', '15LDDI'], ['SKYCITY 18 LDDI', '18LDDI'], ['18LDDI', '18LDDI'],
  ['SKYCITY 13 LDDI', '13LDDI'], ['13 LDDI', '13LDDI'], ['SKYCITY 13 LDI', '13LDI'], ['13 LDI', '13LDI'], ['SKYCITY 10 HDOC', '10HDOC']
];
for (const [text, expected] of modelCases) assert(pvProductModel(text) === expected, `${text} => ${pvProductModel(text)}, esperado ${expected}`);
for (const [text, expected] of modelCases) assert(pvModelKey(text) === expected || expected === '10HDOC', `chave ${text}`);

for (let i = 0; i < 60; i += 1) {
  const model = i % 2 ? '10S' : '10L';
  const product = i % 2 ? `Produto especial SKY CITY 10 S - variação ${i}` : `Cesto aéreo SKYCITY 10 L - variação ${i}`;
  assert(pvProductModel(product) === model, `variação de produto ${i}`);
}

for (let i = 0; i < 40; i += 1) {
  const text = i % 2 ? `SENSOR DE BRACOS DO BERCO opcional ${i}` : `BLOQUEIO DE ELEVACAO DO CESTO opcional ${i}`;
  const match = pvStructureMatch(text, '10L');
  assert(match && (match.code === 'SENS-10L' || match.code === 'CRIT-10L'), `correspondência estrutural ${i}`);
}
for (let i = 0; i < 20; i += 1) {
  const match = pvStructureMatch(`COMPONENTE DESCONHECIDO SEM RELACAO ${i}`, '10L');
  assert(!match, `item desconhecido não deve ser vinculado ${i}`);
}

for (let i = 0; i < 20; i += 1) {
  const row = { en: `EN${String(10000 + i)}`, modelo: i % 2 ? '10S' : '10L' };
  EN_PV_REVIEWS[row.en] = { analysis: { model: row.modelo, status: 'analyzed', criticalItems: [] }, checklist: { enVinculada: true, vermelhosRevisados: true, estruturaConferida: true, scResolvida: true, liberada: true } };
  assert(enPVStatus(row)[0] === 'Concluída', `status concluído ${i}`);
  EN_PV_REVIEWS[row.en].checklist.liberada = false;
  assert(enPVStatus(row)[0] === 'Em análise', `status em análise ${i}`);
  EN_PV_REVIEWS[row.en].analysis.criticalItems = [{ text: 'item', match: null }];
  assert(enPVStatus(row)[0] === 'Crítica', `status crítico ${i}`);
  EN_PV_REVIEWS[row.en].analysis.criticalItems = [];
  EN_PV_REVIEWS[row.en].analysis.model = row.modelo === '10L' ? '10S' : '10L';
  assert(enPVStatus(row)[0] === 'Divergência de modelo', `divergência de modelo ${i}`);
}
assert(enPVStatus({ en: 'EN-SALVA', pv: 'PV-12345' })[0] === 'PV gerado', 'PV salvo deve deixar de aparecer como não gerado');
EN_PV_REVIEWS['EN-ANALISE'] = { analysis: { pv: 'PV-67890', status: 'manual' } };
assert(enPVSavedNumber({ en: 'EN-ANALISE' }) === 'PV-67890', 'PV dentro da análise deve ser exibido');
assert(enPVStatus({ en: 'EN-ANALISE' })[0] === 'PV gerado', 'PV dentro da análise deve alterar o status');

DATA.items = [
  { code: 'CRIT-10L', description: 'BLOQUEIO DE ELEVACAO DO CESTO', stock: 0, orders: { 'PED 10/2026': 4 } },
  { code: 'SENS-10L', description: 'SENSOR DE BRACOS DO BERCO', stock: 0, orders: {} },
  { code: 'PAD-10L', description: 'MANGUEIRA HIDRAULICA', stock: 10, orders: {} }
];
for (let i = 0; i < 120; i += 1) {
  const en = `EN-CRIT-${i}`;
  DATA.planAnnual.rows.push({ pedido: en, cliente: 'TESTE', produto: 'SKYCITY 10 L', modelo: '10L', mes: '10/2026' });
  const critical = criticalItemsForEN(en);
  assert(critical.length === 2, `quantidade de críticos do modelo 10L ${i}`);
  assert(critical[0].code === 'CRIT-10L' && critical[0].orders.includes('10/2026: 4'), `pedido e código crítico ${i}`);
}
for (let i = 0; i < 120; i += 1) {
  const month = `DEM ${String((i % 9) + 1).padStart(2, '0')}/2027`;
  const rows = ordersItemsForMonth([{ code: `M-${i}`, stock: i, demands: { [month]: i + 1 } }], month);
  assert(rows.length === 1 && rows[0].balance === -1, `itens de pedidos por mês ${i}`);
}

const groups = pvGroupTextItems([
  { str: 'PRODUTO', transform: [1,0,0,10,10,100], width: 60 },
  { str: 'SKYCITY 10 L', transform: [1,0,0,10,80,100], width: 90 },
  { str: 'ITEM A', transform: [1,0,0,10,10,80], width: 30 },
  { str: 'ITEM B', transform: [1,0,0,10,10,60], width: 30 }
]);
assert(groups.length === 3, 'agrupamento de linhas do PDF');
assert(groups[0].text.includes('PRODUTO') && groups[0].text.includes('SKYCITY'), 'ordenação horizontal da linha');
assert(groups[2].text === 'ITEM B', 'ordenação vertical das linhas');

console.log(`EN_PV_TESTS_OK total=${total}`);
