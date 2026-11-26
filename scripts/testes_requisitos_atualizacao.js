const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
function section(start, end) {
  const a = app.indexOf(start);
  const b = app.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Não foi possível localizar segmento ${start}`);
  return app.slice(a, b);
}

// Estoque mínimo, gravação local e vinculação do evento de edição.
const minimumCode = section('const STOCK_MINIMUMS_STORAGE_KEY', '// Lista local dos avisos enviados pela produção.');
let renderCount = 0;
let minimumRowUpdateCount = 0;
const minimumContext = {
  localStorage: { values: {}, getItem(key) { return this.values[key] || null; }, setItem(key, value) { this.values[key] = value; } },
  document: { querySelectorAll() { return []; } }, console, render() { renderCount += 1; }, updateStockMinimumRow() { minimumRowUpdateCount += 1; }
};
minimumContext.n = value => Number(value) || 0;
vm.createContext(minimumContext);
const localResult = JSON.parse(vm.runInContext(`${minimumCode}\nSTOCK_MINIMUMS = loadStockMinimums();
const input = { dataset: { stockMinimum: 'MAT-1' }, value: '3', onchange: null };
document.querySelectorAll = () => [input]; bindStockMinimumInputs(); input.onchange();
const below = isBelowMinimum({ code: 'MAT-1', stock: 2, safety: 9 });
const saved = JSON.parse(localStorage.getItem(STOCK_MINIMUMS_STORAGE_KEY));
STOCK_MINIMUMS = loadStockMinimums();
const restored = configuredMinimum({ code: 'MAT-1', safety: 9 });
input.value = ''; input.onchange();
JSON.stringify({ minimum: configuredMinimum({ code: 'MAT-1', safety: 9 }), below, saved, restored, cleared: !Object.prototype.hasOwnProperty.call(STOCK_MINIMUMS, 'MAT-1') });`, minimumContext));
localResult.renders = renderCount;
localResult.rowUpdates = minimumRowUpdateCount;
assert.deepStrictEqual(localResult, { minimum: 9, below: true, saved: { 'MAT-1': 3 }, restored: 3, cleared: true, renders: 0, rowUpdates: 2 });
const detailCode = section('function openMaterialDetail', 'function openPinPlanDetail');
assert(detailCode.includes('configuredMinimum(item)'), 'O detalhe deve exibir o mínimo local no campo de segurança');

// A decisão positiva de compra supera pedido existente; sem necessidade, pedido exige follow-up.
const purchaseCode = section('function hasFollowUpOrder', 'function monthDate') + section('function suggestedPurchase', 'function loadCalferTransactions');
const purchaseContext = { n: value => Number(value) || 0, configuredMinimum: item => Number(item.minimum ?? item.safety ?? 0), overdueOrders: item => item.overdue ? [{}] : [], hasOpenOrder: item => Object.values(item.orders || {}).some(value => Number(value) > 0), purchaseAction: () => '<button>+</button>' };
vm.createContext(purchaseContext);
vm.runInContext(`${purchaseCode}
const shortage = { code:'MAT-2', stock:2, safety:1, minimum:1, orders:{'PED 12/2026':1}, demands:{} };
const buy = procurementDecision(shortage, 5);
const noShortageWithOrder = procurementDecision({ ...shortage, stock:20 }, 1);
JSON.stringify({ buy, noShortageWithOrder, action:procurementAction(shortage,5) });`, purchaseContext);
const purchaseResult = JSON.parse(vm.runInContext(`JSON.stringify({buy:procurementDecision({code:'MAT-2',stock:2,safety:1,minimum:1,orders:{'PED 12/2026':1},demands:{}},5), noShortageWithOrder:procurementDecision({code:'MAT-2',stock:20,safety:1,minimum:1,orders:{'PED 12/2026':1},demands:{}},1), action:procurementAction({code:'MAT-2',stock:2,safety:1,minimum:1,orders:{'PED 12/2026':1},demands:{}},5)})`, purchaseContext));
assert.strictEqual(purchaseResult.buy.label, 'Comprar');
assert.strictEqual(purchaseResult.buy.canBuy, true);
assert.strictEqual(purchaseResult.noShortageWithOrder.label, 'Follow-up');
assert(purchaseResult.action.includes('Comprar') && purchaseResult.action.includes('<button>'));

// Testa a projeção real EN a EN: uma EN na semana 48 é atendida; das cinco na semana 50, faltam somente as duas últimas.
const mapCode = section('function isPurchasedMaterial', 'function matchesGlobalFilters') + section('function productionStatusExcluded', 'function openProductionMapDetail');
const materialCode = '12.34.56.1234567890';
let mapContext;
mapContext = { n: value => Number(value) || 0, DATA: { models: { '10S': [{ code: materialCode, description: 'Componente de teste', quantity: 1 }] }, items: [{ code: materialCode, description: 'Componente de teste', stock: 4, orders: {}, unit: 'UN', obtentionType: 'Comprado' }], planAnnual: { rows: [] } }, PRODUCTION_MAP: { records: [] }, PRODUCTION_DISMISSED_ITEMS: {}, itemByCode: code => mapContext.DATA.items.find(item => item.code === code), isProductionItemDismissed: () => false };
vm.createContext(mapContext);
const dates = ['2026-11-23', '2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11'];
const rows = dates.map((date, index) => ({ en: `EN-${index + 1}`, model: '10S', week: index === 0 ? '48' : '50', month: index === 0 ? 11 : 12, finalDate: '', productionStatus: 'EM PRODUÇÃO', productionStatusNormalized: 'EM PRODUCAO', stages: [] }));
mapContext.DATA.planAnnual.rows = rows.map((row, index) => ({ pedido: row.en, modelo: '10S', data: dates[index] }));
mapContext.PRODUCTION_MAP.records = rows;
vm.runInContext(`${mapCode}
JSON.stringify({ first:productionMapMissingItems(PRODUCTION_MAP.records[0]).length, week50:PRODUCTION_MAP.records.slice(1).map(row=>productionMapMissingItems(row).length), excluded:['Vitrine','VITRINI','Entregue'].map(status=>productionMapMissingItems({...PRODUCTION_MAP.records[0],productionStatus:status,productionStatusNormalized:status.toUpperCase()}).length), completed:productionMapMissingItems({...PRODUCTION_MAP.records[0],stages:[{name:'Corte e dobra',completed:true},{name:'Solda bases',completed:true},{name:'Subconjunto',completed:true},{name:'Terceiro eixo',completed:true},{name:'Encarroçamento',completed:true},{name:'Máquina',completed:true},{name:'Integração',completed:true},{name:'Montagem final',completed:true}]}).length});`, mapContext);
const mapResult = JSON.parse(vm.runInContext(`JSON.stringify({first:productionMapMissingItems(PRODUCTION_MAP.records[0]).length, week50:PRODUCTION_MAP.records.slice(1).map(row=>productionMapMissingItems(row).length), excluded:['Vitrine','VITRINI','Entregue'].map(status=>productionMapMissingItems({...PRODUCTION_MAP.records[0],productionStatus:status,productionStatusNormalized:status.toUpperCase()}).length), completed:productionMapMissingItems({...PRODUCTION_MAP.records[0],stages:[{name:'Corte e dobra',completed:true},{name:'Solda bases',completed:true},{name:'Subconjunto',completed:true},{name:'Terceiro eixo',completed:true},{name:'Encarroçamento',completed:true},{name:'Máquina',completed:true},{name:'Integração',completed:true},{name:'Montagem final',completed:true}]}).length})`, mapContext));
assert.strictEqual(mapResult.first, 0);
assert.deepStrictEqual(mapResult.week50, [0, 0, 0, 1, 1]);
assert.deepStrictEqual(mapResult.excluded, [0, 0, 0]);
assert.strictEqual(mapResult.completed, 0);
const scheduleFallbacks = JSON.parse(vm.runInContext(`(()=>{const row={en:'EN-F',week:'50',finalDate:'2026-12-04'};DATA.planAnnual.rows.push({pedido:'EN-F',modelo:'10S',data:'',mes:'12/2026'});const finalDate=productionMapScheduleDate(row);row.finalDate='';return JSON.stringify({finalDate,weekDate:productionMapScheduleDate(row)});})()`, mapContext));
assert.strictEqual(scheduleFallbacks.finalDate, '2026-12-04');
assert.strictEqual(scheduleFallbacks.weekDate, '2026-12-07');
const receiptContext = { ...mapContext, DATA: JSON.parse(JSON.stringify(mapContext.DATA)), PRODUCTION_MAP: JSON.parse(JSON.stringify(mapContext.PRODUCTION_MAP)) };
receiptContext.itemByCode = code => receiptContext.DATA.items.find(item => item.code === code);
receiptContext.DATA.items[0].orders = { 'PED 12/2026': 2 };
vm.createContext(receiptContext);
vm.runInContext(mapCode, receiptContext);
const coveredByOrders = JSON.parse(vm.runInContext(`JSON.stringify(PRODUCTION_MAP.records.slice(1).map(row=>productionMapMissingItems(row).length))`, receiptContext));
assert.deepStrictEqual(coveredByOrders, [0, 0, 0, 0, 0]);

// O NIGURI de todos os modelos agrega os códigos e calcula consumo pela EN/estrutura.
const niguriCode = section('function modelNiguriNormalize', 'function modelNiguriView');
const niguriContext = {
  DATA: {
    models: {
      'Modelo A': [{ code: materialCode, quantity: 1 }, { code: '12.34.56.1234567891', quantity: 2 }],
      'Modelo B': [{ code: materialCode, quantity: 2 }, { code: '12.34.56.1234567892', quantity: 4 }]
    },
    items: [
      { code: materialCode, description: 'Compartilhado', stock: 10, safety: 0, orders: {}, analyst: 'ANA', unit: 'UN' },
      { code: '12.34.56.1234567891', description: 'A', stock: 20, safety: 0, orders: {}, analyst: 'ANA', unit: 'UN' },
      { code: '12.34.56.1234567892', description: 'B', stock: 20, safety: 0, orders: {}, analyst: 'ANA', unit: 'UN' }
    ],
    planAnnual: { unmatchedCraneProducts: [{ produto: 'GUINDASTE NEXT NX 45.5T TRAVE 4H 3M', quantidade: 1 }, { produto: 'CARROCERIA CARGA SECA PARA GUINDASTE', quantidade: 2 }], rows: [
      { pedido: 'EN-A', estrutura: 'Modelo A', data: '2026-12-01' },
      { pedido: 'EN-B', estrutura: 'Modelo B', data: '2026-12-02' }
    ] }
  },
  n: value => Number(value) || 0,
  itemByCode(code) { return niguriContext.DATA.items.find(item => item.code === code); },
  modelNiguriStartWeek: '',
  pinsNiguriWeekKey(value) { const d = new Date(`${String(value).slice(0,10)}T12:00:00`); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; },
  pinsNiguriWeekDate(key) { const m=String(key||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); return m?new Date(Number(m[1]),Number(m[2]),Number(m[3])):null; },
  pinsNiguriCurrentWeekKey(date = new Date()) { const d=new Date(date.getFullYear(),date.getMonth(),date.getDate()); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; },
  getWeekNumber(date) { const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())); const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day); const start=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d-start)/86400000)+1)/7); }
};
class FrozenDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-25T12:00:00'])); } static now() { return new Date('2026-11-25T12:00:00').getTime(); } }
niguriContext.Date = FrozenDate;
vm.createContext(niguriContext);
vm.runInContext(`${niguriCode}
JSON.stringify({ all: modelNiguriStructureRows('Todos os modelos').find(item=>item.code==='${materialCode}').quantity, timeline:modelNiguriTimeline('Todos os modelos').allSlots.filter(slot=>slot.quantity>0).map(slot=>({quantity:slot.quantity,entries:slot.plannedEntries.length})), total:modelNiguriRows('Todos os modelos').rows.find(item=>item.code==='${materialCode}').totalNeed, finalBalance:modelNiguriRows('Todos os modelos').rows.find(item=>item.code==='${materialCode}').balances.filter(slot=>slot.consumption>0).map(slot=>slot.balance), oneByOne:modelNiguriRows('Modelo A').rows.find(item=>item.code==='${materialCode}').totalNeed, unmatched:modelNiguriUnmatchedCraneProducts('Todos os modelos').map(entry=>entry.produto)});`, niguriContext);
const niguriResult = JSON.parse(vm.runInContext(`JSON.stringify({all:modelNiguriStructureRows('Todos os modelos').find(item=>item.code==='${materialCode}').quantity, timeline:modelNiguriTimeline('Todos os modelos').allSlots.filter(slot=>slot.quantity>0).map(slot=>({quantity:slot.quantity,entries:slot.plannedEntries.length})), total:modelNiguriRows('Todos os modelos').rows.find(item=>item.code==='${materialCode}').totalNeed, finalBalance:modelNiguriRows('Todos os modelos').rows.find(item=>item.code==='${materialCode}').balances.filter(slot=>slot.consumption>0).map(slot=>slot.balance), oneByOne:modelNiguriRows('Modelo A').rows.find(item=>item.code==='${materialCode}').totalNeed, unmatched:modelNiguriUnmatchedCraneProducts('Todos os modelos').map(entry=>entry.produto)})`, niguriContext));
assert.strictEqual(niguriResult.all, 3);
assert.deepStrictEqual(niguriResult.timeline, [{ quantity: 2, entries: 2 }]);
assert.strictEqual(niguriResult.total, 3);
assert.deepStrictEqual(niguriResult.finalBalance, [7]);
assert.strictEqual(niguriResult.oneByOne, 1);
assert.deepStrictEqual(niguriResult.unmatched, ['GUINDASTE NEXT NX 45.5T TRAVE 4H 3M']);
// O login não deve iniciar dois carregamentos nem impor dez segundos de splash.
const splashStart = app.indexOf('async function showSplashThenDashboard');
const splashEnd = app.indexOf('function showLogin', splashStart);
const splashCode = app.slice(splashStart, splashEnd);
assert(splashCode.includes('setTimeout(resolve, 450)') && splashCode.includes('await Promise.all([minimumSplashTime, load()])'), 'a animação curta deve acompanhar o carregamento real');
const loginSubmitStart = app.indexOf('loginForm.onsubmit = event =>');
const loginSubmitEnd = app.indexOf('\n}', loginSubmitStart);
const loginSubmitCode = app.slice(loginSubmitStart, loginSubmitEnd);
assert(loginSubmitCode.includes('showSplashThenDashboard(user)') && !loginSubmitCode.includes('load()'), 'o login deve delegar a um único carregamento');
// A coluna de demanda do Estoque soma todos os meses do PLANO MES, sem depender do mês de pedidos.
const stockRowsCode = section('function itemRows(', 'function updateStockMinimumRow');
const stockDemandContext = {
  n: value => Number(value) || 0,
  totalDemand: item => Object.values(item.demands || {}).reduce((sum, value) => sum + (Number(value) || 0), 0),
  risk: () => ['Regular', 'green'],
  procurementDecision: () => ({ label: 'Não comprar' }),
  orderQuantityForPeriod: () => 1,
  isBelowMinimum: () => false,
  configuredMinimum: () => 0,
  procurementAction: () => '—',
  esc: value => String(value ?? ''),
  fmt: value => String(value ?? 0)
};
vm.createContext(stockDemandContext);
vm.runInContext(stockRowsCode, stockDemandContext);
const stockDemandHtml = vm.runInContext(`itemRows([{code:'MAT-D',description:'Demanda total',stock:20,stockMax:30,safety:0,unit:'UN',analyst:'ANA',obtentionType:'Compra',orders:{},demands:{'DEM 11/2026':2,'DEM 12/2026':5,'DEM 01/2027':3}}],1,false,'',true,'11/2026')`, stockDemandContext);
assert(stockDemandHtml.includes('<td>10 UN</td>'), 'A coluna deve somar as demandas de todos os meses, apesar de estar seleccionado 11/2026');
assert(app.includes('<th>Demanda total PLANO MES</th>'), 'O cabeçalho deve indicar demanda total, não um único mês');
// O NIGURI dos modelos pagina em blocos, sem truncar o modo agregado ou as buscas.
const paginationStart = app.indexOf('const MODEL_NIGURI_PAGE_SIZE');
const paginationEnd = app.indexOf('function modelNiguriView()', paginationStart);
assert(paginationStart >= 0 && paginationEnd > paginationStart, 'Paginação do NIGURI não encontrada');
const paginationCode = app.slice(paginationStart, paginationEnd);
assert(app.includes('const visibleRows = modelNiguriPage(rows);'), 'A renderização do NIGURI deve usar a lista paginada');
assert(app.includes('modelNiguriLoadMoreMarkup(rows.length, visibleRows.length)'), 'A interface deve informar itens visíveis e oferecer carregamento progressivo');
assert(app.includes('advanceModelNiguriPage(rows.length);'), 'O botão deve avançar a página actual com base nos resultados filtrados');
assert(app.includes("tbody.insertAdjacentHTML('beforeend', rows.slice(start, end).map(modelNiguriRowMarkup).join(''))"), 'Carregar mais deve acrescentar apenas as novas linhas sem reconstruir as anteriores');
const paginationContext = { fmt: value => String(value), esc: value => String(value), document: { querySelector() { return null; }, createElement() { return { innerHTML: '', querySelector() { return null; } }; } }, bindMaterialButtons() {}, $() { return null; }, modelNiguriRows() { return { rows: [] }; } };
vm.createContext(paginationContext);
vm.runInContext(paginationCode, paginationContext);
const paginationResult = JSON.parse(vm.runInContext(`(()=>{const all=Array.from({length:1824},(_,i)=>'MAT-'+i);let found=[];let cursor=0;modelNiguriVisibleLimit=MODEL_NIGURI_PAGE_SIZE;while(cursor<all.length){const page=modelNiguriPage(all);found.push(...page.slice(cursor));cursor=page.length;advanceModelNiguriPage(all.length);}const filtered=all.filter(code=>code.endsWith('7'));return JSON.stringify({count:found.length,unique:new Set(found).size,first:found[0],last:found.at(-1),filtered:filtered.length,filteredPages:modelNiguriPage(filtered,500).length});})()`, paginationContext));
assert.deepStrictEqual(paginationResult, { count: 1824, unique: 1824, first: 'MAT-0', last: 'MAT-1823', filtered: 182, filteredPages: 182 });
console.log('UPDATE_REQUIREMENTS_OK: minimum-local, buy-decision, map cumulative stages/status/orders, NIGURI aggregated and individual');
