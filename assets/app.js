let DATA = null;
// Controla qual área do dashboard está aberta neste momento.
let view = 'overview';
let analyst = 'all';
let family = 'all';
let obtentionType = 'all';
let stockFilter = 'all';
let selectedEN = '';
let enPvQuery = '';
let enPvFocusENs = new Set();
let EN_PV_REVIEWS = {};
let EN_PV_PREVIEWS = {};
let EN_PV_IMPORT_RESULT = null;
const EN_PV_STORAGE_KEY = 'pcm-en-pv-reviews-v1';
const EN_PV_PREVIEWS_STORAGE_KEY = 'pcm-en-pv-previews-v1';
let pdfJsPromise = null;
const THEME_STORAGE_KEY = 'pcm-dashboard-theme';

// Aplica o tema escolhido e alterna automaticamente a imagem do cabeçalho via CSS.
function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.classList.toggle('dark-theme', dark);
  const button = document.querySelector('#theme-toggle');
  if (button) {
    const icon = button.querySelector('.theme-toggle-icon');
    const label = button.querySelector('.theme-toggle-label');
    if (icon) icon.textContent = dark ? '☀' : '☾';
    if (label) label.textContent = dark ? 'Claro' : 'Escuro';
    button.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    button.title = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
  }
}

function loadThemePreference() {
  let saved = 'light';
  try { saved = localStorage.getItem(THEME_STORAGE_KEY) || 'light'; } catch (error) { /* mantém tema claro */ }
  applyTheme(saved === 'dark' ? 'dark' : 'light');
}
// Guarda os filtros selecionados pelo usuário para manter a navegação consistente.
let demandMonth = 'all';
let excessMonth = 'all';
// Guarda o histórico mensal carregado do ficheiro separado.
let STOCK_HISTORY = { records: [] };
// Guarda os consumíveis carregados a partir da planilha específica.
let CONSUMABLES = { items: [], months: [] };
// Dados consolidados da aba Pinos, separados da explosão principal.
let PINS = { items: [], models: [] };
let selectedPinModel = '';
let pinCars = 1;
// Semana a partir da qual o NIGURI deve iniciar a projeção.
let pinsNiguriStartWeek = '';
let modelNiguriModel = '';
let modelNiguriStartWeek = '';
let modelNiguriAnalyst = 'all';
// Dados consolidados da aba Cilindros, tratados com a mesma lógica de Pinos.
let CYLINDERS = { items: [], models: [] };
let selectedCylinderModel = '';
let cylinderCars = 1;
// Dados consolidados da aba Cabines, tratados com a mesma lógica de Pinos e Cilindros.
let CABINS = { items: [], models: [] };
let selectedCabinModel = '';
// Dados consolidados da aba Chaparias, com o mesmo fluxo de seleção para compra.
let SHEET_METAL = { items: [], models: [] };
let selectedSheetMetalModel = '';
let sheetMetalCars = 1;
let cabinCars = 1;
// Controle de estoque operacional da Calfer; os saldos iniciais vêm do Excel e os movimentos desta sessão ficam registrados localmente.
let CALFER = { nextModels: [], calferModels: [], items: [], transactions: [] };
let selectedCalferModel = '';
let calferMachineCount = 1;
const CALFER_STORAGE_KEY = 'pcm-calfer-transactions';
// Lista local dos itens selecionados para o Processo de compra.
let PURCHASE_PROCESS = [];
// Mantém os conjuntos de dados fora do HTML e carrega as linhas em pequenos blocos.
const TABLE_DATASETS = new Map();
let TABLE_SEQUENCE = 0;
const TABLE_CHUNK_SIZE = 250;
const SPECIALIZED_PAGE_SIZE = 100;
const specializedLimits = { pins: SPECIALIZED_PAGE_SIZE, cylinders: SPECIALIZED_PAGE_SIZE, cabins: SPECIALIZED_PAGE_SIZE, sheetMetal: SPECIALIZED_PAGE_SIZE };
const specializedCounts = { pins: 0, cylinders: 0, cabins: 0 };
const PURCHASE_STORAGE_KEY = 'pcm-processo-compra';
// Lista local dos avisos enviados pela produção. Cada navegador mantém o seu histórico offline.
let PRODUCTION_ALERTS = [];
let ALERTS_ENDPOINT = '';
let alertsSyncTimer = null;
const PRODUCTION_ALERTS_STORAGE_KEY = 'pcm-alertas-producao';

// Carrega os avisos do navegador enquanto a central não estiver configurada.
function loadLocalProductionAlerts() {
  try {
    const saved = localStorage.getItem(PRODUCTION_ALERTS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

// Guarda uma cópia local para o uso offline e para recuperação em caso de falha.
function saveLocalProductionAlerts() {
  try { localStorage.setItem(PRODUCTION_ALERTS_STORAGE_KEY, JSON.stringify(PRODUCTION_ALERTS)); } catch (error) { /* armazenamento local indisponível */ }
}

// Lê a configuração opcional da central publicada (Google Apps Script ou API compatível).
async function loadProductionAlerts() {
  PRODUCTION_ALERTS = loadLocalProductionAlerts();
  try {
    const response = await fetch('data/alertas-config.json', { cache: 'no-store' });
    if (response.ok) {
      const config = await response.json();
      ALERTS_ENDPOINT = String(config.endpoint || '').trim().replace(/\/$/, '');
    }
  } catch (error) {
    ALERTS_ENDPOINT = '';
  }
  if (ALERTS_ENDPOINT) await syncProductionAlerts();
}

// Sincroniza os avisos entre todos os navegadores quando existe um endpoint central.
async function syncProductionAlerts() {
  if (!ALERTS_ENDPOINT) return;
  try {
    const response = await fetch(`${ALERTS_ENDPOINT}/alerts`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (Array.isArray(payload.alerts)) {
      PRODUCTION_ALERTS = payload.alerts;
      saveLocalProductionAlerts();
      if (view === 'productionAlerts') render();
    }
  } catch (error) {
    console.warn('Central de alertas indisponível; mantendo cópia local.', error);
  }
}

// Envia o estado completo ao endpoint central e conserva o modo offline como fallback.
async function saveProductionAlerts() {
  saveLocalProductionAlerts();
  if (!ALERTS_ENDPOINT) return;
  try {
    await fetch(`${ALERTS_ENDPOINT}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerts: PRODUCTION_ALERTS })
    });
  } catch (error) {
    console.warn('Não foi possível enviar o alerta para a central.', error);
  }
}

// Soma a necessidade/demanda disponível para o item no JSON atual.
function alertDemand(item) {
  return Object.values(item?.demands || {}).reduce((sum, value) => sum + n(value), 0);
}

// Soma apenas pedidos quantitativos ainda registados no item.
function alertOrders(item) {
  return Object.values(item?.orders || {}).reduce((sum, value) => sum + n(value), 0);
}

// Usa a mesma lógica de cobertura para explicar a compra sugerida no alerta.
function alertSnapshot(item) {
  const stock = n(item?.stock);
  const safety = n(item?.safety);
  const demand = alertDemand(item);
  const orders = alertOrders(item);
  return {
    stock,
    safety,
    demand,
    orders,
    suggestedPurchase: Math.max(0, demand + safety - stock - orders),
    analyst: item?.analyst || '—',
    family: item?.family || '—',
    obtentionType: item?.obtentionType || '—',
    unit: item?.unit || 'UN',
    lastMovement: item?.lastMovement || 'não tem'
  };
}

// Localiza um item pelo código ou por parte da descrição.
function findAlertItem(query) {
  const value = String(query || '').trim().toLowerCase();
  if (!value) return null;
  return (DATA?.items || []).find(item => String(item.code).toLowerCase() === value)
    || (DATA?.items || []).find(item => `${item.code} ${item.description}`.toLowerCase().includes(value))
    || null;
}

// Cria o retrato do material no momento em que o líder envia o aviso.
function createProductionAlert(form) {
  const item = findAlertItem(form.code);
  const snapshot = alertSnapshot(item);
  const alert = {
    id: `AL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    leader: String(form.leader || '').trim(),
    line: String(form.line || '').trim(),
    code: item?.code || String(form.code || '').trim(),
    description: item?.description || String(form.description || '').trim(),
    message: String(form.message || '').trim(),
    status: 'Novo',
    history: [{ status: 'Novo', at: new Date().toISOString(), by: String(form.leader || '').trim() || 'Produção' }],
    ...snapshot
  };
  PRODUCTION_ALERTS.unshift(alert);
  void saveProductionAlerts();
  return alert;
}

// Atualiza o estado de um aviso e preserva o histórico da operação.
function updateProductionAlertStatus(id, status) {
  const alert = PRODUCTION_ALERTS.find(item => item.id === id);
  if (!alert) return;
  const actor = currentUser?.name || 'Responsável';
  alert.status = status;
  alert.history = Array.isArray(alert.history) ? alert.history : [];
  alert.history.push({ status, at: new Date().toISOString(), by: actor });
  void saveProductionAlerts();
}



const LOGIN_USERS = [
{
    username: 'admin',
    password: 'Next2026',
    name: 'Administrador',
    analyst: ''
  },
   {
    username: 'gabriel',
    password: 'Next2026',
    name: 'Administrador',
    analyst: ''
  },
    {
    username: 'edicleia@next',
    password: 'edi2026',
    name: 'Edicleia',
    analyst: ''
  },
    {
    username: 'compras@next',
    password: 'Next2026',
    name: 'Time Compras',
    analyst: ''
  },
   {
    username: 'rodrigo',
    password: 'Next2026',
    name: 'Administrador',
    analyst: ''
  },
   {
    username: 'bruno',
    password: 'Bruno2026',
    name: 'Bruno',
    analyst: 'BRUNO'
  },
  {
    username: 'kelen',
    password: 'Kelen2026',
    name: 'Kellen',
    analyst: 'KELEN'
  },
  {
    username: 'pedro',
    password: 'Pedro2026',
    name: 'Pedro',
    analyst: 'PEDRO'
  }

];

const AUTH_STORAGE_KEY = 'pcm-dashboard-session';
let currentUser = null;

const $ = selector => document.querySelector(selector);
const n = value => Number(value) || 0;
const fmt = value => n(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const money = value => n(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
function movementDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.toLowerCase() === 'nao tem' || raw.toLowerCase() === 'não tem') return 'não tem';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));

// Remove valores repetidos e organiza opções de filtro em ordem alfabética.
function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
}

// Verifica se um material corresponde aos filtros globais atuais.
function matchesStockFilter(item) {
  if (stockFilter === 'zero') return n(item.stock) === 0;
  if (stockFilter === 'positive') return n(item.stock) > 0;
  return true;
}

function matchesGlobalFilters(item) {
  const analystOk = analyst === 'all' || (item.analyst || '').toLowerCase() === analyst.toLowerCase();
  const familyOk = family === 'all' || (item.family || '') === family;
  const obtentionOk = obtentionType === 'all' || (item.obtentionType || '') === obtentionType;
  return analystOk && familyOk && obtentionOk && matchesStockFilter(item);
}

// Retorna apenas os materiais que correspondem aos filtros globais atuais.
function scopedItems() {
  return DATA.items.filter(matchesGlobalFilters);
}

function itemByCode(code) {
  const wanted = String(code ?? '').trim();
  return DATA.items.find(item => String(item.code ?? '').trim() === wanted);
}

// Converte a quantidade de compra para um valor positivo e exportável.
function purchaseQuantity(item, kind = 'explosion', demand, demandLabel = '') {
  if (kind === 'consumable') {
    const state = consumableDecision(item);
    if (state.label !== 'Comprar') return 0;
    return Math.max(0, Math.abs(n(item.purchaseQty)));
  }
  if (!procurementDecision(item, demand, demandLabel).canBuy) return 0;
  return Math.max(0, suggestedPurchase(item, demand, demandLabel));
}

// Cria uma chave estável para não duplicar materiais na lista de compras.
function purchaseKey(item, kind = 'explosion') {
  return `${kind}:${String(item.code ?? '').trim()}`;
}

function isInPurchaseProcess(item, kind = 'explosion') {
  return PURCHASE_PROCESS.some(entry => entry.key === purchaseKey(item, kind));
}

function addToPurchaseProcess(item, kind = 'explosion', options = {}) {
  const requestedQuantity = Number(options.quantity);
  const quantity = Number.isFinite(requestedQuantity) ? Math.max(0, requestedQuantity) : purchaseQuantity(item, kind);
  if (!quantity || isInPurchaseProcess(item, kind)) return false;
  PURCHASE_PROCESS.push({ key: purchaseKey(item, kind), code: String(item.code ?? ''), description: String(item.description ?? ''), quantity, source: kind === 'consumable' ? 'Consumível' : 'Explosão' });
  savePurchaseProcess();
  if (options.refresh !== false) render();
  return true;
}

function removeFromPurchaseProcess(key) {
  PURCHASE_PROCESS = PURCHASE_PROCESS.filter(entry => entry.key !== key);
  savePurchaseProcess();
  render();
}

function savePurchaseProcess() {
  try { localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(PURCHASE_PROCESS)); } catch (error) { console.warn('Não foi possível guardar o Processo de compra.', error); }
}

function loadPurchaseProcess() {
  try {
    const saved = JSON.parse(localStorage.getItem(PURCHASE_STORAGE_KEY) || '[]');
    PURCHASE_PROCESS = Array.isArray(saved) ? saved.filter(entry => entry && entry.key && entry.code) : [];
  } catch (error) {
    PURCHASE_PROCESS = [];
  }
}

function loadENPVReviews() {
  try {
    const saved = JSON.parse(localStorage.getItem(EN_PV_STORAGE_KEY) || '{}');
    EN_PV_REVIEWS = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    Object.keys(EN_PV_REVIEWS).forEach(en => {
      if (EN_PV_REVIEWS[en]?.analysis) EN_PV_REVIEWS[en].analysis = compactPVAnalysis(EN_PV_REVIEWS[en].analysis);
    });
    try { localStorage.setItem(EN_PV_STORAGE_KEY, JSON.stringify(EN_PV_REVIEWS)); } catch (error) { /* dados ainda podem ser usados nesta sessão */ }
  } catch (error) {
    EN_PV_REVIEWS = {};
  }
}

function saveENPVReviews() {
  try { localStorage.setItem(EN_PV_STORAGE_KEY, JSON.stringify(EN_PV_REVIEWS)); } catch (error) { console.warn('Não foi possível guardar as análises EN/PV.', error); }
}

function loadENPVPreviews() {
  try {
    const saved = JSON.parse(localStorage.getItem(EN_PV_PREVIEWS_STORAGE_KEY) || '{}');
    EN_PV_PREVIEWS = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch (error) { EN_PV_PREVIEWS = {}; }
}

function saveENPVPreviews() {
  try { localStorage.setItem(EN_PV_PREVIEWS_STORAGE_KEY, JSON.stringify(EN_PV_PREVIEWS)); } catch (error) { console.warn('Não foi possível guardar as miniaturas dos PVs.', error); }
}
function compactPVAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') return analysis;
  return { fileName: analysis.fileName || '', pageCount: analysis.pageCount || 0, productLine: analysis.productLine || '', chassisLine: analysis.chassisLine || '', ens: Array.isArray(analysis.ens) ? analysis.ens : [], pv: analysis.pv || '', model: analysis.model || '', criticalItems: Array.isArray(analysis.criticalItems) ? analysis.criticalItems : [], previewKey: analysis.previewKey || '', analysisMode: analysis.analysisMode || '', status: analysis.status || 'manual', redLineCount: analysis.redLineCount || 0, analyzedAt: analysis.analyzedAt || '' };
}

// Gera um ficheiro .xls simples que abre diretamente no Microsoft Excel.
function exportPurchaseProcess() {
  if (!PURCHASE_PROCESS.length) return;
  const rows = PURCHASE_PROCESS.map(entry => `<tr><td>${esc(entry.code)}</td><td>${esc(entry.description)}</td><td>${fmt(entry.quantity)}</td></tr>`).join('');
  const documentContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table><thead><tr><th>Código</th><th>Descrição</th><th>Quantidade de compra</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const blob = new Blob([`\\ufeff${documentContent}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `processo-de-compra-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function purchaseAction(item, kind = 'explosion', demand, demandLabel = '') {
  const quantity = purchaseQuantity(item, kind, demand, demandLabel);
  const added = isInPurchaseProcess(item, kind);
  const disabled = !quantity || added;
  const label = added ? '✓' : '+';
  const title = added ? 'Item já está no Processo de compra' : (!quantity ? 'Não existe quantidade de compra positiva' : 'Adicionar ao Processo de compra');
  return `<button class="purchase-add-btn${added ? ' added' : ''}" data-purchase-key="${esc(purchaseKey(item, kind))}" data-purchase-kind="${kind}" data-purchase-code="${esc(item.code)}" title="${title}" aria-label="${title}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

// Soma toda a demanda disponível quando a tela não está filtrada por um mês.
// Se não houver demanda cadastrada, a Segurança continua sendo o mínimo operacional.
function totalDemand(item) {
  return Object.values(item?.demands || {}).reduce((sum, value) => sum + n(value), 0);
}

function requiredQuantity(item, demand) {
  const selectedDemand = demand !== undefined && demand !== null && demand !== '' ? n(demand) : totalDemand(item);
  return selectedDemand > 0 ? selectedDemand : n(item?.safety);
}

// Classifica o material pela cobertura da demanda, e não apenas pelo estoque de segurança.
// Pedido aberto não elimina a falta: transforma o risco em Follow-up/Em atenção.
function availabilityStatus(stock, needed, hasOrder = false) {
  const available = n(stock);
  const demand = n(needed);
  if (demand <= 0) return ['Regular', 'green'];
  if (available <= 0) return ['Crítico', 'red'];
  if (hasOrder) return ['Em atenção', 'amber'];
  if (available < demand) return ['Crítico', 'red'];
  return ['Regular', 'green'];
}
function risk(item, demand) {
  const needed = demand !== undefined && demand !== null && demand !== '' ? n(demand) : totalDemand(item);
  const orders = Object.values(item?.orders || {}).reduce((sum, value) => sum + n(value), 0);
  return availabilityStatus(item?.stock, needed, orders > 0);
}

function hasOpenOrder(item) {
  return Object.values(item.orders || {}).some(value => n(value) > 0);
}

function currentOrderMonth() {
  const now = currentMonthDate();
  return `PED ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function orderMonthForDemand(demand) {
  const match = String(demand || '').match(/(\d{2}\/\d{4})/);
  return match ? `PED ${match[1]}` : currentOrderMonth();
}

function hasOrderInMonth(item, demand) {
  const month = orderMonthForDemand(demand);
  return n(item.orders?.[month]) > 0;
}

function hasFollowUpOrder(item, demand) {
  // Qualquer pedido quantitativo aberto exige acompanhamento. Isso evita que
  // uma demanda em falta seja classificada como "Comprar" só porque o pedido
  // está registrado em outro mês ou porque o estoque está zerado.
  if (overdueOrders(item).length > 0) return true;
  return hasOpenOrder(item);
}

// Define a decisão operacional no mês de referência sem ocultar o risco físico.
function procurementDecision(item, demand, demandLabel = '') {
  const [riskLabel] = risk(item, demand);
  const followUp = hasFollowUpOrder(item, demandLabel || demand);
  if (followUp) return { label: 'Follow-up', color: 'amber', canBuy: false, hasOrder: true };
  if (riskLabel === 'Regular') return { label: 'Não comprar', color: 'green', canBuy: false, hasOrder: false };
  return { label: 'Comprar', color: 'red', canBuy: true, hasOrder: false };
}

function procurementAction(item, demand, demandLabel = '') {
  const decision = procurementDecision(item, demand, demandLabel);
  return `<div class="decision-cell"><span class="status ${decision.color}">${decision.label}</span>${decision.canBuy ? purchaseAction(item, 'explosion', demand, demandLabel) : ''}</div>`;
}

function monthDate(label) {
  const match = String(label || '').match(/(\d{2})\/(\d{4})/);
  return match ? new Date(Number(match[2]), Number(match[1]) - 1, 1) : null;
}

function currentMonthDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function isPastOrderMonth(label) {
  const date = monthDate(label);
  return date ? date < currentMonthDate() : false;
}

// Converte os pedidos do objeto de dados em uma lista pronta para a interface.
function orderEntries(item) {
  return Object.entries(item.orders || {})
    .map(([month, quantity]) => ({ month, quantity: n(quantity), overdue: isPastOrderMonth(month) }))
    .filter(entry => entry.quantity > 0);
}

function overdueOrders(item) {
  return orderEntries(item).filter(entry => entry.overdue);
}

// Todo item com pedido aberto entra no acompanhamento, inclusive quando o estoque é zero.
function followUpItems(items = scopedItems()) {
  return items
    .map(item => ({ ...item, overdueOrders: overdueOrders(item) }))
    .filter(item => hasOpenOrder(item));
}

// Calcula a compra sugerida; pedido no mês ou atraso gera Follow-up e não compra.
function suggestedPurchase(item, demand, demandLabel = '') {
  if (hasFollowUpOrder(item, demandLabel || demand)) return 0;
  const totalDemand = demand !== undefined && demand !== null && demand !== ''
    ? n(demand)
    : demandLabel
      ? n(item.demands?.[demandLabel])
      : Object.values(item.demands || {}).reduce((sum, value) => sum + n(value), 0);
  return Math.max(0, totalDemand + n(item.safety) - n(item.stock));
}


function loadCalferTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(CALFER_STORAGE_KEY) || '[]');
    CALFER.transactions = Array.isArray(saved) ? saved.filter(item => item && item.direction && item.code) : [];
  } catch (error) { CALFER.transactions = []; }
}

function saveCalferTransactions() {
  try { localStorage.setItem(CALFER_STORAGE_KEY, JSON.stringify(CALFER.transactions)); } catch (error) { console.warn('Não foi possível guardar os movimentos Calfer.', error); }
}

function calferBalances(code) {
  const base = (CALFER.items || []).find(item => String(item.code) === String(code)) || {};
  let next = n(base.nextStock);
  let calfer = n(base.calferStock);
  CALFER.transactions.filter(item => String(item.code) === String(code)).forEach(move => {
    const quantity = n(move.quantity);
    if (move.direction === 'nextToCalfer') { next -= quantity; calfer += quantity; }
    // O retorno de máquina não repõe o estoque da Next: apenas baixa o saldo
    // de componentes que ainda constavam como disponíveis na Calfer.
    if (move.direction === 'calferToNext') { calfer -= quantity; }
  });
  return { next: Math.max(0, next), calfer: Math.max(0, calfer) };
}

function calferModel(modelName, direction) {
  const list = direction === 'nextToCalfer' ? CALFER.nextModels : CALFER.calferModels;
  return (list || []).find(model => model.name === modelName) || list?.[0] || { name: modelName || '—', items: [] };
}

function calferPlan(modelName, machines, direction) {
  const model = calferModel(modelName, direction);
  return model.items.map(item => {
    const required = n(item.quantityPerMachine) * Math.max(1, n(machines));
    const balance = calferBalances(item.code);
    const available = direction === 'nextToCalfer' ? balance.next : balance.calfer;
    const send = Math.min(required, available);
    return { ...item, required, available, send, shortage: Math.max(0, required - send), after: Math.max(0, available - send), balance };
  });
}

function calferCapacity(modelName, direction) {
  const model = calferModel(modelName, direction);
  const values = model.items.filter(item => n(item.quantityPerMachine) > 0).map(item => {
    const balance = calferBalances(item.code);
    const available = direction === 'nextToCalfer' ? balance.next : balance.calfer;
    return Math.floor(available / n(item.quantityPerMachine));
  });
  return values.length ? Math.max(0, Math.min(...values)) : 0;
}

function sendCalferMachines(direction, modelName, machines) {
  const plan = calferPlan(modelName, machines, direction);
  if (!plan.length) return;
  const timestamp = new Date().toISOString();
  plan.filter(row => row.send > 0).forEach(row => CALFER.transactions.push({
    id: `CF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: timestamp,
    direction,
    model: modelName,
    code: row.code,
    description: row.description,
    quantity: row.send,
    requested: row.required,
    shortage: row.shortage,
  }));
  saveCalferTransactions();
  render();
}

function calferRows(plan) {
  return plan.map(row => `<tr><td><b>${esc(row.code)}</b><div class="desc">${esc(row.description)}</div></td><td>${fmt(row.quantityPerMachine)}</td><td>${fmt(row.required)}</td><td>${fmt(row.available)}</td><td>${fmt(row.send)}</td><td class="${row.shortage > 0 ? 'danger' : 'success'}">${row.shortage > 0 ? `Faltam ${fmt(row.shortage)}` : 'Completo'}</td><td>${fmt(row.after)}</td></tr>`).join('');
}

function calferView() {
  const modelNames = [...new Set([...(CALFER.nextModels || []), ...(CALFER.calferModels || [])].map(item => item.name))];
  const active = selectedCalferModel || modelNames[0] || '';
  const machines = Math.max(1, Math.floor(n(calferMachineCount) || 1));
  const outbound = calferPlan(active, machines, 'nextToCalfer');
  const inbound = calferPlan(active, machines, 'calferToNext');
  const outboundShortage = outbound.filter(row => row.shortage > 0).length;
  const inboundShortage = inbound.filter(row => row.shortage > 0).length;
  const history = [...(CALFER.transactions || [])].reverse().slice(0, 20);
  return `<div class="view-title"><div><span class="eyebrow">Controle de fornecedor</span><h2>Estoque Calfer</h2><p>Controle dos componentes enviados para a Calfer e das máquinas devolvidas para a Next.</p></div><div class="date-pill">${esc(CALFER.sourceFile || 'abas calfer.next / calfer')}</div></div><div class="pins-model-strip">${modelNames.map(name => `<button class="pins-model-card${name === active ? ' selected' : ''}" data-calfer-model="${esc(name)}"><span>Modelo</span><strong>${esc(name)}</strong><small>${name === active ? 'selecionado' : 'selecionar'}</small></button>`).join('')}</div><div class="panel"><div class="panel-header"><div><h3>Planejar movimentação</h3><span>Modelo ${esc(active || '—')} · quantidade de máquinas</span></div><div class="toolbar"><label class="filter-label">Máquinas</label><input class="input" id="calfer-machines" type="number" min="1" value="${machines}" style="max-width:100px" /></div></div><div class="summary-strip"><div class="summary-box"><b>${fmt(calferCapacity(active, 'nextToCalfer'))}</b><span>máquinas possíveis Next → Calfer</span></div><div class="summary-box"><b>${fmt(calferCapacity(active, 'calferToNext'))}</b><span>máquinas possíveis Calfer → Next</span></div><div class="summary-box"><b class="${outboundShortage ? 'danger' : 'success'}">${fmt(outbound.filter(row => row.shortage > 0).reduce((sum,row) => sum + row.shortage, 0))}</b><span>peças faltantes no envio</span></div><div class="summary-box"><b class="${inboundShortage ? 'danger' : 'success'}">${fmt(inbound.filter(row => row.shortage > 0).reduce((sum,row) => sum + row.shortage, 0))}</b><span>peças faltantes no retorno</span></div></div></div><div class="panel"><div class="panel-header"><div><h3>Next → Calfer</h3><span>O sistema envia o disponível e mostra automaticamente o que ficou faltando.</span></div><button class="primary-btn" id="send-to-calfer" ${outbound.every(row => row.send <= 0) ? 'disabled' : ''}>Enviar ${fmt(machines)} máquina(s) para Calfer</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Código / descrição</th><th>Por máquina</th><th>Necessidade</th><th>Estoque Next</th><th>Enviado</th><th>Resultado</th><th>Saldo Next</th></tr></thead><tbody>${calferRows(outbound) || '<tr><td colspan="7" class="empty">Modelo sem componentes.</td></tr>'}</tbody></table></div></div><div class="panel"><div class="panel-header"><div><h3>Calfer → Next</h3><span>Ao enviar máquinas, o saldo de peças da Calfer é reduzido.</span></div><button class="primary-btn" id="send-to-next" ${inbound.every(row => row.send <= 0) ? 'disabled' : ''}>Receber ${fmt(machines)} máquina(s) da Calfer</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Código / descrição</th><th>Por máquina</th><th>Necessidade</th><th>Estoque Calfer</th><th>Enviado</th><th>Resultado</th><th>Saldo Calfer</th></tr></thead><tbody>${calferRows(inbound) || '<tr><td colspan="7" class="empty">Modelo sem componentes.</td></tr>'}</tbody></table></div></div><div class="panel"><div class="panel-header"><div><h3>Últimos movimentos</h3><span>Os movimentos desta sessão ficam registrados neste navegador.</span></div><button class="secondary-btn" id="clear-calfer-movements" ${history.length ? '' : 'disabled'}>Zerar movimentos locais</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Direção</th><th>Modelo</th><th>Código</th><th>Quantidade</th><th>Faltante</th></tr></thead><tbody>${history.map(move => `<tr><td>${esc(new Date(move.at).toLocaleString('pt-BR'))}</td><td>${move.direction === 'nextToCalfer' ? 'Next → Calfer' : 'Calfer → Next'}</td><td>${esc(move.model)}</td><td>${esc(move.code)}</td><td>${fmt(move.quantity)}</td><td>${fmt(move.shortage || 0)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum movimento realizado.</td></tr>'}</tbody></table></div></div>`;
}

function optionList(values, selected, label) {
  return `<select class="select" id="${label.id}"><option value="all">${label.all}</option>${values.map(value => `<option value="${esc(value)}" ${selected === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select>`;
}

// Monta a barra de filtros compartilhada pelas áreas do dashboard.
function filterBar() {
  const families = DATA.families || uniqueSorted(DATA.items.map(item => item.family));
  const types = DATA.obtentionTypes || uniqueSorted(DATA.items.map(item => item.obtentionType));
  return `<div class="toolbar global-filters">
    <label class="filter-label">Carteira:</label>
    ${optionList(DATA.analysts || [], analyst, { id: 'analyst-filter', all: 'Todos os analistas' })}
    <label class="filter-label">Família:</label>
    ${optionList(families, family, { id: 'family-filter', all: 'Todas as famílias' })}
    <label class="filter-label">Obtenção:</label>
    ${optionList(types, obtentionType, { id: 'obtention-filter', all: 'Todos os tipos' })}
    <label class="filter-label">Estoque:</label>
    <select class="select" id="stock-filter"><option value="all" ${stockFilter === 'all' ? 'selected' : ''}>Todos</option><option value="zero" ${stockFilter === 'zero' ? 'selected' : ''}>Igual a zero</option><option value="positive" ${stockFilter === 'positive' ? 'selected' : ''}>Maior que zero</option></select>
  </div>`;
}

function itemRows(items, limit = 200, showDemand = false, offset = 0, demandLabel = '', includeDemand = false) {
  return items.slice(offset, offset + limit).map(item => {
    const [label, color] = risk(item, showDemand ? item.need : undefined);
    const orders = Object.values(item.orders || {}).reduce((sum, value) => sum + n(value), 0);
    const totalDemand = Object.values(item.demands || {}).reduce((sum, value) => sum + n(value), 0);
    const demand = showDemand
      ? `<td>${fmt(item.need || 0)} ${esc(item.unit)}</td><td class="${n(item.balance) < 0 ? 'danger' : ''}">${fmt(item.balance || 0)}</td>`
      : '';
    const stockDemand = includeDemand ? `<td>${fmt(totalDemand)} ${esc(item.unit)}</td>` : '';
    const obtainingType = includeDemand ? `<td>${esc(item.obtentionType || '—')}</td>` : '';
    return `<tr>
      <td><button class="material-code" data-code="${esc(item.code)}" title="Abrir detalhe do material">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td>
      <td>${esc(item.analyst || '—')}</td>
      <td>${fmt(item.stock)} ${esc(item.unit)}</td>
      <td>${fmt(item.stockMax || 0)} ${esc(item.unit)}</td>
      <td>${fmt(item.safety)}</td>
      ${obtainingType}
      <td class="movement-date">${esc(movementDate(item.lastMovement))}</td>
      ${stockDemand}${demand}<td>${fmt(orders)}</td><td><span class="status ${color}">${label}</span></td><td>${procurementAction(item, showDemand ? item.need : undefined, showDemand ? demandLabel : '')}</td>
    </tr>`;
  }).join('');
}

function table(items, limit = TABLE_CHUNK_SIZE, showDemand = false, demandLabel = '', includeDemand = false) {
  const columns = 9 + (showDemand ? 2 : 0) + (includeDemand ? 2 : 0);
  const id = `progressive-table-${++TABLE_SEQUENCE}`;
  const initialLimit = Math.min(Math.max(Number(limit) || TABLE_CHUNK_SIZE, 50), TABLE_CHUNK_SIZE);
  TABLE_DATASETS.set(id, { items, showDemand, demandLabel, includeDemand, cursor: initialLimit });
  const rows = itemRows(items, initialLimit, showDemand, 0, demandLabel, includeDemand);
  const more = items.length > initialLimit ? `<div class="table-load-more"><span>Mostrando ${fmt(initialLimit)} de ${fmt(items.length)} itens</span><button class="secondary-btn table-more-btn" data-table-id="${id}">Carregar mais</button></div>` : `<div class="table-load-more"><span>${fmt(items.length)} itens carregados</span></div>`;
  return `<div class="progressive-table" data-progressive-table="${id}"><div class="table-wrap"><table class="data-table"><thead><tr>
    <th>Material</th><th>Analista</th><th>Estoque</th><th>Estoque máximo</th><th>Segurança</th>${includeDemand ? '<th>tipo de obtenção</th>' : ''}<th>ultima movimentação</th>${includeDemand ? '<th>demanda</th>' : ''}
    ${showDemand ? '<th>Demanda</th><th>Saldo</th>' : ''}<th>Pedidos</th><th>Situação</th><th>Processo de compra</th>
  </tr></thead><tbody>${rows || `<tr><td colspan="${columns}" class="empty">Nenhum item encontrado.</td></tr>`}</tbody></table></div>${more}</div>`;
}

// Carrega linhas adicionais com pausas curtas para manter a interface responsiva.
function bindProgressiveTables() {
  document.querySelectorAll('.table-more-btn').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.tableId;
      const dataset = TABLE_DATASETS.get(id);
      const container = document.querySelector(`[data-progressive-table="${id}"]`);
      const tbody = container?.querySelector('tbody');
      if (!dataset || !container || !tbody) return;
      button.disabled = true;
      const start = dataset.cursor;
      const end = Math.min(start + TABLE_CHUNK_SIZE, dataset.items.length);
      window.setTimeout(() => {
        tbody.insertAdjacentHTML('beforeend', itemRows(dataset.items, end - start, dataset.showDemand, start, dataset.demandLabel, dataset.includeDemand));
        dataset.cursor = end;
        const label = container.querySelector('.table-load-more span');
        if (label) label.textContent = end < dataset.items.length ? `Mostrando ${fmt(end)} de ${fmt(dataset.items.length)} itens` : `${fmt(end)} itens carregados`;
        if (end < dataset.items.length) button.disabled = false;
        else button.remove();
        bindMaterialButtons();
        bindPurchaseButtons();
      }, 0);
    };
  });
}

// Cria os cartões com os principais indicadores da visão geral.
function metrics() {
  const base = scopedItems();
  const critical = base.filter(item => risk(item)[0] === 'Crítico').length;
  const attention = base.filter(item => risk(item)[0] === 'Em atenção').length;
  const followUpCount = followUpItems(base).length;
  return `<div class="metrics">
    <div class="metric" style="--metric-bg:#eaf2ff"><div class="metric-label">Materiais cadastrados</div><div class="metric-value">${fmt(base.length)}</div><div class="metric-note">Itens da explosão</div></div>
    <div class="metric" style="--metric-bg:#e8f8f0"><div class="metric-label">Valor do estoque</div><div class="metric-value">${money(base.reduce((sum, item) => sum + n(item.stockValue), 0))}</div><div class="metric-note">Valor em reais da Programacao</div></div>
    <div class="metric" style="--metric-bg:#fff4db"><div class="metric-label">Pedidos em aberto</div><div class="metric-value">${fmt(DATA.openRequests)}</div><div class="metric-note">Solicitações na obtenção</div></div>
    <div class="metric" style="--metric-bg:#ffebed"><div class="metric-label">Itens críticos</div><div class="metric-value">${fmt(critical)}</div><div class="metric-note">${fmt(attention)} em atenção</div></div>
    <button class="metric metric-clickable follow-up-metric" id="follow-up-metric" style="--metric-bg:#fff0f0"><div class="metric-label">Acompanhamento de pedidos</div><div class="metric-value">${fmt(followUpCount)}</div><div class="metric-note">Itens com pedido em atraso</div></button>
  </div>`;
}

function riskChart() {
  const base = scopedItems();
  const counts = { Crítico: 0, 'Em atenção': 0, Regular: 0 };
  base.forEach(item => counts[risk(item)[0]]++);
  const max = Math.max(...Object.values(counts), 1);
  return `<div class="panel"><div class="panel-header"><h3>Situação dos materiais</h3><span>${fmt(base.length)} itens avaliados</span></div><div class="panel-body">${[['Crítico', 'red'], ['Em atenção', 'amber'], ['Regular', 'green']].map(([label, color]) => `<div class="chart-row"><span>${label}</span><div class="bar-track"><div class="bar-fill bar-${color}" style="width:${counts[label] / max * 100}%"></div></div><b>${counts[label]}</b></div>`).join('')}<div class="legend"><span><i style="background:#e05252"></i>Abaixo da necessidade e sem pedido</span><span><i style="background:#e6aa42"></i>Abaixo da necessidade com pedido</span><span><i style="background:#31ae7a"></i>Estoque suficiente</span></div></div></div>`;
}

function orderGraphValue(total) {
  // Alguns totais do snapshot perderam a casa decimal na conversão do Excel.
  // Valores acima de 100 mil são apresentados na escala de unidades solicitada pela operação.
  return total >= 100000 ? total / 10 : total;
}

function orderPanel(panelBase = scopedItems()) {
  const months = DATA.months || [];
  const base = panelBase;
  const totals = months.map(month => base.reduce((sum, item) => sum + n(item.orders?.[month]), 0));
  const displayed = totals.map(orderGraphValue);
  const max = Math.max(...displayed, 1);
  return `<div class="panel"><div class="panel-header"><h3>Itens em pedidos por mês</h3><span>Quantidade de itens/unidades nas colunas PED</span></div><div class="panel-body">${months.map((month, index) => `<div class="chart-row"><span>${esc(month.replace('PED ', ''))}</span><div class="bar-track"><div class="bar-fill" style="background:#3278df;width:${displayed[index] / max * 100}%"></div></div><b>${fmt(displayed[index])} itens</b></div>`).join('') || '<div class="empty">Sem colunas de pedidos.</div>'}</div></div>`;
}

function planMonthPanel() {
  const plan = DATA.planMonth || { models: [], months: [] };
  const models = plan.models || [];
  const months = plan.months || [];
  if (!models.length) return '<div class="panel"><div class="empty">Plano Mês não disponível neste snapshot.</div></div>';
  const totals = months.map(month => models.reduce((sum, model) => sum + n(model.quantidades?.[month]), 0));
  const max = Math.max(...totals, 1);
  return `<div class="panel plan-month-panel"><div class="panel-header"><div><h3>Plano Mês · produção prevista</h3><span>Quantidade de veículos planeados por mês</span></div><span>Fonte: aba PLANO MES</span></div><div class="panel-body"><div class="plan-month-grid">${months.map((month, index) => `<div class="plan-month-card"><span>Mês ${esc(month)}</span><strong>${fmt(totals[index])}</strong><small>veículos</small><div class="bar-track"><div class="bar-fill" style="background:#1b9a82;width:${totals[index] / max * 100}%"></div></div></div>`).join('')}</div><div class="plan-month-table-wrap"><table class="data-table plan-month-table"><thead><tr><th>Modelo</th>${months.map(month => `<th>${esc(month)}</th>`).join('')}</tr></thead><tbody>${models.map(model => `<tr><td><strong>${esc(model.modelo)}</strong></td>${months.map(month => `<td>${fmt(model.quantidades?.[month])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
}

function bindMaterialButtons() {
  document.querySelectorAll('.material-code').forEach(button => {
    button.onclick = () => openMaterialDetail(button.dataset.code);
  });
}
function bindNiguriPinButtons() {
  document.querySelectorAll('.niguri-pin-code').forEach(button => {
    button.onclick = () => openPinPlanDetail(button.dataset.code, button.dataset.pinModel || 'Todos os modelos');
  });
}
// Calcula o mesmo consumo mensal usado pelo NIGURI, diretamente do plano anual.
// Cada EN/modelo do mês multiplica a necessidade unitária do pino naquele modelo.
function planAnnualPinConsumption(code, model = 'Todos os modelos') {
  const pin = (PINS.items || []).find(item => String(item.code) === String(code));
  if (!pin) return [];
  const planModels = typeof pinsNiguriPlanModels === 'function' ? pinsNiguriPlanModels(model) : [];
  const months = [...new Set(planModels.flatMap(entry => Object.keys(entry.quantidades || {}).filter(key => /^\d{2}\/\d{4}$/.test(key))))]
    .sort((a, b) => { const [am, ay] = a.split('/').map(Number); const [bm, by] = b.split('/').map(Number); return ay - by || am - bm; });
  return months.map(month => ({
    month,
    quantity: planModels.reduce((sum, entry) => sum + n(entry.quantidades?.[month]) * n(pin.modelNeeds?.[entry.modelo]), 0),
    models: planModels.filter(entry => n(entry.quantidades?.[month]) && n(pin.modelNeeds?.[entry.modelo])).map(entry => `${entry.modelo}: ${fmt(entry.quantidades[month])} × ${fmt(pin.modelNeeds?.[entry.modelo])}`).join(' · ')
  })).filter(entry => entry.quantity > 0);
}

function pinPlanOrderRows(code, model = 'Todos os modelos') {
  const item = itemByCode(code) || {};
  const consumption = planAnnualPinConsumption(code, model);
  return consumption.map(entry => {
    const order = n(item.orders?.[`PED ${entry.month}`]);
    return { ...entry, order, message: order > 0 ? `Já tem pedido com ${fmt(order)} ${item.unit || 'UN'}` : `Colocar ${fmt(entry.quantity)} ${item.unit || 'UN'}` };
  });
}

function markPurchaseButtonAdded(button) {
  if (!button) return;
  button.disabled = true;
  button.classList.add('added');
  button.textContent = '✓';
  button.title = 'Item já está no Processo de compra';
  button.setAttribute('aria-label', button.title);
}

function markPurchaseButtonsForItem(item, kind) {
  const key = purchaseKey(item, kind);
  document.querySelectorAll('.purchase-add-btn').forEach(button => {
    if (button.dataset.purchaseKey === key) markPurchaseButtonAdded(button);
  });
}

function bindPurchaseButtons() {
  document.querySelectorAll('.purchase-add-btn:not([disabled])').forEach(button => button.onclick = () => {
    const kind = button.dataset.purchaseKind || 'explosion';
    const item = kind === 'consumable'
      ? (CONSUMABLES.items || []).find(entry => String(entry.code) === String(button.dataset.purchaseCode))
      : itemByCode(button.dataset.purchaseCode);
    if (!item) return;
    // Não reconstruir a página: isso preserva filtros, pesquisa, rolagem e posição atual.
    const added = addToPurchaseProcess(item, kind, { refresh: false });
    if (added) markPurchaseButtonsForItem(item, kind);
  });
}

// Abre o detalhe completo do material selecionado pelo usuário.
function openMaterialDetail(code) {
  const item = itemByCode(code);
  if (!item) return;
  const isPin = (PINS.items || []).some(pin => String(pin.code) === String(code));
  const planDemands = isPin ? planAnnualPinConsumption(code) : [];
  const demands = planDemands.length ? planDemands.map(entry => [`DEM ${entry.month}`, entry.quantity]) : Object.entries(item.demands || {}).filter(([, value]) => n(value) > 0);
  const orders = orderEntries(item);
  const purchase = suggestedPurchase(item);
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.innerHTML = `<section class="material-detail" role="dialog" aria-modal="true" aria-label="Detalhe do material">
    <div class="material-detail-header"><div><span class="eyebrow">Detalhe do material</span><h2>${esc(item.code)}</h2><p>${esc(item.description)}</p></div><button class="icon-btn" id="close-material-detail" aria-label="Fechar">×</button></div>
    <div class="detail-metrics"><div><span>Estoque atual</span><b>${fmt(item.stock)} ${esc(item.unit)}</b></div><div><span>Estoque máximo</span><b>${fmt(item.stockMax || 0)} ${esc(item.unit)}</b></div><div><span>Segurança</span><b>${fmt(item.safety)} ${esc(item.unit)}</b></div><div><span>Compra sugerida</span><b class="detail-danger">${fmt(purchase)} ${esc(item.unit)}</b></div><div><span>Analista</span><b>${esc(item.analyst || '—')}</b></div></div>
    <div class="detail-grid"><div class="detail-section"><h3>Consumo nos meses</h3>${demands.length ? `<div class="detail-list">${demands.map(([month, value]) => `<div><span>${esc(month.replace('DEM ', ''))}</span><b>${fmt(value)} ${esc(item.unit)}</b></div>`).join('')}</div>` : '<p class="empty">Sem consumo mensal registado.</p>'}</div><div class="detail-section"><h3>Pedidos futuros e em aberto</h3>${orders.length ? `<div class="detail-list">${orders.map(order => `<div class="${order.overdue ? 'detail-overdue' : ''}"><span>${esc(order.month.replace('PED ', ''))}${order.overdue ? ' · FOLLOW-UP' : ''}</span><b>${fmt(order.quantity)} ${esc(item.unit)}</b></div>`).join('')}</div>` : '<p class="empty">Sem pedidos em aberto.</p>'}</div></div>
    <div class="detail-footer"><span>${esc(item.family || '—')} · ${esc(item.obtentionType || '—')}</span><button class="secondary-btn" id="close-material-detail-bottom">Fechar detalhe</button></div>
  </section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  $('#close-material-detail').onclick = close;
  $('#close-material-detail-bottom').onclick = close;
  overlay.onclick = event => { if (event.target === overlay) close(); };
}

function openPinPlanDetail(code, model = 'Todos os modelos') {
  const item = itemByCode(code);
  const pin = (PINS.items || []).find(entry => String(entry.code) === String(code));
  if (!item || !pin) return openMaterialDetail(code);
  const rows = pinPlanOrderRows(code, model);
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  const overlay = document.createElement('div'); overlay.className = 'detail-overlay';
  overlay.innerHTML = `<section class="material-detail" role="dialog" aria-modal="true" aria-label="Consumo mensal do pino"><div class="material-detail-header"><div><span class="eyebrow">Consumo mensal · Plano anual</span><h2>${esc(item.code)}</h2><p>${esc(item.description)}</p></div><button class="icon-btn" id="close-pin-plan-detail" aria-label="Fechar">×</button></div><div class="detail-metrics"><div><span>Modelo analisado</span><b>${esc(model)}</b></div><div><span>Estoque atual</span><b>${fmt(item.stock)} ${esc(item.unit || 'UN')}</b></div><div><span>Consumo até dezembro</span><b>${fmt(total)} ${esc(item.unit || 'UN')}</b></div><div><span>Meses com consumo</span><b>${fmt(rows.length)}</b></div></div><div class="detail-section"><h3>Necessidade e pedidos por mês</h3><p class="muted">A necessidade usa as ENs do plano anual e a estrutura unitária do pino.</p><div class="detail-list">${rows.map(row => `<div class="detail-list-row"><span>Mês ${esc(row.month)}</span><b>${esc(row.message)} · Necessidade ${fmt(row.quantity)} ${esc(item.unit || 'UN')}</b></div>`).join('') || '<p class="empty">Sem consumo mensal no plano anual para este pino/modelo.</p>'}</div></div><div class="detail-footer"><span>${esc(item.family || '—')} · ${esc(item.obtentionType || '—')}</span><button class="secondary-btn" id="close-pin-plan-detail-bottom">Fechar detalhe</button></div></section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove(); $('#close-pin-plan-detail').onclick = close; $('#close-pin-plan-detail-bottom').onclick = close; overlay.onclick = event => { if (event.target === overlay) close(); };
}

function followUpRows(items) {
  return items.map(item => `<tr><td><button class="material-code" data-code="${esc(item.code)}">${esc(item.code)}</button><div class="desc">${esc(item.description)}</div></td><td>${esc(item.analyst || '—')}</td><td>${fmt(item.stock)} ${esc(item.unit)}</td><td>${fmt(item.stockMax || 0)} ${esc(item.unit)}</td><td class="movement-date">${esc(movementDate(item.lastMovement))}</td><td>${item.overdueOrders.map(order => `<span class="overdue-tag">${esc(order.month.replace('PED ', ''))}: ${fmt(order.quantity)} ${esc(item.unit)}</span>`).join(' ')}</td><td><span class="status red">Follow-up necessário</span></td></tr>`).join('');
}

// Renderiza a tela com pedidos de meses anteriores que precisam de acompanhamento.
function followUpView() {
  const items = followUpItems();
  const rows = followUpRows(items);
  return `${filterBar()}<div class="view-title"><div><h2>Pedidos atrasados para acompanhamento</h2><p>Pedidos abertos em meses anteriores ao mês atual. Confirme o status com o time de compras.</p></div><button class="secondary-btn" id="back-to-overview">← Voltar à visão geral</button></div><div class="summary-strip"><div class="summary-box"><b class="danger">${fmt(items.length)}</b><span>Itens para acompanhamento</span></div><div class="summary-box"><b>${esc(currentMonthDate().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</b><span>Mês de referência</span></div></div><div class="panel"><div class="panel-header"><h3>Lista de pedidos atrasados</h3><span>${fmt(items.length)} itens</span></div><div class="panel-body"><div class="toolbar"><input class="input" id="follow-up-search" placeholder="Pesquisar código, descrição ou analista" /></div><div id="follow-up-table"><div class="table-wrap"><table class="data-table"><thead><tr><th>Material</th><th>Analista</th><th>Estoque</th><th>Estoque máximo</th><th>Última movimentação</th><th>Pedido em atraso</th><th>Situação</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">Nenhum pedido de mês anterior encontrado.</td></tr>'}</tbody></table></div></div></div></div>`;
}

// Formata o valor máximo do eixo vertical sem sobrecarregar o gráfico.
function chartValue(value) {
  const amount = n(value);
  if (amount >= 1000000) return `R$ ${(amount / 1000000).toFixed(1).replace('.', ',')} mi`;
  if (amount >= 1000) return `R$ ${(amount / 1000).toFixed(0)} mil`;
  return money(amount);
}

// Cria o gráfico de linha com duas séries: valor em reais e quantidade de itens.
function stockHistoryChart() {
  const records = (STOCK_HISTORY.records || []).slice(-12);
  if (!records.length) return '<div class="empty">Ainda não existe histórico registado.</div>';

  const width = 900;
  const height = 320;
  const padding = { top: 30, right: 28, bottom: 58, left: 78 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = records.map(record => n(record.stockValue));
  const counts = records.map(record => n(record.itemCount));
  const maxValue = Math.max(...values, 1);
  const maxCount = Math.max(...counts, 1);
  const x = index => records.length === 1 ? padding.left + plotWidth / 2 : padding.left + (index / (records.length - 1)) * plotWidth;
  const yValue = value => padding.top + plotHeight - (value / maxValue) * plotHeight;
  const yCount = value => padding.top + plotHeight - (value / maxCount) * plotHeight;
  const valuePoints = values.map((value, index) => `${x(index).toFixed(1)},${yValue(value).toFixed(1)}`).join(' ');
  const countPoints = counts.map((value, index) => `${x(index).toFixed(1)},${yCount(value).toFixed(1)}`).join(' ');
  const grid = [0, 0.5, 1].map(step => {
    const y = padding.top + plotHeight - step * plotHeight;
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="history-grid-line" /><text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" class="history-axis-label">${chartValue(maxValue * step)}</text><text x="${width - padding.right + 12}" y="${y + 4}" text-anchor="start" class="history-axis-label">${fmt(maxCount * step)} itens</text>`;
  }).join('');
  const labels = records.map((record, index) => `<text x="${x(index)}" y="${height - 22}" text-anchor="middle" class="history-axis-label">${esc(record.label || record.date)}</text>`).join('');
  const dots = records.map((record, index) => `<circle cx="${x(index)}" cy="${yValue(values[index])}" r="4" class="history-dot-value"><title>${esc(record.label || record.date)} · ${money(values[index])}</title></circle><circle cx="${x(index)}" cy="${yCount(counts[index])}" r="4" class="history-dot-count"><title>${esc(record.label || record.date)} · ${fmt(counts[index])} itens</title></circle>`).join('');
  const latest = records[records.length - 1];
  return `<div class="history-chart-wrap"><div class="history-summary"><div><span>Último valor registado</span><b>${money(latest.stockValue)}</b></div><div><span>Itens no último registo</span><b>${fmt(latest.itemCount)}</b></div><div><span>Registos disponíveis</span><b>${fmt(records.length)}</b></div></div><div class="history-legend"><span><i class="history-legend-value"></i> Valor do estoque</span><span><i class="history-legend-count"></i> Quantidade de itens</span></div><div class="history-chart-scroll"><svg class="history-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução do valor do estoque e da quantidade de itens"><g>${grid}</g><polyline points="${valuePoints}" class="history-line history-line-value" /><polyline points="${countPoints}" class="history-line history-line-count" />${dots}${labels}</svg></div></div>`;
}

// Renderiza uma página separada para acompanhar a evolução histórica do estoque.
function stockHistoryView() {
  return `${filterBar()}<div class="view-title"><div><h2>Evolução do estoque</h2><p>em faze de teste, logo teremos a evoluçao do estoque.</p></div><div class="date-pill">A partir de ${esc(STOCK_HISTORY.records?.[0]?.label || 'este mês')}</div></div><div class="panel"><div class="panel-header"><h3>Histórico do estoque</h3><span>Atualização mensal</span></div><div class="panel-body">${stockHistoryChart()}</div></div><div class="panel history-help-panel"><div class="panel-header"><h3>Como o histórico cresce</h3></div><div class="panel-body"><p>Cada atualização da planilha acrescenta um novo registo com a data, o valor total do estoque e a quantidade de materiais. O primeiro ponto representa a base atual.</p><p class="history-note">Se dois registos forem feitos no mesmo mês, será mantido o registo mais recente desse mês.</p></div></div>`;
}

function plannedModelKey(name) {
  const raw = String(name || '').toUpperCase();
  const aliases = [['10S','10S'],['10HDOC','10HDOC'],['15LDDI','15LDDI'],['13,5 AT','13AT'],['13.5 AT','13AT'],['13 69','13-69kv'],['13 LDI','13ldi-46kv'],['16.5T','guin-16T'],['25T','guin-25T'],['45T','guin-45'],['21T','21T'],['30T','30-T'],['12T','12-T'],['7T','7T']];
  const alias = aliases.find(([needle]) => raw.includes(needle.replace('.', ',')) || raw.includes(needle));
  if (alias && DATA?.models?.[alias[1]]) return alias[1];
  const target = raw.replace(/[^A-Z0-9]/g, '');
  return Object.keys(DATA?.models || {}).find(key => { const candidate = String(key).toUpperCase().replace(/[^A-Z0-9]/g, ''); return candidate && (target.includes(candidate) || candidate.includes(target)); }) || '';
}
function plannedGeneralItems() {
  const releases = DATA?.planMonth?.liberacoes || [];
  const needs = new Map();
  releases.forEach(release => {
    const key = plannedModelKey(release.modelo);
    if (!key) return;
    (DATA.models[key] || []).forEach(component => {
      const row = needs.get(String(component.code)) || { need: 0, demand: 0, models: [], stocks: [] };
      row.need += n(component.quantity);
      row.demand += n(component.demand);
      if (component.stock !== undefined) row.stocks.push(n(component.stock));
      if (!row.models.includes(key)) row.models.push(key);
      needs.set(String(component.code), row);
    });
  });
  return [...needs.entries()].map(([code, plan]) => {
    const item = itemByCode(code) || { code, description: '', stock: 0, orders: {}, unit: 'UN' };
    const [status] = risk(item, plan.need);
    return { ...item, stock: plan.stocks.length ? Math.min(...plan.stocks) : n(item.stock), plannedNeed: plan.need, structureDemand: plan.demand, plannedModels: plan.models, plannedStatus: status };
  }).filter(item => item.plannedStatus !== 'Regular');
}
function plannedSignalItems(kind) {
  return plannedGeneralItems().filter(item => kind === 'critical' ? item.plannedStatus === 'Crítico' : item.plannedStatus === 'Em atenção');
}
function programacaoAlertPanel() {
  const releases = DATA?.planMonth?.liberacoes || [];
  const grouped = new Map();
  releases.forEach(item => { const key = item.modelo || 'Sem modelo'; const row = grouped.get(key) || { ...item, total: 0 }; row.total += 1; grouped.set(key, row); });
  const models = [...grouped.values()];
  const critical = plannedSignalItems('critical');
  const attention = plannedSignalItems('attention');
  const signal = (label, items, cls) => `<button class="risk-signal ${cls}" data-export-alert="${cls}"><span>${label}</span><b>${fmt(items.length)}</b><small>exportar itens</small></button>`;
  const allPlanned = plannedGeneralItems();
  const modelCards = models.map(model => { const key = plannedModelKey(model.modelo); const items = allPlanned.filter(item => item.plannedModels?.includes(key)); const crit = items.filter(item => item.plannedStatus === 'Crítico').length; const att = items.filter(item => item.plannedStatus === 'Em atenção').length; const cls = crit ? 'critical' : att ? 'attention' : 'regular'; const label = crit ? 'Crítico' : att ? 'Atenção' : 'Regular'; return `<div class="model-signal-card"><div><strong>${esc(model.modelo || 'Sem modelo')}</strong><small>${fmt(model.total)} carro${model.total === 1 ? '' : 's'} · ${fmt(crit + att)} itens em risco</small></div><span class="status ${cls === 'critical' ? 'red' : cls === 'attention' ? 'amber' : 'green'}">${label}</span></div>`; }).join('');
  return `<div class="panel programacao-alert-panel"><div class="panel-header"><div><span class="eyebrow">Liberação programada</span><h3>Visão geral · carros a liberar</h3><span>Fonte: PLANO MES · AA:AF</span></div><span class="date-pill">${fmt(releases.length)} carros</span></div><div class="panel-body"><div class="model-signal-grid">${modelCards || '<div class="empty">Nenhum modelo programado.</div>'}</div><div class="release-table-wrap"><table class="data-table release-table"><thead><tr><th>EN</th><th>Cliente</th><th>Modelo</th><th>PL</th><th>Nome</th><th>Data</th></tr></thead><tbody>${releases.map(item => `<tr><td>${esc(item.en || '—')}</td><td>${esc(item.cliente || '—')}</td><td>${esc(item.modelo || '—')}</td><td>${esc(item.pl || '—')}</td><td>${esc(item.nome || '—')}</td><td>${esc(item.data ? new Date(item.data).toLocaleDateString('pt-BR') : '—')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhuma liberação encontrada.</td></tr>'}</tbody></table></div><div class="alert-export-row">${signal('Críticos', critical, 'critical')}${signal('Atenção', attention, 'attention')}</div></div></div>`;
}
function overview() {
  const base = scopedItems();
  const attention = base.filter(item => risk(item)[0] !== 'Regular').length;
  const regular = base.length - attention;
  const stockValue = base.reduce((sum, item) => sum + n(item.stockValue), 0);
  return `${filterBar()}${metrics()}<div class="dashboard-grid">${riskChart()}${orderPanel()}</div>${planMonthPanel()}${programacaoAlertPanel()}`;
}

function stockView() {
  return `${filterBar()}<div class="view-title"><h2>Estoque</h2><p>Demanda consolidada das colunas DEM da Programacao.</p></div><div class="panel"><div class="panel-body"><div class="toolbar"><input class="input" id="stock-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="stock-risk"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regular</option></select></div><div id="stock-table">${table(scopedItems(), 250, false, '', true)}</div></div></div>`;
}

function demandTotals(month, base) {
  return base.reduce((sum, item) => sum + n(item.demands?.[month]), 0);
}
function ordersItemsForMonth(base, month) {
  return (base || []).map(item => ({ ...item, need: n(item.demands?.[month]), balance: n(item.stock) - n(item.demands?.[month]) })).filter(item => n(item.need) > 0).sort((a, b) => a.balance - b.balance);
}

function demandPanel(base) {
  const months = DATA.demandMonths || [];
  const chosen = demandMonth === 'all' ? months : months.filter(month => month === demandMonth);
  const values = chosen.map(month => demandTotals(month, base));
  const max = Math.max(...values, 1);
  return `<div class="panel"><div class="panel-header"><h3>Demanda mensal da explosão</h3><span>Itens/unidades nas colunas DEM da Programacao</span></div><div class="panel-body">${chosen.map((month, index) => `<div class="chart-row"><span>${month.replace('DEM ', '')}</span><div class="bar-track"><div class="bar-fill" style="background:#18a999;width:${values[index] / max * 100}%"></div></div><b>${fmt(values[index])}</b></div>`).join('') || '<div class="empty">Não foram encontradas colunas DEM.</div>'}</div></div>`;
}

function excessMonthPairs() {
  const orderMonths = DATA?.months || [];
  const demandMonths = new Set(DATA?.demandMonths || []);
  return orderMonths.map(orderMonth => {
    const suffix = String(orderMonth).replace(/^PED\s*/, '');
    const demandMonth = `DEM ${suffix}`;
    return demandMonths.has(demandMonth) ? { orderMonth, demandMonth, label: suffix } : null;
  }).filter(Boolean);
}

function excessRows(rows) {
  return rows.map(row => `<tr class="excess-row"><td><button class="material-code excess-code" data-excess-code="${esc(row.code)}" data-excess-month="${esc(row.orderMonth)}">${esc(row.code)}</button><div class="desc">${esc(row.description)}</div></td><td>${fmt(row.stock)} ${esc(row.unit)}</td><td class="movement-date">${esc(movementDate(row.lastMovement))}</td><td>${fmt(row.demand)} ${esc(row.unit)}</td><td>${fmt(row.order)} ${esc(row.unit)}</td><td class="danger-text">${fmt(row.excess)} ${esc(row.unit)}</td><td>${esc(row.label)}</td><td><span class="status amber">Follow-up</span></td></tr>`).join('');
}

function openExcessDetail(code, selectedMonth = '') {
  const item = itemByCode(code);
  if (!item) return;
  const rows = excessMonthPairs().map(pair => {
    const demand = n(item.demands?.[pair.demandMonth]);
    const order = n(item.orders?.[pair.orderMonth]);
    const excess = Math.max(0, order - demand);
    return `<div class="detail-list-row ${excess > 0 ? 'detail-overdue' : ''}"><span>${esc(pair.label)}${pair.orderMonth === selectedMonth ? ' · mês selecionado' : ''}</span><b>Demanda ${fmt(demand)} · Pedido ${fmt(order)}${excess > 0 ? ` · Excesso ${fmt(excess)}` : ''}</b></div>`;
  }).join('');
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.innerHTML = `<section class="material-detail" role="dialog" aria-modal="true"><div class="material-detail-header"><div><span class="eyebrow">Pedidos em excesso</span><h2>${esc(item.code)}</h2><p>${esc(item.description)}</p></div><button class="icon-btn" id="close-excess-detail">×</button></div><div class="detail-metrics"><div><span>Estoque atual</span><b>${fmt(item.stock)} ${esc(item.unit)}</b></div><div><span>Estoque máximo</span><b>${fmt(item.stockMax || 0)} ${esc(item.unit)}</b></div><div><span>Analista</span><b>${esc(item.analyst || '—')}</b></div><div><span>Excessos mensais</span><b>${fmt(excessMonthPairs().filter(pair => n(item.orders?.[pair.orderMonth]) > n(item.demands?.[pair.demandMonth])).length)}</b></div></div><div class="detail-section"><h3>Demanda e pedidos por mês</h3><div class="detail-list">${rows || '<p class="empty">Sem dados mensais.</p>'}</div></div><div class="detail-footer"><span class="status red">Meses vermelhos exigem follow-up com Compras</span><button class="secondary-btn" id="close-excess-detail-bottom">Fechar</button></div></section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  $('#close-excess-detail').onclick = close;
  $('#close-excess-detail-bottom').onclick = close;
  overlay.onclick = event => { if (event.target === overlay) close(); };
}

function excessView() {
  const pairs = excessMonthPairs().filter(pair => excessMonth === 'all' || pair.orderMonth === excessMonth);
  const rows = [];
  pairs.forEach(pair => scopedItems().forEach(item => {
    const demand = n(item.demands?.[pair.demandMonth]);
    const order = n(item.orders?.[pair.orderMonth]);
    if (order > demand && order > 0) rows.push({ ...item, orderMonth: pair.orderMonth, label: pair.label, demand, order, excess: order - demand });
  }));
  rows.sort((a, b) => b.excess - a.excess);
  return `${filterBar()}<div class="view-title"><div><h2>Pedidos em excesso</h2><p>Comparação exata entre pedido e demanda do próprio mês.</p></div><div class="date-pill">Follow-up com Compras</div></div><div class="toolbar"><label class="filter-label">Mês:</label><select class="select" id="excess-month"><option value="all">Todos os meses</option>${excessMonthPairs().map(pair => `<option value="${esc(pair.orderMonth)}" ${excessMonth === pair.orderMonth ? 'selected' : ''}>${esc(pair.label)}</option>`).join('')} </select><input class="input" id="excess-search" placeholder="Pesquisar código ou descrição" /></div><div class="summary-strip"><div class="summary-box"><b class="danger">${fmt(rows.length)}</b><span>Excessos mensais</span></div><div class="summary-box"><b>${fmt(new Set(rows.map(row => row.code)).size)}</b><span>Materiais para verificar</span></div><div class="summary-box"><b>${fmt(rows.reduce((sum, row) => sum + row.excess, 0))}</b><span>Unidades em excesso</span></div></div><div class="panel"><div class="panel-header"><h3>Pedidos acima da demanda do mês</h3><span>Clique no código para abrir os próximos meses</span></div><div class="table-wrap"><table class="data-table excess-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Última movimentação</th><th>Demanda</th><th>Pedido</th><th>Excesso</th><th>Mês</th><th>Follow-up</th></tr></thead><tbody id="excess-table-body">${excessRows(rows) || '<tr><td colspan="8" class="empty">Nenhum pedido acima da demanda mensal.</td></tr>'}</tbody></table></div></div>`;
}

function ordersView() {
  const base = DATA.items || [];
  const overdue = base.filter(item => risk(item)[0] !== 'Regular' && Object.values(item.orders || {}).every(value => n(value) === 0));
  const open = base.filter(item => Object.values(item.orders || {}).some(value => n(value) > 0));
  const availableDemandMonths = (DATA.demandMonths?.length ? DATA.demandMonths : [...new Set(base.flatMap(item => Object.keys(item.demands || {})))]).filter(month => base.some(item => n(item.demands?.[month]) > 0));
  const chosen = demandMonth !== 'all' && availableDemandMonths.includes(demandMonth) ? demandMonth : (availableDemandMonths[0] || '');
  const monthItems = chosen ? ordersItemsForMonth(base, chosen) : [];
  return `${filterBar()}<div class="view-title"><h2>Pedidos e demanda</h2><p>Pedidos, demanda mensal e saldo projetado por material.</p></div><div class="toolbar"><label class="filter-label">Mês da demanda:</label><select class="select" id="demand-month"><option value="all">Todos os meses</option>${availableDemandMonths.map(month => `<option value="${esc(month)}" ${demandMonth === month ? 'selected' : ''}>${esc(month.replace('DEM ', ''))}</option>`).join('')}</select><input class="input" id="orders-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="orders-risk"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regular</option></select></div><div class="summary-strip"><div class="summary-box"><b>${fmt(DATA.openRequests)}</b><span>Solicitações em obtenção</span></div><div class="summary-box"><b>${fmt(open.length)}</b><span>Itens com pedido PED</span></div><div class="summary-box"><b class="danger">${fmt(overdue.length)}</b><span>Itens sem pedido</span></div></div><div class="dashboard-grid">${demandPanel(base)}${orderPanel(base)}</div><div class="panel"><div class="panel-header"><h3>${chosen ? `Necessidade para ${esc(chosen)}` : 'Selecione um mês'}</h3><span>Demanda × estoque</span></div><div id="orders-table">${chosen ? table(monthItems, 150, true, chosen) : '<div class="empty">Selecione um mês para mostrar os itens e o saldo projetado.</div>'}</div></div>`;
}

function modelsView() {
  return `${filterBar()}<div class="view-title"><h2>Estrutura de modelos</h2><p>Escolha um modelo para consultar os componentes da explosão.</p></div><div class="model-grid">${Object.entries(DATA.models).map(([name, items]) => `<div class="model-card" data-model="${esc(name)}"><b>${esc(name)}</b><span>Estrutura da explosão</span><strong>${fmt(items.length)} componentes →</strong></div>`).join('')}</div><div id="model-detail" class="panel" style="margin-top:20px;display:none"></div>`;
}

function simulation() {
  const names = Object.keys(DATA.models || {});
  const defaultStart = '2026-08-01';
  const defaultEnd = '2026-08-07';
  return `${filterBar()}<div class="simulation-page"><div class="weekly-simulator"><div class="panel form-panel weekly-sim-config"><div class="simulation-config-header simulation-main-header"><div><span class="eyebrow">Planejamento operacional</span><h2>Simulação de necessidade</h2><span class="simulation-top-badge">Simulação semanal</span></div></div><div class="simulation-section-label"><span>1</span><div><b>Período de planeamento</b><small>A data define o mês de referência da necessidade.</small></div></div><div class="date-range-grid"><div class="field date-field"><label for="sim-week-start">Início da semana</label><div class="date-input-wrap"><span>◷</span><input class="input" id="sim-week-start" type="date" value="${defaultStart}" /></div></div><div class="field date-field"><label for="sim-week-end">Fim da semana</label><div class="date-input-wrap"><span>◷</span><input class="input" id="sim-week-end" type="date" value="${defaultEnd}" /></div></div></div><div class="simulation-section-label model-section-label"><span>2</span><div><b>Modelos e quantidades</b><small>Marque os modelos e informe o número de carros.</small></div></div><div class="sim-model-list">${names.map(name => `<label class="sim-model-option"><span class="sim-model-check"><input type="checkbox" data-sim-model="${esc(name)}" /><i></i></span><span class="sim-model-name">${esc(name)}</span><span class="sim-model-unit">carros</span><input class="input sim-model-cars" data-sim-cars="${esc(name)}" type="number" min="1" value="1" aria-label="Quantidade de carros para ${esc(name)}" /></label>`).join('')}</div><div class="simulation-action-row"><div><b>Pronto para calcular?</b><span>A simulação consolidará os materiais dos modelos escolhidos.</span></div><button class="primary-btn" id="run-simulation"><span>Calcular necessidade</span><strong>→</strong></button></div></div><div id="sim-result" class="panel simulation-result-panel"><div class="simulation-empty"><div class="simulation-empty-icon">◎</div><h3>A sua simulação aparecerá aqui</h3><p>Selecione pelo menos um modelo e calcule a necessidade para visualizar o resultado consolidado.</p></div></div></div></div>`;
}

// Resume os pedidos do material e conserva o mês de cada quantidade.
function simulationOrderEntries(item) {
  return Object.entries(item.orders || {})
    .map(([month, value]) => ({ month, quantity: n(value) }))
    .filter(entry => entry.quantity > 0)
    .sort((a, b) => a.month.localeCompare(b.month));
}

function simulationOrderState(item) {
  const entries = simulationOrderEntries(item);
  const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const overdue = entries.some(entry => isPastOrderMonth(entry.month));
  return {
    entries,
    total,
    hasOrder: entries.length > 0,
    overdue,
    label: !entries.length ? 'Sem pedido' : overdue ? 'Com pedido em atraso' : 'Com pedido',
    color: !entries.length ? 'red' : overdue ? 'amber' : 'green',
    filter: !entries.length ? 'sem-pedido' : overdue ? 'pedido-atrasado' : 'com-pedido'
  };
}

// Calcula a quantidade que falta comprar para a necessidade da Simulação.
function simulationPurchaseQuantity(row, demandLabel = '') {
  if (!procurementDecision(row, row.need, demandLabel).canBuy) return 0;
  return Math.max(0, n(row.need) + n(row.safety) - n(row.stock));
}

function simulationOrderMonths(item) {
  const entries = simulationOrderEntries(item);
  if (!entries.length) return '<span class="simulation-no-orders">Sem pedidos mensais</span>';
  return `<div class="simulation-order-months">${entries.map(entry => `<span class="simulation-order-month"><b>${esc(entry.month.replace('PED ', ''))}</b><span>${fmt(entry.quantity)} ${esc(item.unit || 'UN')}</span></span>`).join('')}</div>`;
}

function weeklySimulationRows(rows, demandLabel = '') {
  return rows.map(row => {
    const orderState = simulationOrderState(row);
    const decision = procurementDecision(row, row.need, demandLabel);
    const suggested = simulationPurchaseQuantity(row, demandLabel);
    const alreadyAdded = isInPurchaseProcess(row, 'explosion');
    const canAdd = decision.canBuy && suggested > 0 && !alreadyAdded;
    const addLabel = alreadyAdded ? 'Adicionado' : canAdd ? '+' : '—';
    return `<tr><td><button class="material-code simulation-code" data-sim-code="${esc(row.code)}" title="Ver em quais modelos este código é utilizado">${esc(row.code)}</button><div class="desc" title="${esc(row.description)}">${esc(row.description)}</div></td><td>${fmt(row.need)} ${esc(row.unit || 'UN')}</td><td>${fmt(row.stock)} ${esc(row.unit || 'UN')}</td><td class="movement-date">${esc(movementDate(row.lastMovement))}</td><td class="${row.balance < 0 ? 'danger-text' : ''}">${fmt(row.balance)} ${esc(row.unit || 'UN')}</td><td><span class="status ${row.simRisk === 'Crítico' ? 'red' : row.simRisk === 'Em atenção' ? 'amber' : 'green'}">${esc(row.simRisk)}</span></td><td><span class="status ${orderState.color}">${esc(orderState.label)}${orderState.hasOrder ? ` · ${fmt(orderState.total)} ${esc(row.unit || 'UN')}` : ''}</span>${simulationOrderMonths(row)}</td><td>${row.models.map(model => `<span class="model-chip">${esc(model.name)} · ${fmt(model.need)}</span>`).join('')}</td><td><span class="status ${decision.color}">${decision.label}</span>${canAdd ? `<button class="purchase-add-btn simulation-purchase-btn" data-sim-purchase-code="${esc(row.code)}" title="Adicionar ${fmt(suggested)} ${esc(row.unit || 'UN')} ao Processo de compra" aria-label="Adicionar ao Processo de compra">+</button>` : ''}</td></tr>`;
  }).join('');
}

function openSimulationCodeDetail(code, rows) {
  const row = rows.find(item => String(item.code) === String(code));
  if (!row) return;
  const orderState = simulationOrderState(row);
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.innerHTML = `<section class="material-detail" role="dialog" aria-modal="true" aria-label="Modelos que utilizam o código"><div class="material-detail-header"><div><span class="eyebrow">Detalhe da simulação semanal</span><h2>${esc(row.code)}</h2><p>${esc(row.description)}</p></div><button class="icon-btn" id="close-simulation-detail" aria-label="Fechar">×</button></div><div class="detail-metrics"><div><span>Necessidade consolidada</span><b>${fmt(row.need)} ${esc(row.unit || 'UN')}</b></div><div><span>Estoque atual</span><b>${fmt(row.stock)} ${esc(row.unit || 'UN')}</b></div><div><span>Saldo projetado</span><b>${fmt(row.balance)} ${esc(row.unit || 'UN')}</b></div><div><span>Pedidos em aberto</span><b>${esc(orderState.label)}${orderState.hasOrder ? ` · ${fmt(orderState.total)} ${esc(row.unit || 'UN')}` : ''}</b></div><div><span>Modelos associados</span><b>${fmt(row.models.length)}</b></div></div><div class="detail-section"><h3>Utilização por modelo</h3><div class="detail-list">${row.models.map(model => `<div><span>${esc(model.name)}</span><b>${fmt(model.need)} ${esc(row.unit || 'UN')}</b></div>`).join('')}</div></div><div class="detail-footer"><span class="status ${row.simRisk === 'Crítico' ? 'red' : row.simRisk === 'Em atenção' ? 'amber' : 'green'}">${esc(row.simRisk)}</span><button class="secondary-btn" id="close-simulation-detail-bottom">Fechar detalhe</button></div></section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  $('#close-simulation-detail').onclick = close;
  $('#close-simulation-detail-bottom').onclick = close;
  overlay.onclick = event => { if (event.target === overlay) close(); };
}

function runWeeklySimulation() {
  const start = $('#sim-week-start')?.value || '';
  const end = $('#sim-week-end')?.value || '';
  const selections = [...document.querySelectorAll('[data-sim-model]:checked')].map(input => ({ name: input.dataset.simModel, cars: Math.max(1, n($(`[data-sim-cars="${CSS.escape(input.dataset.simModel)}"]`)?.value)) }));
  const result = $('#sim-result');
  if (!start || !end || start > end) { result.innerHTML = '<div class="empty danger-text">Informe um intervalo de datas válido.</div>'; return; }
  if (!selections.length) { result.innerHTML = '<div class="empty danger-text">Selecione pelo menos um modelo.</div>'; return; }
  const byCode = new Map();
  selections.forEach(selection => (DATA.models[selection.name] || []).forEach(component => {
    const base = itemByCode(component.code) || { code: component.code, description: component.description, stock: 0, safety: 0, orders: {}, unit: 'UN', analyst: '', family: '', obtentionType: '' };
    if (!matchesGlobalFilters(base)) return;
    const need = n(component.quantity) * selection.cars;
    const current = byCode.get(String(component.code)) || { ...base, need: 0, models: [] };
    current.need += need;
    const modelRow = current.models.find(model => model.name === selection.name);
    if (modelRow) modelRow.need += need; else current.models.push({ name: selection.name, need });
    byCode.set(String(component.code), current);
  }));
  const referenceDemandLabel = `DEM ${start.slice(5, 7)}/${start.slice(0, 4)}`;
  const rows = [...byCode.values()].map(item => ({ ...item, balance: n(item.stock) - item.need, simRisk: risk(item, item.need)[0] })).sort((a, b) => (a.simRisk === b.simRisk ? b.need - a.need : a.simRisk === 'Crítico' ? -1 : b.simRisk === 'Crítico' ? 1 : a.simRisk === 'Em atenção' ? -1 : 1));
  const counts = { Crítico: 0, 'Em atenção': 0, Regular: 0 };
  rows.forEach(item => counts[item.simRisk]++);
  const startLabel = new Date(`${start}T00:00:00`).toLocaleDateString('pt-BR');
  const endLabel = new Date(`${end}T00:00:00`).toLocaleDateString('pt-BR');
  let riskFilter = 'all';
  let orderFilter = 'all';
  let simulationSearch = '';
  const matchesSimulationFilters = row => {
    const orderState = simulationOrderState(row);
    const query = simulationSearch.trim().toLowerCase();
    const searchable = `${row.code || ''} ${row.description || ''}`.toLowerCase();
    return (!query || searchable.includes(query))
      && (riskFilter === 'all' || row.simRisk === riskFilter)
      && (orderFilter === 'all' || orderState.filter === orderFilter);
  };
  const bindSimulationActions = visibleRows => {
    document.querySelectorAll('.simulation-code').forEach(button => button.onclick = () => openSimulationCodeDetail(button.dataset.simCode, visibleRows));
    document.querySelectorAll('.simulation-purchase-btn').forEach(button => button.onclick = () => {
      const row = visibleRows.find(item => String(item.code) === String(button.dataset.simPurchaseCode));
      if (!row) return;
      const quantity = simulationPurchaseQuantity(row, referenceDemandLabel);
      if (!addToPurchaseProcess(row, 'explosion', { refresh: false, quantity })) return;
      button.disabled = true;
      button.classList.add('added');
      button.textContent = 'Adicionado';
      button.title = 'Material já adicionado ao Processo de compra';
      button.setAttribute('aria-label', 'Adicionado');
    });
  };
  const renderSimulationRows = () => {
    const visibleRows = rows.filter(matchesSimulationFilters);
    const body = $('#sim-weekly-tbody');
    const count = $('#sim-filter-count');
    if (body) body.innerHTML = weeklySimulationRows(visibleRows, referenceDemandLabel) || '<tr><td colspan="9" class="empty">Nenhum item corresponde aos filtros selecionados.</td></tr>';
    if (count) count.textContent = `${fmt(visibleRows.length)} de ${fmt(rows.length)} códigos`;
    bindSimulationActions(visibleRows);
  };
  result.innerHTML = `<div class="panel-header"><div><h3>Resultado · ${startLabel} a ${endLabel}</h3><span>${selections.map(selection => `${esc(selection.name)} · ${fmt(selection.cars)} carro${selection.cars === 1 ? '' : 's'}`).join(' · ')}</span></div><span id="sim-filter-count">${fmt(rows.length)} códigos</span></div><div class="panel-body"><div class="summary-strip"><div class="summary-box"><b class="danger">${counts['Crítico']}</b><span>Críticos</span></div><div class="summary-box"><b style="color:#a36a08">${counts['Em atenção']}</b><span>Em atenção</span></div><div class="summary-box"><b style="color:#19784f">${counts.Regular}</b><span>Regulares</span></div><div class="summary-box"><b>${fmt(rows.reduce((sum, row) => sum + row.need, 0))}</b><span>Necessidade total</span></div></div><div class="simulation-filters"><label class="filter-label simulation-search-label" for="simulation-search">Pesquisar código ou descrição</label><input class="input simulation-search-input" id="simulation-search" type="search" placeholder="Digite o código ou a descrição..." autocomplete="off" /><label class="filter-label" for="simulation-risk-filter">Situação</label><select class="select" id="simulation-risk-filter"><option value="all">Todas as situações</option><option value="Regular">Regular</option><option value="Em atenção">Em atenção</option><option value="Crítico">Crítico</option></select><label class="filter-label" for="simulation-order-filter">Pedidos</label><select class="select" id="simulation-order-filter"><option value="all">Todos os pedidos</option><option value="sem-pedido">Sem pedido</option><option value="com-pedido">Com pedido</option><option value="pedido-atrasado">Com pedido em atraso</option></select></div><div class="table-wrap simulation-full-width"><table class="data-table weekly-simulation-table"><thead><tr><th>Código / descrição</th><th>Necessidade</th><th>Estoque</th><th>Última movimentação</th><th>Saldo</th><th>Risco</th><th>Pedidos por mês</th><th>Modelos que utilizam</th><th>Decisão</th></tr></thead><tbody id="sim-weekly-tbody"></tbody></table></div></div>`;
  $('#simulation-search').oninput = event => { simulationSearch = event.target.value; renderSimulationRows(); };
  $('#simulation-risk-filter').onchange = event => { riskFilter = event.target.value; renderSimulationRows(); };
  $('#simulation-order-filter').onchange = event => { orderFilter = event.target.value; renderSimulationRows(); };
  renderSimulationRows();
}
// Define a classe visual conforme a situação calculada nas colunas M e N.
function consumableStatus(item) {
  const maxText = String(item.maxStatus || '').toLowerCase();
  const stockText = String(item.stockStatus || '').toLowerCase();
  if (maxText.includes('acima') || maxText.includes('máximo') || maxText.includes('maximo')) return { label: 'Acima do máximo', color: 'red' };
  if (stockText.includes('comprar') || String(item.buyStatus || '').toLowerCase().includes('comprar')) return { label: 'Comprar', color: 'amber' };
  return { label: 'Não comprar', color: 'green' };
}

// Verifica se existe pedido de consumível em algum mês.
function consumableHasOrder(item) {
  return Object.values(item.orders || {}).some(value => n(value) > 0);
}

// Verifica se o consumível possui pedido aberto num mês anterior ao atual.
function consumableHasOverdueOrder(item) {
  return Object.entries(item.orders || {}).some(([month, value]) => n(value) > 0 && isPastOrderMonth(month));
}

function consumableDecision(item) {
  const base = consumableStatus(item);
  if (base.label === 'Acima do máximo') return base;
  if (n(item.stock) <= 0) return consumableHasOrder(item) ? { label: 'Follow-up', color: 'amber' } : { label: 'Comprar', color: 'red' };
  if (consumableHasOrder(item) && base.label === 'Comprar') return { label: 'Follow-up', color: 'amber' };
  return base;
}

// Abre uma janela com todos os dados do consumível selecionado.
function openConsumableDetail(code) {
  const item = (CONSUMABLES.items || []).find(entry => String(entry.code) === String(code));
  if (!item) return;
  const state = consumableDecision(item);
  const orders = Object.entries(item.orders || {}).filter(([, value]) => n(value) > 0);
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  overlay.innerHTML = `<section class="material-detail" role="dialog" aria-modal="true" aria-label="Detalhe do consumível">
    <div class="material-detail-header"><div><span class="eyebrow">Detalhe do consumível</span><h2>${esc(item.code)}</h2><p>${esc(item.description)}</p></div><button class="icon-btn" id="close-consumable-detail" aria-label="Fechar">×</button></div>
    <div class="detail-metrics"><div><span>Estoque atual</span><b>${fmt(item.stock)}</b></div><div><span>Quantidade de compra</span><b>${fmt(item.purchaseQty)}</b></div><div><span>Estoque mínimo</span><b>${fmt(item.minStock)}</b></div><div><span>Estoque máximo</span><b>${fmt(item.maxStock)}</b></div></div>
    <div class="detail-grid"><div class="detail-section"><h3>Situação</h3><div class="detail-list"><div><span>Status do estoque</span><b>${esc(item.stockStatus || '—')}</b></div><div><span>Status do máximo</span><b>${esc(item.maxStatus || '—')}</b></div><div><span>Revisão</span><b>${esc(item.reviewStatus || '—')}</b></div></div></div><div class="detail-section"><h3>Pedidos e acompanhamento</h3>${orders.length ? `<div class="detail-list">${orders.map(([month, value]) => `<div class="${isPastOrderMonth(month) ? 'detail-overdue' : ''}"><span>${esc(month)}${isPastOrderMonth(month) ? ' · ACOMPANHAMENTO' : ''}</span><b>${fmt(value)}</b></div>`).join('')}</div>` : '<p class="empty">Sem pedidos em aberto.</p>'}</div></div>
    <div class="detail-footer"><span class="status ${state.color}">${state.label}</span><button class="secondary-btn" id="close-consumable-detail-bottom">Fechar detalhe</button></div>
  </section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  $('#close-consumable-detail').onclick = close;
  $('#close-consumable-detail-bottom').onclick = close;
  overlay.onclick = event => { if (event.target === overlay) close(); };
}

function consumableRows(items) {
  return items.map(item => {
    const state = consumableDecision(item);
    const hasOrder = consumableHasOrder(item);
    const overdue = consumableHasOverdueOrder(item);
          return `<tr><td><button class="material-code consumable-code" data-code="${esc(item.code)}" title="Abrir detalhe do consumível">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${fmt(item.stock)}</td><td class="movement-date">${esc(movementDate(item.lastMovement))}</td><td>${fmt(item.purchaseQty)}</td><td>${fmt(item.minStock)}</td><td>${fmt(item.maxStock)}</td><td>${esc(item.stockStatus || '—')}</td><td>${esc(item.maxStatus || '—')}</td><td>${hasOrder ? 'Sim' : 'Não'}</td><td>${overdue ? '<span class="status red">Follow-up</span>' : '<span class="status green">Sem atraso</span>'}</td><td><span class="status ${state.color}">${state.label}</span></td><td>${purchaseAction(item, 'consumable')}</td></tr>`;

  }).join('');
}

// Os consumíveis não têm campos de analista, família ou obtenção na planilha enviada.
// Por isso, os filtros globais ficam disponíveis, mas não ocultam itens sem esses campos.
function consumablesFilteredItems() {
  const items = CONSUMABLES.items || [];
  const hasClassification = items.some(item => item.analyst || item.family || item.obtentionType);
  return items.filter(item => (hasClassification ? matchesGlobalFilters(item) : matchesStockFilter(item)));
}

function consumablesView() {
  const items = consumablesFilteredItems();
  return `${filterBar()}<div class="view-title"><div><h2>Consumíveis</h2><p>Controle itens específicos, quantidade de compra, estoque mínimo e máximo.</p></div><div class="date-pill">Base: ${esc(CONSUMABLES.sourceFile || 'consumiveis')}</div></div><div class="summary-strip"><div class="summary-box"><b>${fmt(items.length)}</b><span>Consumíveis cadastrados</span></div><div class="summary-box"><b class="danger">${fmt(items.filter(item => consumableDecision(item).label === 'Comprar').length)}</b><span>Itens para comprar</span></div><div class="summary-box"><b>${fmt(items.filter(item => consumableDecision(item).label === 'Follow-up' || consumableHasOverdueOrder(item)).length)}</b><span>Itens em Follow-up</span></div></div><div class="panel"><div class="panel-body"><div class="toolbar"><input class="input" id="consumables-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="consumables-stock-status"><option value="all">Status do estoque: todos</option><option value="OK">OK</option><option value="Comprar">Comprar</option></select><select class="select" id="consumables-max-status"><option value="all">Status do máximo: todos</option><option value="ok">Dentro do máximo</option><option value="above">Acima do máximo</option></select><select class="select" id="consumables-followup"><option value="all">Pedidos: todos (${fmt(items.length)})</option><option value="order">Com pedido (${fmt(items.filter(consumableHasOrder).length)})</option><option value="overdue">Com atraso / follow-up (${fmt(items.filter(consumableHasOverdueOrder).length)})</option><option value="none">Sem pedido (${fmt(items.filter(item => !consumableHasOrder(item)).length)})</option></select></div><div class="table-wrap"><table class="data-table consumables-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Última movimentação</th><th>Qtd. compra</th><th>Mínimo</th><th>Máximo</th><th>Status M</th><th>Status N</th><th>Pedido</th><th>Follow-up</th><th>Decisão</th><th>Processo de compra</th></tr></thead><tbody id="consumables-table-body">${consumableRows(items)}</tbody></table></div></div></div>`;
}

// Mostra os itens escolhidos e permite exportar o conjunto para Excel.
function renderPurchaseProcessPage() {
  const rows = PURCHASE_PROCESS.map(entry => `<tr><td>${esc(entry.code)}</td><td><div class="desc" title="${esc(entry.description)}">${esc(entry.description)}</div></td><td>${fmt(entry.quantity)}</td><td>${esc(entry.source)}</td><td><button class="remove-purchase-btn" data-purchase-remove="${esc(entry.key)}" title="Remover do Processo de compra">Remover</button></td></tr>`).join('');
  return `<div class="view-title"><div><h2>Processo de compra</h2><p>Itens selecionados para compra, reunidos numa única lista para exportação.</p></div><div class="toolbar purchase-actions"><button class="primary-btn" id="export-purchase-process" ${PURCHASE_PROCESS.length ? '' : 'disabled'}>Exportar para Excel</button><button class="secondary-btn" id="clear-purchase-process" ${PURCHASE_PROCESS.length ? '' : 'disabled'}>Limpar lista</button></div></div><div class="summary-strip"><div class="summary-box"><b>${fmt(PURCHASE_PROCESS.length)}</b><span>Itens selecionados</span></div><div class="summary-box"><b>${fmt(PURCHASE_PROCESS.reduce((sum, entry) => sum + n(entry.quantity), 0))}</b><span>Quantidade total de compra</span></div><div class="summary-box"><b>${fmt(PURCHASE_PROCESS.filter(entry => entry.source === 'Consumível').length)}</b><span>Consumíveis selecionados</span></div></div><div class="panel"><div class="panel-header"><h3>Lista para exportação</h3><span>Dados incluídos: código, descrição e quantidade</span></div><div class="table-wrap"><table class="data-table purchase-process-table"><thead><tr><th>Código</th><th>Descrição</th><th>Quantidade de compra</th><th>Origem</th><th>Ação</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">Nenhum item foi adicionado. Use o sinal + nas tabelas.</td></tr>'}</tbody></table></div></div>`;
}

function setSpecializedLoadMore(kind, total, visible, rerender) {
  const target = document.querySelector(`#${kind}-load-more`);
  if (!target) return;
  specializedCounts[kind] = total;
  target.innerHTML = visible < total
    ? `<button class="secondary-btn load-more-specialized" id="${kind}-load-more-btn">Carregar mais (${fmt(Math.min(SPECIALIZED_PAGE_SIZE, total - visible))})</button><span>Mostrando ${fmt(visible)} de ${fmt(total)} itens</span>`
    : `<span>Todos os ${fmt(total)} itens carregados</span>`;
  const button = target.querySelector('button');
  if (button) button.onclick = () => { specializedLimits[kind] += SPECIALIZED_PAGE_SIZE; rerender(); };
}

function specializedOrderInfo(item) {
  const source = itemByCode(item.code) || item;
  const entries = Object.entries(source.orders || {}).filter(([, value]) => n(value) > 0);
  const total = entries.reduce((sum, [, value]) => sum + n(value), 0);
  const months = entries.map(([label]) => label.replace(/^PED\s*/i, '')).join(', ');
  return { total, months, label: total > 0 ? `Sim · ${fmt(total)} ${item.unit || 'UN'}` : 'Não há pedido' };
}

function pinSimulationStatus(stock, required, hasOrder = false) {
  return availabilityStatus(stock, required, hasOrder);
}

function pinSimulationRows(items, model, cars, query = '', statusFilter = 'all', selectedStockFilter = 'all') {
  const rows = items.map(item => {
    const unitNeed = n(item.modelNeeds?.[model]);
    const required = unitNeed * cars;
    const balance = n(item.stock) - required;
    const [status, color] = pinSimulationStatus(n(item.stock), required, Object.values(item.orders || {}).some(value => n(value) > 0));
    return { ...item, unitNeed, required, balance, status, color };
  }).filter(item => item.unitNeed > 0).filter(item => {
    const searchable = `${item.code} ${item.description}`.toLowerCase();
    const stockOk = selectedStockFilter === 'all' || (selectedStockFilter === 'zero' && n(item.stock) === 0) || (selectedStockFilter === 'positive' && n(item.stock) > 0);
    return searchable.includes(query.trim().toLowerCase()) && (statusFilter === 'all' || item.status === statusFilter) && stockOk;
  });
  specializedCounts['pins'] = rows.length;
  const visibleRows = rows.slice(0, specializedLimits['pins']);
  return visibleRows.map(item => `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}" title="Abrir detalhe do material">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${fmt(item.stock)} ${esc(item.unit || 'UN')}</td><td class="movement-date">${esc(movementDate(item.lastMovement))}</td><td class="specialized-order-cell" title="${esc(specializedOrderInfo(item).months || 'Sem pedidos em aberto')}">${esc(specializedOrderInfo(item).label)}</td><td>${fmt(item.unitNeed)} ${esc(item.unit || 'UN')}</td><td>${fmt(cars)}</td><td><strong>${fmt(item.required)} ${esc(item.unit || 'UN')}</strong></td><td class="${item.balance < 0 ? 'danger-text' : ''}">${fmt(item.balance)} ${esc(item.unit || 'UN')}</td><td><span class="status ${item.color}">${item.status}</span></td></tr>`).join('');
}

function matchesStockFilterValue(item, selectedFilter) {
  if (selectedFilter === 'zero') return n(item.stock) === 0;
  if (selectedFilter === 'positive') return n(item.stock) > 0;
  return true;
}

function renderPinSimulation() {
  const model = selectedPinModel || PINS.models?.[0] || '';
  const cars = Math.max(1, n(pinCars));
  const query = $('#pins-search')?.value || '';
  const statusFilter = $('#pins-coverage')?.value || 'all';
  const selectedStockFilter = $('#pins-stock-filter')?.value || 'all';
  const simulated = (PINS.items || []).map(item => ({ ...item, required: n(item.modelNeeds?.[model]) * cars })).filter(item => n(item.required) > 0).filter(item => matchesStockFilterValue(item, selectedStockFilter));
  const critical = simulated.filter(item => pinSimulationStatus(n(item.stock), item.required, Object.values(item.orders || {}).some(value => n(value) > 0))[0] === 'Crítico').length;
  const attention = simulated.filter(item => pinSimulationStatus(n(item.stock), item.required, Object.values(item.orders || {}).some(value => n(value) > 0))[0] === 'Em atenção').length;
  const regular = simulated.length - critical - attention;
  const totalRequired = simulated.reduce((sum, item) => sum + item.required, 0);
  const totalStock = simulated.reduce((sum, item) => sum + n(item.stock), 0);
  const body = $('#pins-table-body');
  if (body) body.innerHTML = pinSimulationRows(PINS.items || [], model, cars, query, statusFilter, selectedStockFilter) || `<tr><td colspan="9" class="empty">Nenhum pino corresponde aos filtros.</td></tr>`;
  setSpecializedLoadMore('pins', specializedCounts.pins, Math.min(specializedCounts.pins, specializedLimits.pins), renderPinSimulation);
  bindMaterialButtons();
  const result = $('#pins-result');
  if (result) result.innerHTML = `<div class="pins-result-head"><div><span class="eyebrow">Simulação ativa</span><h3>${esc(model)} · ${fmt(cars)} máquina${cars === 1 ? '' : 's'}</h3><p>A necessidade unitária de cada pino foi multiplicada pela quantidade planejada.</p></div><div class="pins-result-total"><span>Necessidade total</span><strong>${fmt(totalRequired)}</strong><small>Estoque nos pinos utilizados: ${fmt(totalStock)}</small></div></div><div class="pins-result-summary"><div><b class="danger">${fmt(critical)}</b><span>Críticos</span></div><div><b class="attention-number">${fmt(attention)}</b><span>Em atenção</span></div><div><b class="success-number">${fmt(regular)}</b><span>Regulares</span></div><div><b>${fmt(simulated.length)}</b><span>Pinos utilizados</span></div></div>`;
}

let pinsSubView = 'simulation';

function pinsNiguriNormalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pinsNiguriPlanModels(model) {
  const annual = DATA?.planAnnual?.models || {};
  if (Object.keys(annual).length) {
    const selected = model && model !== 'Todos os modelos' ? [model] : (PINS.models || Object.keys(annual));
    return selected.map(name => ({ modelo: name, quantidades: annual[name] || {} })).filter(entry => Object.values(entry.quantidades).some(value => n(value) > 0));
  }
  const all = DATA?.planMonth?.models || [];
  if (!model || model === 'Todos os modelos') return all;
  const target = pinsNiguriNormalize(model);
  const aliases = {
    '13lddi': ['13'],
    '13ldi': ['13'],
    '18lddi': ['18'],
    'guin16t': ['guindaste16'],
    'guin25t': ['guindaste25', 'guindate25'],
    'guin45': ['guindaste45'],
    'guin25': ['guindaste25', 'guindate25'],
    '10s': ['10s'],
    '10l': ['10l']
  };
  const candidates = [target, ...(aliases[target] || [])];
  return all.filter(entry => {
    const name = pinsNiguriNormalize(entry.modelo);
    return candidates.some(candidate => name === candidate || name.includes(candidate) || candidate.includes(name));
  });
}

function pinsNiguriMonthSlots(month, year) {
  const first = new Date(year, month - 1, 1);
  const next = new Date(year, month, 1);
  const slots = [];
  const seen = new Set();
  for (let day = new Date(first); day < next; day.setDate(day.getDate() + 1)) {
    const monday = new Date(day);
    const weekday = monday.getDay() || 7;
    monday.setDate(monday.getDate() - weekday + 1);
    const key = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
    if (!seen.has(key)) {
      seen.add(key);
      const isoWeek = String(getWeekNumber(monday)).padStart(2, '0');
      slots.push({ key, label: `S${isoWeek}`, month: String(month).padStart(2, '0'), year: String(year), quantity: 0, consumption: 0, receipts: 0 });
    }
  }
  return slots;
}

function getWeekNumber(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
}

function pinsNiguriCurrentWeekKey(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = monday.getDay() || 7;
  monday.setDate(monday.getDate() - weekday + 1);
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
}

function pinsNiguriWeekDate(key) {
  const match = String(key || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

function pinsNiguriIsoWeekMonday(year, week) {
  const monday = new Date(Number(year), 0, 4);
  const weekday = monday.getDay() || 7;
  monday.setDate(monday.getDate() - weekday + 1 + (Number(week) - 1) * 7);
  return monday;
}

function pinsNiguriTimeline(model, requestedStartKey = '') {
  const now = new Date();
  const year = now.getFullYear();
  const weeklySource = Array.isArray(PINS?.weeks) && PINS.weeks.length > 0;
  if (weeklySource) {
    const sourceYear = Number(PINS.weekYear) || year;
    const selectedModels = model && model !== 'Todos os modelos' ? [model] : (PINS.models || []);
    const allSlots = PINS.weeks.map(week => {
      const monday = pinsNiguriIsoWeekMonday(sourceYear, week);
      const key = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
      return { key, label: `S${String(week).padStart(2, '0')}`, week: Number(week), month: String(monday.getMonth() + 1).padStart(2, '0'), year: String(monday.getFullYear()), quantity: selectedModels.reduce((sum, name) => sum + n(PINS.weeklyTotals?.[name]?.[`S${week}`]), 0), consumption: 0, receipts: 0 };
    });
    const currentKey = pinsNiguriCurrentWeekKey(now);
    const requestedKey = requestedStartKey || pinsNiguriStartWeek || (allSlots.some(slot => slot.key === currentKey) ? currentKey : allSlots[0]?.key);
    const requestedDate = pinsNiguriWeekDate(requestedKey) || pinsNiguriWeekDate(allSlots[0]?.key);
    const currentDate = pinsNiguriWeekDate(currentKey);
    const calculationStartKey = requestedDate && currentDate && requestedDate > currentDate ? currentKey : requestedKey;
    const calculationStartDate = pinsNiguriWeekDate(calculationStartKey) || requestedDate;
    const slots = allSlots.filter(slot => pinsNiguriWeekDate(slot.key) >= requestedDate);
    const calculationSlots = allSlots.filter(slot => pinsNiguriWeekDate(slot.key) >= calculationStartDate);
    return { slots, allSlots, calculationSlots, planModels: selectedModels.map(name => ({ modelo: name, quantidades: {} })), selectedMonths: [], currentKey, startKey: requestedKey, calculationStartKey, weeklySource: true };
  }
  const startMonth = now.getMonth() + 1;
  const planModels = pinsNiguriPlanModels(model);
  const annualMonths = [...new Set(planModels.flatMap(entry => Object.keys(entry.quantidades || {}).filter(key => key.includes('/'))))]
    .filter(key => Number(key.split('/')[1]) === year && Number(key.split('/')[0]) >= startMonth)
    .sort((a, b) => Number(a.split('/')[0]) - Number(b.split('/')[0]));
  const selectedMonths = annualMonths.length
    ? annualMonths.map(key => key.split('/')[0])
    : (DATA?.planMonth?.months || []).map(value => String(value).padStart(2, '0')).filter(month => Number(month) >= startMonth);
  const seenWeeks = new Set();
  const allSlots = selectedMonths.flatMap(month => pinsNiguriMonthSlots(Number(month), year)).filter(slot => {
    if (seenWeeks.has(slot.key)) return false;
    seenWeeks.add(slot.key);
    return true;
  });
  const quantitiesByMonth = {};
  selectedMonths.forEach(month => {
    const annualKey = `${month}/${year}`;
    quantitiesByMonth[month] = planModels.reduce((sum, entry) => sum + n(entry.quantidades?.[annualKey] ?? entry.quantidades?.[month]), 0);
  });
  selectedMonths.forEach(month => {
    const monthSlots = allSlots.filter(slot => slot.month === month);
    const total = quantitiesByMonth[month] || 0;
    const base = monthSlots.length ? Math.floor(total / monthSlots.length) : 0;
    let remainder = monthSlots.length ? total % monthSlots.length : 0;
    monthSlots.forEach(slot => { slot.quantity = base + (remainder-- > 0 ? 1 : 0); });
  });
  const currentKey = pinsNiguriCurrentWeekKey(now);
  const requestedKey = requestedStartKey || pinsNiguriStartWeek || currentKey;
  const requestedDate = pinsNiguriWeekDate(requestedKey) || pinsNiguriWeekDate(currentKey);
  const currentDate = pinsNiguriWeekDate(currentKey);
  const calculationStartKey = requestedDate && currentDate && requestedDate > currentDate ? currentKey : requestedKey;
  const calculationStartDate = pinsNiguriWeekDate(calculationStartKey) || currentDate;
  const slots = allSlots.filter(slot => {
    const slotDate = pinsNiguriWeekDate(slot.key);
    return slotDate && requestedDate && slotDate >= requestedDate;
  });
  const calculationSlots = allSlots.filter(slot => {
    const slotDate = pinsNiguriWeekDate(slot.key);
    return slotDate && calculationStartDate && slotDate >= calculationStartDate;
  });
  return { slots, allSlots, calculationSlots, planModels, selectedMonths, currentKey, startKey: requestedKey, calculationStartKey };
}

function pinsNiguriWeekKey(value) {
  const raw = String(value || '').slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
function pinsNiguriOrders(item, slot, timelineSlots = []) {
  const source = itemByCode(item.code) || item;
  const monthSlots = timelineSlots.filter(candidate => candidate.month === slot.month && candidate.year === slot.year);
  const firstMonthSlot = monthSlots[0]?.key === slot.key;
  const exactEntries = Array.isArray(source.obtention)
    ? source.obtention.filter(entry => String(entry.plannedDate || '').startsWith(`${slot.year}-${slot.month}-`))
    : [];
  const exact = exactEntries
    .filter(entry => pinsNiguriWeekKey(entry.plannedDate) === slot.key)
    .reduce((sum, entry) => sum + n(entry.quantity), 0);
  if (exact > 0) return exact;
  // Sem data exata, o pedido mensal entra uma única vez na primeira semana.
  // Antes, o mesmo recebimento era repetido em todas as semanas do mês.
  if (exactEntries.length > 0 || !firstMonthSlot) return 0;
  const key = `PED ${slot.month}/${slot.year}`;
  return n(source.orders?.[key]);
}

function pinsNiguriWeeklyConsumption(item, model, slot) {
  if (!slot?.week || !item?.weeklyDemand) return null;
  const models = model === 'Todos os modelos' ? (PINS.models || []) : [model];
  return models.reduce((sum, name) => sum + n(item.weeklyDemand?.[name]?.[`S${slot.week}`]), 0);
}

function pinsNiguriRows(model, query = '', statusFilter = 'all') {
  const timeline = pinsNiguriTimeline(model, pinsNiguriStartWeek);
  const rows = (PINS.items || []).map(item => {
    const modelNeed = model === 'Todos os modelos'
      ? timeline.planModels.reduce((sum, entry) => sum + n(item.modelNeeds?.[entry.modelo]), 0)
      : n(item.modelNeeds?.[model]);
    if (modelNeed <= 0) return null;
    let balance = n(itemByCode(item.code)?.stock ?? item.stock);
    const balances = [];
    let totalNeed = 0;
    const visibleKeys = new Set(timeline.slots.map(slot => slot.key));
    timeline.calculationSlots.forEach(slot => {
      const weeklyConsumption = timeline.weeklySource ? pinsNiguriWeeklyConsumption(item, model, slot) : null;
      const consumption = weeklyConsumption === null ? modelNeed * slot.quantity : weeklyConsumption;
      const receipt = pinsNiguriOrders(item, slot, timeline.calculationSlots);
      balance = balance - consumption + receipt;
      if (visibleKeys.has(slot.key)) {
        totalNeed += consumption;
        balances.push({ ...slot, consumption, receipts: receipt, balance });
      }
    });
    const firstShortage = balances.find(slot => slot.balance < 0);
    const status = firstShortage ? 'Crítico' : balances.some(slot => slot.balance <= n(item.safety)) ? 'Em atenção' : 'Regular';
    return { ...item, stock: n(itemByCode(item.code)?.stock ?? item.stock), modelNeed, totalNeed, balances, firstShortage, status, planModels: timeline.planModels };
  }).filter(Boolean).filter(item => {
    const text = `${item.code} ${item.description}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (statusFilter === 'all' || item.status === statusFilter);
  });
  return { rows, timeline };
}

function pinsNiguriView() {
  const model = selectedPinModel || PINS.models?.[0] || 'Todos os modelos';
  const query = $('#pins-niguri-search')?.value || '';
  const statusFilter = $('#pins-niguri-status')?.value || 'all';
  const { rows, timeline } = pinsNiguriRows(model, query, statusFilter);
  const totalNeed = rows.reduce((sum, item) => sum + item.totalNeed, 0);
  const critical = rows.filter(item => item.status === 'Crítico').length;
  const attention = rows.filter(item => item.status === 'Em atenção').length;
  const firstWeek = rows.filter(item => item.firstShortage).sort((a,b) => a.firstShortage.key.localeCompare(b.firstShortage.key))[0]?.firstShortage?.label || '—';
  const weekHeaders = timeline.slots.map(slot => `<th title="${esc(slot.month)}/${esc(slot.year)} · ${fmt(slot.quantity)} máquinas planejadas">${esc(slot.label)}<small>${esc(slot.month)}/${esc(slot.year)}</small></th>`).join('');
  const rowHtml = rows.slice(0, 250).map(item => `<tr><td><button class="material-code specialized-material-code niguri-pin-code" data-code="${esc(item.code)}" data-pin-model="${esc(model)}">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${fmt(item.stock)} ${esc(item.unit || 'UN')}</td><td><strong>${fmt(item.totalNeed)} ${esc(item.unit || 'UN')}</strong></td><td>${item.firstShortage ? `<span class="status red">${esc(item.firstShortage.label)}</span>` : '<span class="status green">Sem falta</span>'}</td>${item.balances.map(cell => { const color = cell.balance < 0 ? 'danger' : cell.receipts > 0 ? 'receipt' : cell.balance <= n(item.safety) ? 'attention' : 'good'; return `<td class="niguri-cell ${color}" title="Consumo: ${fmt(cell.consumption)} · Recebimento: ${fmt(cell.receipts)}">${fmt(cell.balance)}</td>`; }).join('')}</tr>`).join('');
  const weekOptions = timeline.allSlots.map(slot => `<option value="${esc(slot.key)}" ${slot.key === timeline.startKey ? 'selected' : ''}>${esc(slot.label)} · ${esc(slot.month)}/${esc(slot.year)}</option>`).join('');
  return `<div class="pins-page pins-niguri-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado · linha do tempo</span><h2>NIGIRI dos Pinos</h2><p>Saldo projetado por semana usando a necessidade oficial da aba PinosAnual, de S41 a S52, e os recebimentos dos pedidos.</p></div><div class="date-pill">Fonte: PinosAnual · S41 a S52</div></div><div class="panel pins-niguri-controls"><label>Modelo analisado<select class="select" id="pins-niguri-model"><option>Todos os modelos</option>${PINS.models.map(entry => `<option value="${esc(entry)}" ${entry === model ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></label><label>Semana inicial<select class="select" id="pins-niguri-start-week">${weekOptions}</select></label><label>Pesquisar<input class="input" id="pins-niguri-search" placeholder="Código ou descrição" /></label><label>Situação<select class="select" id="pins-niguri-status"><option value="all">Todos</option><option value="Crítico">Com falta prevista</option><option value="Em atenção">Atenção</option><option value="Regular">Regulares</option></select></label></div><div class="pins-niguri-note"><strong>Leitura da projeção:</strong> escolha qualquer semana entre S41 e S52 para iniciar a visualização. O recebimento entra na semana prevista; essa quantidade fica disponível para o consumo das semanas seguintes. Verde = saldo suficiente, amarelo = recebimento na semana ou saldo próximo do limite, vermelho = saldo negativo.</div><div class="pins-result-panel panel"><div class="pins-result-head"><div><span class="eyebrow">Necessidade consolidada até 31/12</span><h3>${esc(model)}</h3><p>${fmt(rows.length)} pinos utilizados · início em ${esc(timeline.slots[0]?.label || '—')} · primeira falta identificada: ${esc(firstWeek)}</p></div><div class="pins-result-total"><span>Necessidade total</span><strong>${fmt(totalNeed)}</strong><small>Críticos: ${fmt(critical)} · Atenção: ${fmt(attention)}</small></div></div></div><div class="panel pins-panel"><div class="panel-header"><div><h3>Saldo acumulado por semana</h3><span>Verde: disponível · amarelo: recebimento/próximo do limite · vermelho: falta prevista</span></div><span class="pins-legend"><i></i>${fmt(timeline.slots.length)} semanas projetadas</span></div><div class="table-wrap pins-niguri-table-wrap"><table class="data-table pins-table pins-niguri-table"><thead><tr><th>Código / descrição</th><th>Estoque inicial</th><th>Necessidade até dez.</th><th>Primeira falta</th>${weekHeaders}</tr></thead><tbody>${rowHtml || '<tr><td colspan="8" class="empty">Nenhum pino corresponde aos filtros.</td></tr>'}</tbody></table></div></div></div>`;
}

function pinsView() {
  const active = pinsSubView === 'niguri' ? 'niguri' : 'simulation';
  const content = active === 'niguri' ? pinsNiguriView() : pinsSimulationView();
  return `<div class="pins-page"><div class="pins-subnav"><button class="pins-subtab ${active === 'simulation' ? 'active' : ''}" data-pins-subview="simulation">Pinos por modelo</button><button class="pins-subtab ${active === 'niguri' ? 'active' : ''}" data-pins-subview="niguri">NIGURI dos pinos</button></div>${content}</div>`;
}

function modelNiguriNormalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function modelNiguriStructureName(model) {
  const structures = Object.keys(DATA?.models || {});
  const aliases = { '13ldi': '13ldi-46kv', '13lddi': '13-69kv' };
  const preferred = aliases[modelNiguriNormalize(model)] || model;
  return structures.find(name => modelNiguriNormalize(name) === modelNiguriNormalize(preferred))
    || structures.find(name => modelNiguriNormalize(name).includes(modelNiguriNormalize(model)))
    || structures.find(name => modelNiguriNormalize(model).includes(modelNiguriNormalize(name))) || '';
}
function modelNiguriStructureRows(model) {
  const structureName = modelNiguriStructureName(model);
  const base = new Map((DATA?.items || []).map(item => [String(item.code), item]));
  return (DATA?.models?.[structureName] || []).map(entry => {
    const code = String(entry.code || '').trim();
    if (!/^\d{2}(?:\.\d{2}){2}\.\d{10}$/.test(code)) return null;
    const source = base.get(code) || {};
    const quantity = n(entry.quantity);
    if (quantity <= 0) return null;
    return { ...source, code, description: source.description || entry.description || code, quantity, unit: source.unit || 'UN', stock: n(source.stock ?? entry.stock), analyst: source.analyst || 'Não informado', safety: n(source.safety), orders: source.orders || {}, lastMovement: source.lastMovement || 'não tem' };
  }).filter(Boolean);
}
function modelNiguriPlanEntries(model) {
  const annual = DATA?.planAnnual?.models || {};
  const quantities = annual[model] || {};
  return [{ modelo: model, quantidades: quantities }];
}
function modelNiguriTimeline(model) {
  const entries = modelNiguriPlanEntries(model);
  const now = new Date();
  const currentPeriod = now.getFullYear() * 100 + now.getMonth() + 1;
  const periods = [...new Set(Object.keys(entries[0]?.quantidades || {}).filter(key => /^(\d{2})\/\d{4}$/.test(key)).filter(key => { const [month, year] = key.split('/').map(Number); return year * 100 + month >= currentPeriod; }))].sort((a,b) => { const [am, ay] = a.split('/').map(Number); const [bm, by] = b.split('/').map(Number); return (ay * 100 + am) - (by * 100 + bm); });
  const allSlots = periods.flatMap(key => { const [month, year] = key.split('/').map(Number); return pinsNiguriMonthSlots(month, year); });
  const seen = new Set();
  const unique = allSlots.filter(slot => !seen.has(slot.key) && seen.add(slot.key));
  const quantitiesByPeriod = Object.fromEntries(periods.map(key => [key, n(entries[0]?.quantidades?.[key])]));
  periods.forEach(key => { const [month, year] = key.split('/').map(Number); const monthSlots = unique.filter(slot => Number(slot.month) === month && Number(slot.year) === year); let remainder = monthSlots.length ? quantitiesByPeriod[key] % monthSlots.length : 0; const base = monthSlots.length ? Math.floor(quantitiesByPeriod[key] / monthSlots.length) : 0; monthSlots.forEach(slot => { slot.quantity = base + (remainder-- > 0 ? 1 : 0); }); });
  const currentKey = pinsNiguriCurrentWeekKey(new Date());
  const startKey = modelNiguriStartWeek || currentKey;
  const startDate = pinsNiguriWeekDate(startKey) || pinsNiguriWeekDate(currentKey);
  const currentDate = pinsNiguriWeekDate(currentKey);
  const calcDate = startDate && currentDate && startDate > currentDate ? currentDate : startDate;
  const calculationSlots = unique.filter(slot => pinsNiguriWeekDate(slot.key) >= calcDate);
  const slots = unique.filter(slot => pinsNiguriWeekDate(slot.key) >= startDate);
  return { slots, allSlots: unique, calculationSlots, startKey, currentKey, model, structureName: modelNiguriStructureName(model) };
}
function modelNiguriRows(model, analyst = 'all', query = '', statusFilter = 'all') {
  const timeline = modelNiguriTimeline(model);
  const visible = new Set(timeline.slots.map(slot => slot.key));
  const rows = modelNiguriStructureRows(model).map(item => {
    let balance = n(item.stock); const balances = []; let totalNeed = 0;
    timeline.calculationSlots.forEach(slot => { const consumption = item.quantity * slot.quantity; const receipt = pinsNiguriOrders(item, slot, timeline.calculationSlots); balance = balance - consumption + receipt; if (visible.has(slot.key)) { totalNeed += consumption; balances.push({ ...slot, consumption, receipts: receipt, balance }); } });
    const firstShortage = balances.find(slot => slot.balance < 0);
    const status = firstShortage ? 'Crítico' : balances.some(slot => slot.balance <= n(item.safety)) ? 'Em atenção' : totalNeed > 0 ? 'Regular' : 'Regular';
    return { ...item, totalNeed, balances, firstShortage, status };
  }).filter(item => (analyst === 'all' || item.analyst === analyst) && `${item.code} ${item.description}`.toLowerCase().includes(String(query).trim().toLowerCase()) && (statusFilter === 'all' || item.status === statusFilter));
  return { rows, timeline };
}
function modelNiguriView() {
  const models = Object.keys(DATA?.planAnnual?.models || {});
  const model = modelNiguriModel || models[0] || '';
  const analysts = [...new Set((DATA?.items || []).map(item => item.analyst).filter(Boolean))].sort();
  const query = $('#model-niguri-search')?.value || ''; const status = $('#model-niguri-status')?.value || 'all';
  const analyst = modelNiguriAnalyst || 'all'; const { rows, timeline } = modelNiguriRows(model, analyst, query, status);
  const headers = timeline.slots.map(slot => `<th title="${esc(slot.month)}/${esc(slot.year)} · ${fmt(slot.quantity)} modelos planejados">${esc(slot.label)}<small>${esc(slot.month)}/${esc(slot.year)}</small></th>`).join('');
  const body = rows.slice(0, 250).map(item => `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${esc(item.analyst)}</td><td>${fmt(item.stock)} ${esc(item.unit)}</td><td>${fmt(item.quantity)} ${esc(item.unit)}</td><td><strong>${fmt(item.totalNeed)} ${esc(item.unit)}</strong></td><td>${item.firstShortage ? `<span class="status red">${esc(item.firstShortage.label)}</span>` : '<span class="status green">Sem falta</span>'}</td>${item.balances.map(cell => { const color = cell.balance < 0 ? 'danger' : cell.receipts > 0 ? 'receipt' : cell.balance <= n(item.safety) ? 'attention' : 'good'; return `<td class="niguri-cell ${color}" title="Consumo: ${fmt(cell.consumption)} · Recebimento: ${fmt(cell.receipts)}">${fmt(cell.balance)}</td>`; }).join('')}</tr>`).join('');
  const options = timeline.allSlots.map(slot => `<option value="${esc(slot.key)}" ${slot.key === timeline.startKey ? 'selected' : ''}>${esc(slot.label)} · ${esc(slot.month)}/${esc(slot.year)}</option>`).join('');
  return `<div class="pins-page pins-niguri-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado · estrutura completa</span><h2>NIGURI dos modelos</h2><p>Todos os itens da estrutura do modelo, cruzados com estoque, pedidos e o planoAnual.</p></div><div class="date-pill">Estrutura: ${esc(timeline.structureName || 'não encontrada')}</div></div><div class="panel pins-niguri-controls"><label>Modelo<select class="select" id="model-niguri-model">${models.map(entry => `<option value="${esc(entry)}" ${entry === model ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></label><label>Semana inicial<select class="select" id="model-niguri-start-week">${options}</select></label><label>Analista<select class="select" id="model-niguri-analyst"><option value="all">Todos os analistas</option>${analysts.map(entry => `<option value="${esc(entry)}" ${entry === analyst ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></label><label>Pesquisar<input class="input" id="model-niguri-search" placeholder="Código ou descrição" /></label><label>Situação<select class="select" id="model-niguri-status"><option value="all">Todas</option><option value="Crítico">Críticos</option><option value="Em atenção">Atenção</option><option value="Regular">Regulares</option></select></label></div><div class="pins-niguri-note"><strong>Regra:</strong> o consumo semanal é a quantidade do item na estrutura multiplicada pelos modelos do planoAnual. Recebimentos entram na semana prevista e permanecem no saldo acumulado das semanas seguintes.</div><div class="panel pins-panel"><div class="panel-header"><div><h3>Itens da estrutura · ${esc(model)}</h3><span>${fmt(rows.length)} itens encontrados · ${fmt(timeline.slots.length)} semanas projetadas</span></div><span class="pins-legend"><i></i> Verde: saldo · amarelo: recebimento/limite · vermelho: falta</span></div><div class="table-wrap pins-niguri-table-wrap"><table class="data-table pins-table pins-niguri-table"><thead><tr><th>Código / descrição</th><th>Analista</th><th>Estoque</th><th>Qtd./modelo</th><th>Necessidade até dez.</th><th>Primeira falta</th>${headers}</tr></thead><tbody>${body || '<tr><td colspan="8" class="empty">Nenhum item corresponde aos filtros.</td></tr>'}</tbody></table></div></div></div>`;
}

function pinsSimulationView() {
  const items = PINS.items || [];
  const models = PINS.models || [];
  const activeModel = selectedPinModel || models[0] || '';
  return `<div class="pins-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado</span><h2></h2><p></p></div><div class="date-pill">${esc(PINS.sourceFile || 'Aba Pinos')}</div></div><div class="pins-model-strip">${models.map(model => `<button class="pins-model-card${model === activeModel ? ' selected' : ''}" data-pin-model="${esc(model)}"><span>Pinos</span><strong>${esc(model)}</strong><small>${model === activeModel ? 'modelo selecionado' : 'selecionar modelo'}</small></button>`).join('')}</div><div class="panel pins-config-panel"><div class="pins-config-copy"><span class="eyebrow">Configuração da produção</span><h3>Quantas máquinas ${esc(activeModel)} serão produzidas?</h3><p>A quantidade planejada multiplica a necessidade unitária informada na aba Pinos.</p></div><div class="pins-config-controls"><label for="pins-cars">Quantidade de máquinas</label><div class="pins-cars-control"><input class="input" id="pins-cars" type="number" min="1" step="1" value="${fmt(Math.max(1, n(pinCars)))}" /><button class="primary-btn" id="run-pins-simulation">Calcular necessidade</button></div></div></div><div id="pins-result" class="panel pins-result-panel"></div><div class="panel pins-panel"><div class="panel-header"><div><h3>Detalhamento dos pinos · ${esc(activeModel)}</h3><span>${fmt(items.length)} códigos disponíveis na aba Pinos</span></div><span class="pins-legend"><i></i> Estoque insuficiente para o plano</span></div><div class="panel-body"><div class="toolbar pins-toolbar"><input class="input" id="pins-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="pins-coverage"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regulares</option></select><select class="select" id="pins-stock-filter"><option value="all">Estoque: todos</option><option value="zero">Estoque igual a zero</option><option value="positive">Estoque maior que zero</option></select></div><div class="table-wrap pins-table-wrap"><table class="data-table pins-table pins-simulation-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Última movimentação</th><th>Pedido em aberto</th><th>Necessidade / máquina</th><th>Máquinas</th><th>Necessidade calculada</th><th>Saldo</th><th>Situação</th></tr></thead><tbody id="pins-table-body"></tbody></table></div><div class="table-footer specialized-load-more" id="pins-load-more"></div></div></div></div>`;
}

function cylinderSimulationRows(items, model, cars, query = '', statusFilter = 'all', selectedStockFilter = 'all') {
  const rows = items.map(item => {
    const unitNeed = n(item.modelNeeds?.[model]);
    const required = unitNeed * cars;
    const balance = n(item.stock) - required;
    const [status, color] = pinSimulationStatus(n(item.stock), required, Object.values(item.orders || {}).some(value => n(value) > 0));
    return { ...item, unitNeed, required, balance, status, color };
  }).filter(item => item.unitNeed > 0).filter(item => {
    const searchable = `${item.code} ${item.description}`.toLowerCase();
    const stockOk = selectedStockFilter === 'all' || (selectedStockFilter === 'zero' && n(item.stock) === 0) || (selectedStockFilter === 'positive' && n(item.stock) > 0);
    return searchable.includes(query.trim().toLowerCase()) && (statusFilter === 'all' || item.status === statusFilter) && stockOk;
  });
  specializedCounts['cylinders'] = rows.length;
  const visibleRows = rows.slice(0, specializedLimits['cylinders']);
  return visibleRows.map(item => `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}" title="Abrir detalhe do material">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${fmt(item.stock)} ${esc(item.unit || 'UN')}</td><td class="movement-date">${esc(movementDate(item.lastMovement))}</td><td class="specialized-order-cell" title="${esc(specializedOrderInfo(item).months || 'Sem pedidos em aberto')}">${esc(specializedOrderInfo(item).label)}</td><td>${fmt(item.unitNeed)} ${esc(item.unit || 'UN')}</td><td>${fmt(cars)}</td><td><strong>${fmt(item.required)} ${esc(item.unit || 'UN')}</strong></td><td class="${item.balance < 0 ? 'danger-text' : ''}">${fmt(item.balance)} ${esc(item.unit || 'UN')}</td><td><span class="status ${item.color}">${item.status}</span></td></tr>`).join('');
}

function renderCylinderSimulation() {
  const model = selectedCylinderModel || CYLINDERS.models?.[0] || '';
  const cars = Math.max(1, n(cylinderCars));
  const query = $('#cylinders-search')?.value || '';
  const statusFilter = $('#cylinders-coverage')?.value || 'all';
  const selectedStockFilter = $('#cylinders-stock-filter')?.value || 'all';
  const simulated = (CYLINDERS.items || []).map(item => ({ ...item, required: n(item.modelNeeds?.[model]) * cars })).filter(item => n(item.required) > 0).filter(item => matchesStockFilterValue(item, selectedStockFilter));
  const critical = simulated.filter(item => pinSimulationStatus(n(item.stock), item.required, Object.values(item.orders || {}).some(value => n(value) > 0))[0] === 'Crítico').length;
  const attention = simulated.filter(item => pinSimulationStatus(n(item.stock), item.required, Object.values(item.orders || {}).some(value => n(value) > 0))[0] === 'Em atenção').length;
  const regular = simulated.length - critical - attention;
  const totalRequired = simulated.reduce((sum, item) => sum + item.required, 0);
  const totalStock = simulated.reduce((sum, item) => sum + n(item.stock), 0);
  const body = $('#cylinders-table-body');
  if (body) body.innerHTML = cylinderSimulationRows(CYLINDERS.items || [], model, cars, query, statusFilter, selectedStockFilter) || `<tr><td colspan="9" class="empty">Nenhum cilindro corresponde aos filtros.</td></tr>`;
  setSpecializedLoadMore('cylinders', specializedCounts.cylinders, Math.min(specializedCounts.cylinders, specializedLimits.cylinders), renderCylinderSimulation);
  bindMaterialButtons();
  const result = $('#cylinders-result');
  if (result) result.innerHTML = `<div class="pins-result-head"><div><span class="eyebrow">Simulação ativa</span><h3>${esc(model)} · ${fmt(cars)} máquina${cars === 1 ? '' : 's'}</h3><p>A necessidade unitária de cada cilindro foi multiplicada pela quantidade planejada.</p></div><div class="pins-result-total"><span>Necessidade total</span><strong>${fmt(totalRequired)}</strong><small>Estoque nos cilindros utilizados: ${fmt(totalStock)}</small></div></div><div class="pins-result-summary"><div><b class="danger">${fmt(critical)}</b><span>Críticos</span></div><div><b class="attention-number">${fmt(attention)}</b><span>Em atenção</span></div><div><b class="success-number">${fmt(regular)}</b><span>Regulares</span></div><div><b>${fmt(simulated.length)}</b><span>Cilindros utilizados</span></div></div>`;
}

function cylindersView() {
  const items = CYLINDERS.items || [];
  const models = CYLINDERS.models || [];
  const activeModel = selectedCylinderModel || models[0] || '';
  const emptyMessage = models.length ? 'Adicione códigos e necessidades na aba cilindros da Explosão e regenere os dados.' : 'Nenhum modelo foi encontrado na aba cilindros.';
  return `<div class="pins-page cylinders-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado</span><h2></h2><p></p></div><div class="date-pill">${esc(CYLINDERS.sourceFile || 'Aba cilindros')}</div></div><div class="pins-model-strip">${models.map(model => `<button class="pins-model-card${model === activeModel ? ' selected' : ''}" data-cylinder-model="${esc(model)}"><span>Cilindros</span><strong>${esc(model)}</strong><small>${model === activeModel ? 'modelo selecionado' : 'selecionar modelo'}</small></button>`).join('')}</div><div class="panel pins-config-panel"><div class="pins-config-copy"><span class="eyebrow">Configuração da produção</span><h3>Quantas máquinas ${esc(activeModel || 'deste modelo')} serão produzidas?</h3><p>A quantidade planejada multiplica a necessidade unitária informada na aba cilindros.</p></div><div class="pins-config-controls"><label for="cylinders-cars">Quantidade de máquinas</label><div class="pins-cars-control"><input class="input" id="cylinders-cars" type="number" min="1" step="1" value="${fmt(Math.max(1, n(cylinderCars)))}" /><button class="primary-btn" id="run-cylinders-simulation">Calcular necessidade</button></div></div></div><div id="cylinders-result" class="panel pins-result-panel"></div><div class="panel pins-panel"><div class="panel-header"><div><h3>Detalhamento dos cilindros · ${esc(activeModel || '—')}</h3><span>${fmt(items.length)} códigos disponíveis na aba cilindros</span></div><span class="pins-legend"><i></i> Estoque insuficiente para o plano</span></div><div class="panel-body">${items.length ? `<div class="toolbar pins-toolbar"><input class="input" id="cylinders-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="cylinders-coverage"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regulares</option></select><select class="select" id="cylinders-stock-filter"><option value="all">Estoque: todos</option><option value="zero">Estoque igual a zero</option><option value="positive">Estoque maior que zero</option></select></div><div class="table-wrap pins-table-wrap"><table class="data-table pins-table pins-simulation-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Última movimentação</th><th>Pedido em aberto</th><th>Necessidade / máquina</th><th>Máquinas</th><th>Necessidade calculada</th><th>Saldo</th><th>Situação</th></tr></thead><tbody id="cylinders-table-body"></tbody></table></div><div class="table-footer specialized-load-more" id="cylinders-load-more"></div>` : `<div class="empty cylinders-empty">${emptyMessage}</div>`}</div></div></div>`;
}

function cabinSimulationRows(items, model, cars, query = '', statusFilter = 'all', selectedStockFilter = 'all') {
  const rows = items.map(item => {
    const unitNeed = n(item.modelNeeds?.[model]);
    const required = unitNeed * cars;
    const balance = n(item.stock) - required;
    const [status, color] = pinSimulationStatus(n(item.stock), required, Object.values(item.orders || {}).some(value => n(value) > 0));
    return { ...item, unitNeed, required, balance, status, color };
  }).filter(item => item.unitNeed > 0).filter(item => {
    const searchable = `${item.code} ${item.description}`.toLowerCase();
    const stockOk = selectedStockFilter === 'all' || (selectedStockFilter === 'zero' && n(item.stock) === 0) || (selectedStockFilter === 'positive' && n(item.stock) > 0);
    return searchable.includes(query.trim().toLowerCase()) && (statusFilter === 'all' || item.status === statusFilter) && stockOk;
  });
  specializedCounts['cabins'] = rows.length;
  const visibleRows = rows.slice(0, specializedLimits['cabins']);
  return visibleRows.map(item => `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}" title="Abrir detalhe do material">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${fmt(item.stock)} ${esc(item.unit || 'UN')}</td><td class="movement-date">${esc(movementDate(item.lastMovement))}</td><td class="specialized-order-cell" title="${esc(specializedOrderInfo(item).months || 'Sem pedidos em aberto')}">${esc(specializedOrderInfo(item).label)}</td><td>${fmt(item.unitNeed)} ${esc(item.unit || 'UN')}</td><td>${fmt(cars)}</td><td><strong>${fmt(item.required)} ${esc(item.unit || 'UN')}</strong></td><td class="${item.balance < 0 ? 'danger-text' : ''}">${fmt(item.balance)} ${esc(item.unit || 'UN')}</td><td><span class="status ${item.color}">${item.status}</span></td></tr>`).join('');
}

function renderCabinSimulation() {
  const model = selectedCabinModel || CABINS.models?.[0] || '';
  const cars = Math.max(1, n(cabinCars));
  const query = $('#cabins-search')?.value || '';
  const statusFilter = $('#cabins-coverage')?.value || 'all';
  const selectedStockFilter = $('#cabins-stock-filter')?.value || 'all';
  const simulated = (CABINS.items || []).map(item => ({ ...item, required: n(item.modelNeeds?.[model]) * cars })).filter(item => n(item.required) > 0).filter(item => matchesStockFilterValue(item, selectedStockFilter));
  const critical = simulated.filter(item => pinSimulationStatus(n(item.stock), item.required, Object.values(item.orders || {}).some(value => n(value) > 0))[0] === 'Crítico').length;
  const attention = simulated.filter(item => pinSimulationStatus(n(item.stock), item.required, Object.values(item.orders || {}).some(value => n(value) > 0))[0] === 'Em atenção').length;
  const regular = simulated.length - critical - attention;
  const totalRequired = simulated.reduce((sum, item) => sum + item.required, 0);
  const totalStock = simulated.reduce((sum, item) => sum + n(item.stock), 0);
  const body = $('#cabins-table-body');
  if (body) body.innerHTML = cabinSimulationRows(CABINS.items || [], model, cars, query, statusFilter, selectedStockFilter) || `<tr><td colspan="9" class="empty">Nenhuma cabine corresponde aos filtros.</td></tr>`;
  setSpecializedLoadMore('cabins', specializedCounts.cabins, Math.min(specializedCounts.cabins, specializedLimits.cabins), renderCabinSimulation);
  bindMaterialButtons();
  const result = $('#cabins-result');
  if (result) result.innerHTML = `<div class="pins-result-head"><div><span class="eyebrow">Simulação ativa</span><h3>${esc(model)} · ${fmt(cars)} máquina${cars === 1 ? '' : 's'}</h3><p>A necessidade unitária de cada cabine foi multiplicada pela quantidade planejada.</p></div><div class="pins-result-total"><span>Necessidade total</span><strong>${fmt(totalRequired)}</strong><small>Estoque nas cabines utilizadas: ${fmt(totalStock)}</small></div></div><div class="pins-result-summary"><div><b class="danger">${fmt(critical)}</b><span>Críticos</span></div><div><b class="attention-number">${fmt(attention)}</b><span>Em atenção</span></div><div><b class="success-number">${fmt(regular)}</b><span>Regulares</span></div><div><b>${fmt(simulated.length)}</b><span>Cabines utilizadas</span></div></div>`;
}

function cabinsView() {
  const items = CABINS.items || [];
  const models = CABINS.models || [];
  const activeModel = selectedCabinModel || models[0] || '';
  const emptyMessage = models.length ? 'Adicione códigos e necessidades na aba cabines da Explosão e regenere os dados.' : 'Nenhum modelo foi encontrado na aba cabines.';
  return `<div class="pins-page cabins-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado</span><h2></h2><p></p></div><div class="date-pill">${esc(CABINS.sourceFile || 'Aba cabines')}</div></div><div class="pins-model-strip">${models.map(model => `<button class="pins-model-card${model === activeModel ? ' selected' : ''}" data-cabin-model="${esc(model)}"><span>Cabines</span><strong>${esc(model)}</strong><small>${model === activeModel ? 'modelo selecionado' : 'selecionar modelo'}</small></button>`).join('')}</div><div class="panel pins-config-panel"><div class="pins-config-copy"><span class="eyebrow">Configuração da produção</span><h3>Quantas máquinas ${esc(activeModel || 'deste modelo')} serão produzidas?</h3><p>A quantidade planejada multiplica a necessidade unitária informada na aba cabines.</p></div><div class="pins-config-controls"><label for="cabins-cars">Quantidade de máquinas</label><div class="pins-cars-control"><input class="input" id="cabins-cars" type="number" min="1" step="1" value="${fmt(Math.max(1, n(cabinCars)))}" /><button class="primary-btn" id="run-cabins-simulation">Calcular necessidade</button></div></div></div><div id="cabins-result" class="panel pins-result-panel"></div><div class="panel pins-panel"><div class="panel-header"><div><h3>Detalhamento das cabines · ${esc(activeModel || '—')}</h3><span>${fmt(items.length)} códigos disponíveis na aba cabines</span></div><span class="pins-legend"><i></i> Estoque insuficiente para o plano</span></div><div class="panel-body">${items.length ? `<div class="toolbar pins-toolbar"><input class="input" id="cabins-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="cabins-coverage"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regulares</option></select><select class="select" id="cabins-stock-filter"><option value="all">Estoque: todos</option><option value="zero">Estoque igual a zero</option><option value="positive">Estoque maior que zero</option></select></div><div class="table-wrap pins-table-wrap"><table class="data-table pins-table pins-simulation-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Última movimentação</th><th>Pedido em aberto</th><th>Necessidade / máquina</th><th>Máquinas</th><th>Necessidade calculada</th><th>Saldo</th><th>Situação</th></tr></thead><tbody id="cabins-table-body"></tbody></table></div><div class="table-footer specialized-load-more" id="cabins-load-more"></div>` : `<div class="empty cabins-empty">${emptyMessage}</div>`}</div></div></div>`;
}

function sheetMetalStatus(item, cars = 1) {
  const required = n(item.minimum) * Math.max(1, cars);
  const base = itemByCode(item.code) || item;
  return availabilityStatus(item.stock, required, hasOpenOrder(base));
}
function exportCriticalItems(items, filename = 'itens-criticos.xls') {
  const rows = items.map(item => { const base = itemByCode(item.code) || item; const orders = Object.values(base.orders || {}).reduce((sum, v) => sum + n(v), 0); const dates = Object.entries(base.orders || {}).filter(([,v]) => n(v) > 0).map(([m]) => m).join(', '); return `<tr><td>${esc(item.code)}</td><td>${esc(item.description || base.description || '—')}</td><td>${fmt(item.stock)}</td><td>${fmt(item.plannedNeed || 0)}</td><td>${fmt(item.structureDemand || 0)}</td><td>${orders > 0 ? 'Sim' : 'Não'}</td><td>${esc(dates || '—')}</td></tr>`; }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table><thead><tr><th>Código do item</th><th>Descrição</th><th>Estoque</th><th>Necessidade programada</th><th>Demanda da estrutura</th><th>Tem pedido</th><th>Data prevista de chegada</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const url = URL.createObjectURL(new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel;charset=utf-8' })); const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function sheetMetalRows(items, model, cars, query='', statusFilter='all', stockFilter='all') {
  const rows = items.map(item => { const required=n(item.minimum)*Math.max(1,cars); const [status,color]=sheetMetalStatus(item,cars); return {...item,required,status,color,balance:n(item.stock)-required}; }).filter(item => item.modelNeeds?.[model] !== undefined).filter(item => `${item.code} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())).filter(item => statusFilter==='all'||item.status===statusFilter).filter(item => stockFilter==='all'||(stockFilter==='zero'&&n(item.stock)===0)||(stockFilter==='positive'&&n(item.stock)>0));
  specializedCounts.sheetMetal=rows.length; const visible=rows.slice(0,specializedLimits.sheetMetal);
  return visible.map(item => `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}">${esc(item.code)}</button><div class="desc">${esc(item.description)}</div></td><td>${fmt(item.stock)} ${esc(item.unit||'UN')}</td><td>${esc(movementDate(item.lastMovement))}</td><td>${specializedOrderInfo(item).label}</td><td>${fmt(item.minimum)}</td><td>${fmt(cars)}</td><td>${fmt(item.required)}</td><td class="${item.balance<0?'danger-text':''}">${fmt(item.balance)}</td><td><span class="status ${item.color}">${item.status}</span></td><td>${purchaseAction(item,'explosion',item.required,'Chaparias')}</td></tr>`).join('');
}
function renderSheetMetalSimulation() {
  const model=selectedSheetMetalModel||SHEET_METAL.models[0]||'CHAPARIAS'; const cars=Math.max(1,sheetMetalCars); const query=$('#sheet-metal-search')?.value||''; const status=$('#sheet-metal-coverage')?.value||'all'; const stock=$('#sheet-metal-stock-filter')?.value||'all'; const body=$('#sheet-metal-table-body'); if(body) body.innerHTML=sheetMetalRows(SHEET_METAL.items||[],model,cars,query,status,stock)||'<tr><td colspan="10" class="empty">Nenhuma chaparia corresponde aos filtros.</td></tr>'; setSpecializedLoadMore('sheetMetal',specializedCounts.sheetMetal,Math.min(specializedCounts.sheetMetal,specializedLimits.sheetMetal),renderSheetMetalSimulation); bindMaterialButtons(); bindPurchaseButtons();
}
function sheetMetalView() { const items=SHEET_METAL.items||[]; const models=SHEET_METAL.models||['CHAPARIAS']; const active=selectedSheetMetalModel||models[0]; return `<div class="pins-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado</span><h2>Chaparias</h2><p>Dados lidos diretamente da aba chaparias da Explosão.</p></div><div class="date-pill">${esc(SHEET_METAL.sourceFile||'Aba chaparias')}</div></div><div class="pins-model-strip">${models.map(m=>`<button class="pins-model-card${m===active?' selected':''}" data-sheet-metal-model="${esc(m)}"><span>Chaparias</span><strong>${esc(m)}</strong><small>${m===active?'modelo selecionado':'selecionar modelo'}</small></button>`).join('')}</div><div class="panel pins-panel"><div class="panel-header"><div><h3>Detalhamento das chaparias</h3><span>${fmt(items.length)} códigos disponíveis na aba chaparias</span></div><span class="pins-legend"><i></i> Estoque insuficiente para o mínimo</span></div><div class="panel-body">${items.length?`<div class="toolbar pins-toolbar"><input class="input" id="sheet-metal-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="sheet-metal-coverage"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regulares</option></select><select class="select" id="sheet-metal-stock-filter"><option value="all">Estoque: todos</option><option value="zero">Estoque igual a zero</option><option value="positive">Estoque maior que zero</option></select></div><div class="table-wrap pins-table-wrap"><table class="data-table pins-table pins-simulation-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Última movimentação</th><th>Pedido em aberto</th><th>Mínimo</th><th>Quantidade</th><th>Necessidade</th><th>Saldo</th><th>Situação</th><th>Compras</th></tr></thead><tbody id="sheet-metal-table-body"></tbody></table></div><div class="table-footer specialized-load-more" id="sheetMetal-load-more"></div>`:'<div class="empty">Nenhuma chaparia encontrada.</div>'}</div></div></div>`; }
function productionAlertStatusClass(status) {
  if (status === 'Resolvido') return 'green';
  if (status === 'Em análise') return 'amber';
  if (status === 'Cancelado') return 'gray';
  return 'red';
}

function productionAlertDate(value) {
  return value ? new Date(value).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

function productionAlertRows(items) {
  return items.map(alert => `<tr><td><span class="status ${productionAlertStatusClass(alert.status)}">${esc(alert.status)}</span></td><td><b class="alert-title">ALERTA DA PRODUÇÃO</b><div class="desc">${esc(alert.message)}</div></td><td>${esc(alert.leader || '—')}</td><td>${esc(alert.line || '—')}</td><td><button class="material-code production-alert-code" data-alert-id="${esc(alert.id)}">${esc(alert.code || '—')}</button><div class="desc" title="${esc(alert.description)}">${esc(alert.description || 'Descrição não informada')}</div></td><td>${fmt(alert.stock)} ${esc(alert.unit || 'UN')}</td><td class="movement-date">${esc(movementDate(alert.lastMovement))}</td><td>${fmt(alert.orders)} ${esc(alert.unit || 'UN')}</td><td class="danger-text">${fmt(alert.suggestedPurchase)} ${esc(alert.unit || 'UN')}</td><td>${esc(alert.analyst || '—')}</td><td><button class="secondary-btn alert-detail-btn" data-alert-id="${esc(alert.id)}">Ver material</button><button class="primary-btn alert-status-btn" data-alert-id="${esc(alert.id)}">${alert.status === 'Novo' ? 'Iniciar análise' : alert.status === 'Em análise' ? 'Marcar resolvido' : 'Atualizar estado'}</button></td></tr>`).join('');
}

function productionAlertsView() {
  const query = String(window.productionAlertQuery || '').toLowerCase();
  const selectedStatus = window.productionAlertStatus || 'all';
  const selectedLeader = window.productionAlertLeader || 'all';
  const selectedLine = window.productionAlertLine || 'all';
  const all = PRODUCTION_ALERTS;
  const items = all.filter(alert => {
    const text = `${alert.code} ${alert.description} ${alert.message} ${alert.leader}`.toLowerCase();
    return (!query || text.includes(query)) && (selectedStatus === 'all' || alert.status === selectedStatus) && (selectedLeader === 'all' || alert.leader === selectedLeader) && (selectedLine === 'all' || alert.line === selectedLine) && matchesStockFilter(alert);
  });
  const leaders = [...new Set(all.map(alert => alert.leader).filter(Boolean))];
  const lines = [...new Set(all.map(alert => alert.line).filter(Boolean))];
  const open = all.filter(alert => !['Resolvido', 'Cancelado'].includes(alert.status));
  const critical = all.filter(alert => n(alert.suggestedPurchase) > 0 && !['Resolvido', 'Cancelado'].includes(alert.status));
  const resolvedToday = all.filter(alert => alert.status === 'Resolvido' && new Date(alert.updatedAt || alert.createdAt).toDateString() === new Date().toDateString());
  return `<div class="view-title production-alert-heading"><div><h2>Alertas da produção</h2><p>Avisos enviados pelos líderes da produção.</p></div><button class="primary-btn" id="new-production-alert">＋ Enviar aviso</button></div><div class="summary-strip alert-metrics"><div class="summary-box"><b>${fmt(open.filter(alert => alert.status === 'Novo').length)}</b><span>Novos</span></div><div class="summary-box"><b>${fmt(open.filter(alert => alert.status === 'Em análise').length)}</b><span>Em análise</span></div><div class="summary-box"><b class="danger">${fmt(critical.length)}</b><span>Críticos</span></div><div class="summary-box"><b class="success">${fmt(resolvedToday.length)}</b><span>Resolvidos hoje</span></div></div><div class="panel alert-filter-panel"><div class="toolbar"><select class="select" id="production-alert-leader"><option value="all">Todos os líderes</option>${leaders.map(value => `<option value="${esc(value)}" ${selectedLeader === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select><select class="select" id="production-alert-line"><option value="all">Todas as linhas</option>${lines.map(value => `<option value="${esc(value)}" ${selectedLine === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select><select class="select" id="production-alert-status"><option value="all">Todos os estados</option>${['Novo', 'Em análise', 'Resolvido', 'Cancelado'].map(value => `<option value="${value}" ${selectedStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select class="select" id="production-alert-stock-filter"><option value="all" ${stockFilter === 'all' ? 'selected' : ''}>Estoque: todos</option><option value="zero" ${stockFilter === 'zero' ? 'selected' : ''}>Estoque igual a zero</option><option value="positive" ${stockFilter === 'positive' ? 'selected' : ''}>Estoque maior que zero</option></select><input class="input" id="production-alert-search" value="${esc(window.productionAlertQuery || '')}" placeholder="Pesquisar código, descrição ou mensagem" /><button class="secondary-btn" id="clear-production-alert-filters">Limpar filtros</button></div></div><div class="panel"><div class="table-wrap production-alert-table-wrap"><table class="data-table production-alert-table"><thead><tr><th>Estado</th><th>Alerta</th><th>Líder</th><th>Linha</th><th>Código / descrição</th><th>Estoque</th><th>Última movimentação</th><th>Pedidos em aberto</th><th>Compra sugerida</th><th>Analista</th><th>Ações</th></tr></thead><tbody>${productionAlertRows(items) || '<tr><td colspan="11" class="empty">Nenhum alerta encontrado.</td></tr>'}</tbody></table></div><div class="table-footer">Mostrando ${items.length} de ${all.length} alerta(s).</div></div>`;
}

function openProductionAlertForm() {
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  const options = (DATA?.items || []).slice(0, 500).map(item => `<option value="${esc(item.code)}">${esc(item.description || '')}</option>`).join('');
  overlay.innerHTML = `<section class="material-detail production-alert-form-modal" role="dialog" aria-modal="true" aria-label="Enviar aviso da produção"><div class="material-detail-header"><div><span class="eyebrow">Aviso da produção</span><h2>Informar falta de material</h2><p>O aviso ficará visível para a equipa de estoque e compras.</p></div><button class="icon-btn" id="close-production-alert-form" aria-label="Fechar">×</button></div><form id="production-alert-form" class="alert-form"><div class="form-grid"><div class="field"><label for="production-alert-leader-input">Nome do líder</label><input class="input" id="production-alert-leader-input" required value="${esc(currentUser?.name || '')}" placeholder="Ex.: Elvis" /></div><div class="field"><label for="production-alert-line-input">Linha ou setor</label><input class="input" id="production-alert-line-input" required placeholder="Ex.: Linha 2" /></div></div><div class="field"><label for="production-alert-code-input">Código ou descrição do material</label><input class="input" id="production-alert-code-input" list="production-alert-items" required placeholder="Digite o código ou a descrição" /><datalist id="production-alert-items">${options}</datalist><small>Se o item existir na explosão, os dados serão preenchidos automaticamente.</small></div><div class="field"><label for="production-alert-message-input">O que aconteceu?</label><textarea class="input" id="production-alert-message-input" required rows="4" placeholder="Ex.: Item acabou na linha e a produção está parada."></textarea></div><div id="production-alert-form-error" class="form-error" role="alert"></div><div class="detail-footer"><span class="muted">Os dados do estoque são apenas informativos.</span><button class="secondary-btn" type="button" id="cancel-production-alert-form">Cancelar</button><button class="primary-btn" type="submit">Enviar aviso</button></div></form></section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  $('#close-production-alert-form').onclick = close;
  $('#cancel-production-alert-form').onclick = close;
  overlay.onclick = event => { if (event.target === overlay) close(); };
  $('#production-alert-form').onsubmit = event => {
    event.preventDefault();
    const form = { leader: $('#production-alert-leader-input').value, line: $('#production-alert-line-input').value, code: $('#production-alert-code-input').value, message: $('#production-alert-message-input').value };
    if (!form.leader.trim() || !form.line.trim() || !form.code.trim() || !form.message.trim()) { $('#production-alert-form-error').textContent = 'Preencha todos os campos antes de enviar.'; return; }
    createProductionAlert(form);
    close();
    render();
    alert('Aviso enviado com sucesso. A equipa já pode consultá-lo na central.');
  };
}

function openProductionAlertDetail(id) {
  const alertData = PRODUCTION_ALERTS.find(alert => alert.id === id);
  if (!alertData) return;
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay';
  const history = (alertData.history || []).map(entry => `<div class="detail-list-row"><span>${esc(entry.status)} · ${productionAlertDate(entry.at)}</span><b>${esc(entry.by || '—')}</b></div>`).join('');
  overlay.innerHTML = `<section class="material-detail production-alert-detail" role="dialog" aria-modal="true" aria-label="Detalhe do alerta"><div class="material-detail-header"><div><span class="eyebrow">Detalhe do material</span><h2>${esc(alertData.code || 'Código não informado')}</h2><p>${esc(alertData.description || 'Descrição não informada')}</p></div><button class="icon-btn" id="close-production-alert-detail" aria-label="Fechar">×</button></div><div class="detail-metrics"><div><span>Estoque atual</span><b>${fmt(alertData.stock)} ${esc(alertData.unit || 'UN')}</b></div><div><span>Segurança</span><b>${fmt(alertData.safety)} ${esc(alertData.unit || 'UN')}</b></div><div><span>Compra sugerida</span><b class="danger-text">${fmt(alertData.suggestedPurchase)} ${esc(alertData.unit || 'UN')}</b></div><div><span>Analista</span><b>${esc(alertData.analyst || '—')}</b></div></div><div class="detail-grid"><div class="detail-section"><h3>Informação do aviso</h3><div class="detail-list"><div class="detail-list-row"><span>Líder</span><b>${esc(alertData.leader || '—')}</b></div><div class="detail-list-row"><span>Linha</span><b>${esc(alertData.line || '—')}</b></div><div class="detail-list-row"><span>Mensagem</span><b>${esc(alertData.message || '—')}</b></div><div class="detail-list-row"><span>Enviado em</span><b>${productionAlertDate(alertData.createdAt)}</b></div></div></div><div class="detail-section"><h3>Cálculo e pedidos</h3><div class="detail-list"><div class="detail-list-row"><span>Demanda considerada</span><b>${fmt(alertData.demand)} ${esc(alertData.unit || 'UN')}</b></div><div class="detail-list-row"><span>Pedidos em aberto</span><b>${fmt(alertData.orders)} ${esc(alertData.unit || 'UN')}</b></div><div class="detail-list-row"><span>Família / obtenção</span><b>${esc(alertData.family)} · ${esc(alertData.obtentionType)}</b></div><div class="detail-list-row"><span>Regra</span><b>demanda + segurança − estoque − pedidos</b></div></div></div></div><div class="detail-section"><h3>Histórico de estados</h3>${history || '<p class="empty">Ainda não existe histórico.</p>'}</div><div class="detail-footer"><span class="status ${productionAlertStatusClass(alertData.status)}">${esc(alertData.status)}</span><button class="secondary-btn" id="close-production-alert-detail-bottom">Fechar detalhe</button></div></section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  $('#close-production-alert-detail').onclick = close;
  $('#close-production-alert-detail-bottom').onclick = close;
  overlay.onclick = event => { if (event.target === overlay) close(); };
}

function pvNormalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function pvModelKey(value) {
  const raw = pvNormalize(value).replace(/\s+/g, '');
  const aliases = [['13 5 AT', '13AT'], ['13 5', '13AT'], ['13,5', '13AT'], ['13 AT', '13AT'], ['10 L', '10L'], ['10 S', '10S'], ['15 LDDI', '15LDDI'], ['18 LDDI', '18LDDI'], ['13 LDDI', '13LDDI'], ['13 LDI', '13LDI']];
  const match = aliases.find(([needle]) => raw.includes(needle.replace(/[^A-Z0-9]/g, '')));
  if (match) return match[1];
  return (PINS.models || Object.keys(DATA?.models || {})).find(model => raw.includes(pvNormalize(model).replace(/\s+/g, '')) || pvNormalize(model).replace(/\s+/g, '').includes(raw)) || '';
}

function pvProductModel(productText) {
  const text = pvNormalize(productText);
  const patterns = [
    [/SKY ?CITY.*18 ?LDDI|18 ?LDDI/, '18LDDI'],
    [/SKY ?CITY.*15 ?LDDI|15 ?LDDI/, '15LDDI'],
    [/SKY ?CITY.*13 ?LDDI|13 ?LDDI/, '13LDDI'],
    [/SKY ?CITY.*13 ?LDI|13 ?LDI/, '13LDI'],
    [/SKY ?CITY.*13(?:[., ]5)? ?AT|13(?:[., ]5)? ?AT/, '13AT'],
    [/SKY ?CITY.*10 ?HDOC|10 ?HDOC/, '10HDOC'],
    [/SKY ?CITY.*10 ?S|10 ?S/, '10S'],
    [/SKY ?CITY.*10 ?L|10 ?L/, '10L']
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1] || pvModelKey(text);
}

function pvTokens(value) {
  return new Set(pvNormalize(value).split(/\s+/).filter(token => token.length > 2));
}

function pvStructureMatch(text, model) {
  const structure = DATA?.models?.[model] || [];
  const target = pvTokens(text);
  if (!target.size) return null;
  let best = null;
  structure.forEach(component => {
    const candidate = pvTokens(`${component.code} ${component.description}`);
    const overlap = [...target].filter(token => candidate.has(token)).length;
    const score = overlap / Math.max(target.size, 1);
    if (!best || score > best.score) best = { code: component.code, description: component.description, score };
  });
  return best && best.score >= 0.45 ? best : null;
}

function pvGroupTextItems(items) {
  const groups = [];
  items.filter(item => String(item.str || '').trim()).sort((a, b) => (b.transform?.[5] || 0) - (a.transform?.[5] || 0)).forEach(item => {
    const y = Number(item.transform?.[5] || 0);
    let group = groups.find(row => Math.abs(row.y - y) < 3);
    if (!group) { group = { y, items: [] }; groups.push(group); }
    group.items.push(item);
  });
  return groups.sort((a, b) => b.y - a.y).map(group => ({ text: group.items.sort((a, b) => (a.transform?.[4] || 0) - (b.transform?.[4] || 0)).map(item => item.str).join(' ').replace(/\s+/g, ' ').trim(), items: group.items }));
}

function pvRegionIsRed(canvas, item, viewport) {
  if (!canvas || !item?.transform || !viewport) return false;
  const point = viewport.convertToViewportPoint(Number(item.transform[4] || 0), Number(item.transform[5] || 0));
  const scale = viewport.scale || 1;
  const width = Math.max(12, Math.abs(Number(item.width || 20)) * scale);
  const height = Math.max(8, Math.abs(Number(item.transform[3] || 10)) * scale * 1.4);
  const x0 = Math.max(0, Math.floor(point[0]));
  const y0 = Math.max(0, Math.floor(point[1] - height));
  const x1 = Math.min(canvas.width, Math.ceil(point[0] + width));
  const y1 = Math.min(canvas.height, Math.ceil(point[1] + 2));
  if (x1 <= x0 || y1 <= y0) return false;
  const pixels = canvas.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0).data;
  let colored = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    const red = pixels[index]; const green = pixels[index + 1]; const blue = pixels[index + 2];
    if (red > 145 && red > green * 1.35 && red > blue * 1.35 && green < 150) colored += 1;
  }
  return colored >= 2;
}

async function pvLoadPdfJs() {
  if (!pdfJsPromise) pdfJsPromise = import('./pdf.min.mjs').then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';
    return pdfjs;
  });
  return pdfJsPromise;
}

async function analyzePVFile(file) {
  const pdfjs = await pvLoadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = []; const allLines = []; let textItemCount = 0; let redLineCount = 0; let previewDataUrl = '';
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    textItemCount += content.items.length;
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    if (pageNumber === 1) {
      const previewCanvas = document.createElement('canvas');
      // Mantém uma cópia suficientemente nítida para leitura quando o usuário ampliar.
      const previewWidth = 1400;
      previewCanvas.width = previewWidth;
      previewCanvas.height = Math.max(1, Math.round(previewWidth * viewport.height / viewport.width));
      previewCanvas.getContext('2d').drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
      previewDataUrl = previewCanvas.toDataURL('image/jpeg', 0.82);
    }
    const lines = pvGroupTextItems(content.items).map(line => {
      const red = line.items.some(item => pvRegionIsRed(canvas, item, viewport));
      if (red) redLineCount += 1;
      return { text: line.text, red, page: pageNumber };
    });
    pages.push({ number: pageNumber, lines }); allLines.push(...lines);
  }
  const text = allLines.map(line => line.text).join('\n');
  const productLine = allLines.find(line => /SKY ?CITY|CESTO A[EÉ]REO|PRODUTO/i.test(line.text))?.text || '';
  const chassisLine = allLines.find(line => /MARCA\s*\/?\s*MODELO|MARCA.*MODELO/i.test(line.text))?.text.replace(/.*MODELO\s*:?/i, '').trim() || '';
  const enNumbers = [...new Set((text.match(/EN\s*\d{5,}/gi) || []).map(value => value.replace(/\s+/g, '').toUpperCase()))];
  const pvNumber = (text.match(/\bPV\s*[-:]?\s*\d{4,}\b/i)?.[0] || '').replace(/\s+/g, '').toUpperCase();
  const model = pvProductModel(productLine || text);
  const productStart = allLines.findIndex(line => /PRODUTO/i.test(line.text));
  const productEnd = allLines.findIndex((line, index) => index > productStart && /INFORMA[CÇ][OÕ]ES ADICIONAIS|INFORMACOES ADICIONAIS/i.test(line.text));
  const criticalLines = allLines.filter((line, index) => line.red && index >= Math.max(0, productStart) && (productEnd < 0 || index < productEnd) && !/PRODUTO|PEDIDO|REVISAO|REVIS[AÃ]O|INFORMA/i.test(line.text) && line.text.length > 5);
  const criticalItems = criticalLines.map(line => ({ text: line.text, page: line.page, match: pvStructureMatch(line.text, model) })).filter(item => item.text);
  return { fileName: file.name, pageCount: pdf.numPages, text, productLine, chassisLine, ens: enNumbers, pv: pvNumber, model, criticalItems, previewDataUrl, analysisMode: textItemCount ? 'automatic' : 'manual', status: textItemCount && redLineCount ? 'analyzed' : 'manual', redLineCount, analyzedAt: new Date().toISOString() };
}

function enPVSourceRows() {
  const annual = DATA?.planAnnual?.rows || [];
  const releases = DATA?.planMonth?.liberacoes || [];
  const byEN = new Map(releases.map(row => [String(row.en || '').toUpperCase(), row]));
  return annual.map(row => {
    const en = String(row.pedido || '').trim().toUpperCase();
    const release = byEN.get(en) || {};
    return { en, cliente: row.cliente || release.cliente || '', produto: row.produto || '', modelo: row.modelo || pvProductModel(release.modelo), mes: row.mes || '', data: release.data || '', ...EN_PV_REVIEWS[en] };
  }).filter(row => row.en);
}
function enPVSavedNumber(row) {
  const review = EN_PV_REVIEWS[row.en] || {};
  const number = String(review.pv || review.analysis?.pv || row.pv || '').trim();
  if (number) return number;
  // Mesmo quando o PDF não contém um número legível, a EN foi vinculada
  // automaticamente ao documento importado e precisa deixar de aparecer como pendente.
  return review.linkedFromPV && review.analysis?.fileName ? 'PV vinculado' : '';
}
function enPVStatus(row) {
  const review = EN_PV_REVIEWS[row.en] || row;
  if (enPVSavedNumber(row)) return ['PV gerado', 'green'];
  if (!review.analysis) return ['Não iniciada', 'amber'];
  if (review.analysis.ens?.length && !review.analysis.ens.includes(row.en)) return ['EN ausente no PDF', 'red'];
  if (!review.analysis.model) return ['Modelo do produto não identificado', 'red'];
  if (review.analysis.model && row.modelo && pvModelKey(review.analysis.model) !== pvModelKey(row.modelo)) return ['Divergência de modelo', 'red'];
  if ((review.analysis.criticalItems || []).some(item => !item.match)) return ['Crítica', 'red'];
  const checklist = review.checklist || {};
  if (review.analysis.status === 'manual') return ['Confirmação necessária', 'amber'];
  if (['enVinculada', 'vermelhosRevisados', 'estruturaConferida', 'scResolvida', 'liberada'].every(key => checklist[key])) return ['Concluída', 'green'];
  return ['Em análise', 'amber'];
}

function enPVUpdate(en, patch) {
  const safePatch = { ...patch };
  if (safePatch.analysis) safePatch.analysis = compactPVAnalysis(safePatch.analysis);
  EN_PV_REVIEWS[en] = { ...(EN_PV_REVIEWS[en] || {}), ...safePatch, updatedAt: new Date().toISOString(), updatedBy: currentUser?.name || 'Usuário' };
  saveENPVReviews();
}

function enPVChecklist(en, key, value) {
  const current = EN_PV_REVIEWS[en] || {};
  enPVUpdate(en, { checklist: { ...(current.checklist || {}), [key]: value } });
}

function criticalItemsForEN(en, vehicleCount = 1) {
  const row = enPVSourceRows().find(item => item.en === en) || {};
  const model = pvModelKey(row.modelo) || row.modelo || '';
  const structure = DATA?.models?.[model] || [];
  return structure.map(component => {
    const item = itemByCode(component.code) || {};
    const required = n(component.quantity) * Math.max(1, n(vehicleCount));
    const stock = n(item.stock);
    const orders = Object.entries(item.orders || {}).filter(([, quantity]) => n(quantity) > 0).map(([month, quantity]) => `${month.replace('PED ', '')}: ${fmt(quantity)}`).join(' | ');
    const hasOrder = Object.values(item.orders || {}).some(quantity => n(quantity) > 0);
    const status = availabilityStatus(stock, required, hasOrder);
    return { code: component.code, description: component.description || item.description || '', required, stock, balance: stock - required, orders, model, en, status: status[0], critical: status[0] === 'Crítico' };
  }).filter(item => item.critical);
}

function exportCriticalENItems(en, rows) {
  const headers = ['EN', 'Modelo', 'Código', 'Descrição', 'Pedido (mês: quantidade)', 'Estoque', 'Necessidade', 'Saldo'];
  const escapeCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows.map(row => [row.en, row.model, row.code, row.description, row.orders || 'Sem pedido', row.stock, row.required, row.balance])].map(line => line.map(escapeCell).join(';')).join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `itens-criticos-${en}.xls`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function openENCriticalDetail(en) {
  const row = enPVSourceRows().find(item => item.en === en) || {};
  const critical = criticalItemsForEN(en, 1);
  const overlay = document.createElement('div'); overlay.className = 'detail-overlay';
  overlay.innerHTML = `<section class="material-detail en-critical-modal" role="dialog" aria-modal="true"><div class="material-detail-header"><div><span class="eyebrow">Itens críticos da estrutura</span><h2>${esc(en)}</h2><p>Modelo ${esc(critical[0]?.model || row.modelo || 'não identificado')} · ${fmt(critical.length)} item(ns) crítico(s)</p></div><button class="icon-btn" id="close-en-critical">×</button></div><div class="panel-body"><div class="summary-strip"><div class="summary-box"><b class="danger">${fmt(critical.length)}</b><span>Itens abaixo do estoque necessário</span></div><div class="summary-box"><b>${fmt(critical.reduce((sum, item) => sum + item.required, 0))}</b><span>Necessidade estrutural</span></div><div class="summary-box"><b>${fmt(critical.reduce((sum, item) => sum + item.stock, 0))}</b><span>Estoque atual</span></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Código</th><th>Descrição</th><th>Pedido</th><th>Estoque</th><th>Necessidade</th><th>Saldo</th></tr></thead><tbody>${critical.map(item => `<tr><td>${esc(item.code)}</td><td>${esc(item.description)}</td><td>${esc(item.orders || 'Sem pedido')}</td><td>${fmt(item.stock)}</td><td>${fmt(item.required)}</td><td class="danger-text">${fmt(item.balance)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum item crítico encontrado para a estrutura deste modelo.</td></tr>'}</tbody></table></div><div class="detail-footer"><button class="secondary-btn" id="export-en-critical">Baixar itens críticos para Excel</button><button class="secondary-btn" id="close-en-critical-bottom">Fechar</button></div></div></section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove(); $('#close-en-critical').onclick = close; $('#close-en-critical-bottom').onclick = close; $('#export-en-critical').onclick = () => exportCriticalENItems(en, critical); overlay.onclick = event => { if (event.target === overlay) close(); };
}

function openPVPreview(src) {
  if (!src) return;
  const overlay = document.createElement('div');
  overlay.className = 'pv-preview-overlay';
  overlay.innerHTML = `<section class="pv-preview-dialog" role="dialog" aria-modal="true" aria-label="Prévia ampliada do PV"><div class="pv-preview-toolbar"><strong>Prévia ampliada do PV</strong><button class="icon-btn" id="close-pv-preview" aria-label="Fechar">×</button></div><div class="pv-preview-canvas"><img src="${esc(src)}" alt="PV ampliado para leitura" /></div></section>`;
  document.body.appendChild(overlay);
  const close = () => { document.removeEventListener('keydown', onKeyDown); overlay.remove(); };
  const onKeyDown = event => { if (event.key === 'Escape') close(); };
  $('#close-pv-preview').onclick = close;
  overlay.onclick = event => { if (event.target === overlay) close(); };
  document.addEventListener('keydown', onKeyDown);
}

function enPVView() {
  const source = enPVSourceRows();
  const query = enPvQuery.trim().toLowerCase();
  const rows = source.filter(row => (!enPvFocusENs.size || enPvFocusENs.has(row.en)) && (!query || `${row.en} ${row.cliente} ${row.produto} ${row.pv || ''}`.toLowerCase().includes(query)));
  const counts = { total: source.length, done: 0, pending: 0, critical: 0 };
  source.forEach(row => { const status = enPVStatus(row)[0]; if (status === 'Concluída') counts.done += 1; else if (status === 'Crítica' || status === 'Divergência de modelo' || status === 'EN ausente no PDF') counts.critical += 1; else counts.pending += 1; });
  const active = rows.find(row => row.en === selectedEN) || rows[0] || source[0];
  if (active) selectedEN = active.en;
  const review = active ? (EN_PV_REVIEWS[active.en] || {}) : {};
  const status = active ? enPVStatus(active) : ['—', 'amber'];
  const table = rows.slice(0, 250).map(row => { const state = enPVStatus(row); const savedPV = enPVSavedNumber(row); const pvLabel = savedPV ? esc(savedPV) : '<span class="pv-not-generated">PV ainda não gerado</span>'; return `<tr class="en-pv-row" data-en-row-text="${esc(`${row.en} ${row.cliente} ${row.produto} ${savedPV}`.toLowerCase())}"><td><button class="material-code en-select-btn" data-en-select="${esc(row.en)}">${esc(row.en)}</button></td><td>${esc(row.produto || row.modelo || '—')}</td><td>${esc(row.mes || '—')}</td><td>${pvLabel}</td><td>${fmt(row.analysis?.criticalItems?.length || 0)}</td><td>${esc(row.sc || '—')}</td><td>${esc(row.responsavel || '—')}</td><td><span class="status ${state[1]}">${esc(state[0])}</span></td></tr>`; }).join('');
  const analysis = review.analysis || {};
  const checklist = review.checklist || {};
  const criticalRows = (analysis.criticalItems || []).map(item => `<div class="en-pv-critical-row"><span>${esc(item.text)}</span><span class="status ${item.match ? 'amber' : 'red'}">${item.match ? `Encontrado · ${esc(item.match.code)}` : 'Não encontrado na estrutura'}</span></div>`).join('') || '<div class="empty compact-empty">Nenhum item vermelho confirmado ou detectado.</div>';
  const productModel = analysis.model || active?.modelo || '—';
  const importBanner = EN_PV_IMPORT_RESULT ? `<div class="en-pv-import ${EN_PV_IMPORT_RESULT.status === 'linked' ? 'green' : 'red'}"><b>${EN_PV_IMPORT_RESULT.status === 'linked' ? `PV ${esc(EN_PV_IMPORT_RESULT.pv || EN_PV_IMPORT_RESULT.fileName)} vinculado automaticamente` : 'Nenhuma EN encontrada no plano anual'}</b><span>ENs no PV: ${fmt(EN_PV_IMPORT_RESULT.foundENs.length)} · vinculadas: ${fmt(EN_PV_IMPORT_RESULT.matchedENs.length)}${EN_PV_IMPORT_RESULT.notInPlan.length ? ` · fora do plano: ${esc(EN_PV_IMPORT_RESULT.notInPlan.join(', '))}` : ''}</span></div>` : '';
  const preview = analysis.previewDataUrl || (analysis.previewKey ? EN_PV_PREVIEWS[analysis.previewKey] : '');
  return `<div class="view-title"><div><h2>Controle de ENs / PVs</h2><p>Rastreabilidade da análise por projeto: PDF, modelo estrutural, itens críticos e SC.</p></div><div class="date-pill">Plano anual · ${fmt(counts.total)} ENs</div></div>${importBanner}<div class="en-pv-metrics"><div class="metric"><span class="metric-label">ENs no plano</span><b class="metric-value">${fmt(counts.total)}</b></div><div class="metric en-pv-metric-green"><span class="metric-label">Concluídas</span><b class="metric-value">${fmt(counts.done)}</b></div><div class="metric en-pv-metric-amber"><span class="metric-label">Pendentes</span><b class="metric-value">${fmt(counts.pending)}</b></div><div class="metric en-pv-metric-red"><span class="metric-label">Críticas</span><b class="metric-value">${fmt(counts.critical)}</b></div></div><div class="en-pv-layout"><section class="panel"><div class="panel-header"><div><h3>ENs do plano anual</h3><span>Cada EN permanece rastreável pelo PV e pelo modelo do produto.</span></div><input id="en-pv-search" class="input" placeholder="Pesquisar EN, PV ou cliente" value="${esc(enPvQuery)}" /></div><div class="table-wrap"><table class="data-table en-pv-table"><thead><tr><th>EN</th><th>Produto / modelo</th><th>Mês</th><th>PV</th><th>Itens críticos</th><th>SC</th><th>Responsável</th><th>Status</th></tr></thead><tbody>${table || '<tr><td colspan="8" class="empty">Nenhuma EN encontrada.</td></tr>'}</tbody></table></div></section><section class="panel en-pv-detail"><div class="panel-header"><div><h3>${active ? `${esc(active.en)} · Detalhes da análise` : 'Selecione uma EN'}</h3><span>${active ? esc(status[0]) : '—'}</span></div></div>${active ? `<div class="en-pv-meta"><div><span>Cliente</span><b>${esc(active.cliente || '—')}</b></div><div><span>Veículo/chassi</span><b>${esc(analysis.chassisLine || 'Não informado no PDF')}</b></div><div><span>Produto no PV</span><b>${esc(analysis.productLine || active.produto || 'Aguardando PDF')}</b></div><div><span>Modelo estrutural</span><b class="model-highlight">${esc(productModel)}</b></div><div><span>Entrega</span><b>${esc(active.mes || active.data || '—')}</b></div><div><span>Arquivo PV</span><b>${esc(analysis.fileName || 'Nenhum PDF analisado')}</b></div>${preview ? `<div class="en-pv-preview"><span>Prévia do PV</span><img src="${preview}" alt="Prévia da primeira página do PV" /></div>` : ''}</div><div class="en-pv-upload"><label class="primary-btn" for="en-pv-file">Ler PDF do PV</label><input id="en-pv-file" type="file" accept="application/pdf" hidden /><small>O sistema lê todas as ENs do PV, vincula-as ao plano anual e compara itens críticos com o modelo.</small></div><div class="en-pv-fields"><label>PV<input id="en-pv-number" class="input" value="${esc(review.pv || '')}" placeholder="PV-12345" /></label><label>SC principal<input id="en-pv-sc" class="input" value="${esc(review.sc || '')}" placeholder="SC-000123" /></label><label>Responsável<input id="en-pv-owner" class="input" value="${esc(review.responsavel || currentUser?.name || '')}" /></label><button id="en-pv-save" class="primary-btn">Salvar análise</button></div><h4>Itens críticos identificados no PV</h4><div class="en-pv-critical-list">${criticalRows}</div>${analysis.status === 'manual' ? '<div class="en-pv-warning">O PDF não entregou texto/cor suficiente para uma conclusão automática. Confirme os itens vermelhos antes de liberar a EN.</div>' : ''}<h4>Checklist de liberação</h4><div class="en-pv-checklist">${[['enVinculada','EN vinculada ao PV'],['vermelhosRevisados','Itens vermelhos do PV revisados'],['estruturaConferida',`Estrutura ${esc(productModel)} conferida`],['scResolvida','SC aberta para todos os itens faltantes'],['liberada','EN liberada']].map(([key,label]) => `<label><input type="checkbox" data-en-check="${key}" ${checklist[key] ? 'checked' : ''} />${label}</label>`).join('')}</div><div class="en-pv-alert ${status[1]}">${status[0] === 'Concluída' ? 'EN liberada: checklist completo e modelo estrutural conferido.' : `Atenção: ${esc(status[0])}. A EN não deve ser liberada enquanto houver pendência.`}</div>` : '<div class="empty">Selecione uma EN para iniciar.</div>'}</section></div></div>`;
}

async function handleENPVUpload(file) {
  if (!file) return;
  const button = $('#en-pv-file');
  try {
    const analysis = await analyzePVFile(file);
    const source = enPVSourceRows();
    const sourceENs = new Set(source.map(row => row.en));
    const foundENs = [...new Set(analysis.ens || [])];
    const matchedENs = foundENs.filter(en => sourceENs.has(en));
    const notInPlan = foundENs.filter(en => !sourceENs.has(en));
    const previewKey = analysis.pv || analysis.fileName;
    if (analysis.previewDataUrl) EN_PV_PREVIEWS[previewKey] = analysis.previewDataUrl;
    saveENPVPreviews();
    const linkedAnalysis = { ...analysis, previewKey };
    delete linkedAnalysis.previewDataUrl;
    matchedENs.forEach(en => enPVUpdate(en, { analysis: linkedAnalysis, pv: analysis.pv || EN_PV_REVIEWS[en]?.pv || '', linkedFromPV: true }));
    EN_PV_IMPORT_RESULT = { fileName: file.name, pv: analysis.pv, foundENs, matchedENs, notInPlan, status: matchedENs.length ? 'linked' : 'not-found' };
    enPvFocusENs = new Set(matchedENs);
    enPvQuery = analysis.pv || '';
    if (matchedENs.length) selectedEN = matchedENs[0];
    else if (selectedEN) enPVUpdate(selectedEN, { analysis: linkedAnalysis, pv: analysis.pv || EN_PV_REVIEWS[selectedEN]?.pv || '' });
    render();
  } catch (error) {
    enPVUpdate(selectedEN, { analysis: { fileName: file.name, status: 'manual', error: error.message, analyzedAt: new Date().toISOString() } });
    render();
    console.error('Falha ao ler PDF do PV.', error);
  } finally {
    if (button) button.value = '';
  }
}

// Reconstrói o conteúdo da tela sempre que uma área ou filtro muda.
function render() {
  if (!DATA) return;
  const titles = { overview: 'Visão geral', stock: 'Estoque', orders: 'Pedidos e demanda', models: 'Modelos', simulation: 'Simulação', history: 'Evolução do estoque', consumables: 'Consumíveis', pins: 'Pinos por modelo', modelNiguri: 'NIGURI dos modelos', cylinders: 'Cilindros por modelo', cabins: 'Cabines por modelo', sheetMetal: 'Chaparias', calfer: 'Estoque Calfer', purchaseProcess: 'Processo de compra', excess: 'Pedidos em excesso', followup: 'Acompanhamento', enPV: 'Controle de ENs / PVs', productionAlerts: 'Aviso da produção' };
  $('#page-title').textContent = titles[view];
  const pages = { overview, stock: stockView, orders: ordersView, models: modelsView, simulation, followup: followUpView, history: stockHistoryView, consumables: consumablesView, pins: pinsView, modelNiguri: modelNiguriView, cylinders: cylindersView, cabins: cabinsView, sheetMetal: sheetMetalView, calfer: calferView, purchaseProcess: renderPurchaseProcessPage, excess: excessView, enPV: enPVView, productionAlerts: productionAlertsView };
  const renderPage = pages[view];
  if (typeof renderPage !== 'function') {
    $('#app').innerHTML = '<div class="panel empty">A vista selecionada não foi encontrada. Volte à Visão geral e tente novamente.</div>';
    return;
  }
  $('#app').innerHTML = view === 'followup' ? followUpView() : (view === 'history' ? stockHistoryView() : renderPage());
  bindView();
}

// Liga os eventos dos campos, botões, tabelas e filtros recém-renderizados.
function bindView() {
  if (view === 'overview') {
    document.querySelectorAll('[data-export-alert]').forEach(button => button.onclick = () => {
      const kind = button.dataset.exportAlert;
      const items = plannedSignalItems(kind);
      exportCriticalItems(items, `itens-${kind}-${new Date().toISOString().slice(0, 10)}.xls`);
    });
  }
  const globalFilters = [
    ['#analyst-filter', value => { analyst = value; }],
    ['#family-filter', value => { family = value; }],
    ['#obtention-filter', value => { obtentionType = value; }],
    ['#stock-filter', value => { stockFilter = value; }],
  ];
  globalFilters.forEach(([selector, update]) => {
    const element = $(selector);
    if (element) element.onchange = () => { update(element.value); render(); };
  });

  bindMaterialButtons();
  bindPurchaseButtons();
  bindProgressiveTables();
  if (view === 'modelNiguri') {
    const model = $('#model-niguri-model'); const week = $('#model-niguri-start-week'); const analystSelect = $('#model-niguri-analyst'); const search = $('#model-niguri-search'); const status = $('#model-niguri-status');
    if (model) model.onchange = () => { modelNiguriModel = model.value; modelNiguriStartWeek = ''; render(); };
    if (week) week.onchange = () => { modelNiguriStartWeek = week.value; render(); };
    if (analystSelect) analystSelect.onchange = () => { modelNiguriAnalyst = analystSelect.value; render(); };
    if (search) search.oninput = () => { const current = modelNiguriView(); const temp = document.createElement('div'); temp.innerHTML = current; const oldBody = document.querySelector('.pins-niguri-table tbody'); const newBody = temp.querySelector('.pins-niguri-table tbody'); if (oldBody && newBody) oldBody.innerHTML = newBody.innerHTML; bindMaterialButtons(); };
    if (status) status.onchange = () => { const current = modelNiguriView(); const temp = document.createElement('div'); temp.innerHTML = current; const oldBody = document.querySelector('.pins-niguri-table tbody'); const newBody = temp.querySelector('.pins-niguri-table tbody'); if (oldBody && newBody) oldBody.innerHTML = newBody.innerHTML; bindMaterialButtons(); };
  }
  document.querySelectorAll('[data-go-view]').forEach(button => button.onclick = () => {
    view = button.dataset.goView;
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
    render();
  });
  document.querySelectorAll('.consumable-code').forEach(button => button.onclick = () => openConsumableDetail(button.dataset.code));

  document.querySelectorAll('[data-purchase-remove]').forEach(button => button.onclick = () => removeFromPurchaseProcess(button.dataset.purchaseRemove));
  const exportButton = $('#export-purchase-process');
  if (exportButton) exportButton.onclick = exportPurchaseProcess;
  const clearButton = $('#clear-purchase-process');
  if (clearButton) clearButton.onclick = () => { PURCHASE_PROCESS = []; savePurchaseProcess(); render(); };

  const followUpMetric = $('#follow-up-metric');
  if (followUpMetric) followUpMetric.onclick = () => { view = 'followup'; render(); };

  if (view === 'followup') {
    $('#back-to-overview').onclick = () => { view = 'overview'; render(); };
    $('#follow-up-search').oninput = () => {
      const query = ($('#follow-up-search').value || '').toLowerCase();
      const items = followUpItems().filter(item => `${item.code} ${item.description} ${item.analyst || ''}`.toLowerCase().includes(query));
      const target = $('#follow-up-table tbody');
      if (target) target.innerHTML = followUpRows(items) || '<tr><td colspan="5" class="empty">Nenhum item encontrado.</td></tr>';
      bindMaterialButtons();
    };
  }

  const demandSelector = $('#demand-month');
  if (demandSelector) demandSelector.onchange = () => { demandMonth = demandSelector.value; render(); };

  if (view === 'excess') {
    const monthSelector = $('#excess-month');
    if (monthSelector) monthSelector.onchange = () => { excessMonth = monthSelector.value; render(); };
    const search = $('#excess-search');
    if (search) search.oninput = () => {
      const query = search.value.toLowerCase();
      document.querySelectorAll('#excess-table-body .excess-row').forEach(row => { row.hidden = !row.textContent.toLowerCase().includes(query); });
    };
    document.querySelectorAll('.excess-code').forEach(button => button.onclick = () => openExcessDetail(button.dataset.excessCode, button.dataset.excessMonth));
  }

  if (view === 'calfer') {
    document.querySelectorAll('[data-calfer-model]').forEach(button => button.onclick = () => { selectedCalferModel = button.dataset.calferModel || ''; render(); });
    const machines = $('#calfer-machines');
    if (machines) machines.onchange = () => { calferMachineCount = Math.max(1, Math.floor(n(machines.value) || 1)); render(); };
    const sendToCalfer = $('#send-to-calfer');
    if (sendToCalfer) sendToCalfer.onclick = () => sendCalferMachines('nextToCalfer', selectedCalferModel, calferMachineCount);
    const sendToNext = $('#send-to-next');
    if (sendToNext) sendToNext.onclick = () => sendCalferMachines('calferToNext', selectedCalferModel, calferMachineCount);
    const clear = $('#clear-calfer-movements');
    if (clear) clear.onclick = () => { CALFER.transactions = []; saveCalferTransactions(); render(); };
  }

  if (view === 'cylinders') {
    document.querySelectorAll('[data-cylinder-model]').forEach(button => button.onclick = () => {
      selectedCylinderModel = button.dataset.cylinderModel || '';
      render();
    });
    const carsInput = $('#cylinders-cars');
    const runSimulation = () => {
      cylinderCars = Math.max(1, Math.floor(n(carsInput?.value) || 1));
      if (carsInput) carsInput.value = cylinderCars;
      renderCylinderSimulation();
    };
    if (carsInput) carsInput.onchange = runSimulation;
    const runButton = $('#run-cylinders-simulation');
    if (runButton) runButton.onclick = runSimulation;
    const search = $('#cylinders-search');
    const coverage = $('#cylinders-coverage');
    if (search) search.oninput = renderCylinderSimulation;
    if (coverage) coverage.onchange = renderCylinderSimulation;
    const cylindersStockFilter = $('#cylinders-stock-filter');
    if (cylindersStockFilter) cylindersStockFilter.onchange = renderCylinderSimulation;
    if (CYLINDERS.items?.length) renderCylinderSimulation();
  }

  if (view === 'cabins') {
    document.querySelectorAll('[data-cabin-model]').forEach(button => button.onclick = () => {
      selectedCabinModel = button.dataset.cabinModel || '';
      render();
    });
    const carsInput = $('#cabins-cars');
    const runSimulation = () => {
      cabinCars = Math.max(1, Math.floor(n(carsInput?.value) || 1));
      if (carsInput) carsInput.value = cabinCars;
      renderCabinSimulation();
    };
    if (carsInput) carsInput.onchange = runSimulation;
    const runButton = $('#run-cabins-simulation');
    if (runButton) runButton.onclick = runSimulation;
    const search = $('#cabins-search');
    const coverage = $('#cabins-coverage');
    if (search) search.oninput = renderCabinSimulation;
    if (coverage) coverage.onchange = renderCabinSimulation;
    const cabinsStockFilter = $('#cabins-stock-filter');
    if (cabinsStockFilter) cabinsStockFilter.onchange = renderCabinSimulation;
    if (CABINS.items?.length) renderCabinSimulation();
  }

  if (view === 'sheetMetal') {
    document.querySelectorAll('[data-sheet-metal-model]').forEach(button => button.onclick = () => { selectedSheetMetalModel = button.dataset.sheetMetalModel || ''; render(); });
    const search=$('#sheet-metal-search'); const coverage=$('#sheet-metal-coverage'); const stock=$('#sheet-metal-stock-filter');
    if(search) search.oninput=renderSheetMetalSimulation; if(coverage) coverage.onchange=renderSheetMetalSimulation; if(stock) stock.onchange=renderSheetMetalSimulation;
    renderSheetMetalSimulation();
  }
  if (view === 'pins') {
    document.querySelectorAll('[data-pins-subview]').forEach(button => button.onclick = () => {
      pinsSubView = button.dataset.pinsSubview || 'simulation';
      render();
    });
    document.querySelectorAll('[data-pin-model]').forEach(button => button.onclick = () => {
      selectedPinModel = button.dataset.pinModel || '';
      render();
    });
    if (pinsSubView === 'niguri') {
      const modelSelect = $('#pins-niguri-model');
      const startWeekSelect = $('#pins-niguri-start-week');
      const search = $('#pins-niguri-search');
      const status = $('#pins-niguri-status');
      if (modelSelect) modelSelect.onchange = () => { selectedPinModel = modelSelect.value; render(); };
      if (startWeekSelect) startWeekSelect.onchange = () => { pinsNiguriStartWeek = startWeekSelect.value; render(); };
      const rerenderNiguri = () => {
        const selected = modelSelect?.value || selectedPinModel || PINS.models?.[0] || 'Todos os modelos';
        const result = pinsNiguriRows(selected, search?.value || '', status?.value || 'all');
        const table = document.querySelector('.pins-niguri-table tbody');
        if (table) {
          const current = pinsNiguriView();
          const temp = document.createElement('div'); temp.innerHTML = current;
          const fresh = temp.querySelector('.pins-niguri-table tbody');
          if (fresh) table.innerHTML = fresh.innerHTML;
        }
        bindMaterialButtons();
        bindNiguriPinButtons();
      };
      if (search) search.oninput = rerenderNiguri;
      if (status) status.onchange = rerenderNiguri;
      bindMaterialButtons();
      bindNiguriPinButtons();
      return;
    }
    const carsInput = $('#pins-cars');
    const runSimulation = () => {
      pinCars = Math.max(1, Math.floor(n(carsInput?.value) || 1));
      if (carsInput) carsInput.value = pinCars;
      renderPinSimulation();
    };
    if (carsInput) carsInput.onchange = runSimulation;
    const runButton = $('#run-pins-simulation');
    if (runButton) runButton.onclick = runSimulation;
    const search = $('#pins-search');
    const coverage = $('#pins-coverage');
    if (search) search.oninput = renderPinSimulation;
    if (coverage) coverage.onchange = renderPinSimulation;
    const pinsStockFilter = $('#pins-stock-filter');
    if (pinsStockFilter) pinsStockFilter.onchange = renderPinSimulation;
    renderPinSimulation();
  }

  if (view === 'consumables') {
    const filter = () => {
      const query = ($('#consumables-search').value || '').toLowerCase();
      const stockFilter = $('#consumables-stock-status').value;
      const maxFilter = $('#consumables-max-status').value;
      const followupFilter = $('#consumables-followup').value;
      const items = consumablesFilteredItems().filter(item => {
        const text = `${item.code} ${item.description}`.toLowerCase();
        const state = consumableDecision(item);
        const stockValueOk = matchesStockFilter(item);
        const stockStatusOk = stockFilter === 'all' || String(item.stockStatus || '').toLowerCase() === stockFilter.toLowerCase();
        const maxText = String(item.maxStatus || '').toLowerCase();
        const maxOk = maxFilter === 'all' || (maxFilter === 'above' ? maxText.includes('acima') || maxText.includes('maximo') || maxText.includes('máximo') : !(maxText.includes('acima') || maxText.includes('maximo') || maxText.includes('máximo')));
        const hasOrder = consumableHasOrder(item);
        const overdue = consumableHasOverdueOrder(item);
        const followOk = followupFilter === 'all' || (followupFilter === 'order' && hasOrder) || (followupFilter === 'overdue' && overdue) || (followupFilter === 'none' && !hasOrder);
        return text.includes(query) && stockValueOk && stockStatusOk && maxOk && followOk;
      });
      $('#consumables-table-body').innerHTML = consumableRows(items) || '<tr><td colspan="12" class="empty">Nenhum consumível encontrado.</td></tr>';
      document.querySelectorAll('.consumable-code').forEach(button => button.onclick = () => openConsumableDetail(button.dataset.code));
      bindPurchaseButtons();
    };
    $('#consumables-search').oninput = filter;
    $('#consumables-stock-status').onchange = filter;
    $('#consumables-max-status').onchange = filter;
    $('#consumables-followup').onchange = filter;
  }

  if (view === 'stock') {
    const filter = () => {
      const query = ($('#stock-search').value || '').toLowerCase();
      const selectedRisk = $('#stock-risk').value;
      const items = scopedItems().filter(item => (!query || `${item.code} ${item.description}`.toLowerCase().includes(query)) && (selectedRisk === 'all' || risk(item)[0] === selectedRisk));
      $('#stock-table').innerHTML = table(items, 250, false, '', true);
      bindMaterialButtons();
      bindPurchaseButtons();
      bindProgressiveTables();
    };
    $('#stock-search').oninput = filter;
    $('#stock-risk').onchange = filter;
  }

  if (view === 'orders') {
    const monthSelect = $('#demand-month');
    if (monthSelect) monthSelect.onchange = () => { demandMonth = monthSelect.value; render(); };
    const filterOrders = () => {
      const query = ($('#orders-search').value || '').toLowerCase();
      const selectedRisk = $('#orders-risk').value;
      const orderBase = DATA.items || [];
      const availableDemandMonths = (DATA.demandMonths?.length ? DATA.demandMonths : [...new Set(orderBase.flatMap(item => Object.keys(item.demands || {})))]).filter(month => orderBase.some(item => n(item.demands?.[month]) > 0));
      const chosen = demandMonth !== 'all' && availableDemandMonths.includes(demandMonth) ? demandMonth : (availableDemandMonths[0] || '');
      const items = chosen ? ordersItemsForMonth(orderBase, chosen).filter(item => (!query || `${item.code} ${item.description}`.toLowerCase().includes(query)) && (selectedRisk === 'all' || risk(item, item.need)[0] === selectedRisk)) : [];
      if ($('#orders-table')) {
        $('#orders-table').innerHTML = chosen ? table(items, 150, true, chosen) : '<div class="empty">Selecione um mês para mostrar os itens e o saldo projetado.</div>';
        bindMaterialButtons();
        bindPurchaseButtons();
        bindProgressiveTables();
      }
    };
    $('#orders-search').oninput = filterOrders;
    $('#orders-risk').onchange = filterOrders;
  }

  if (view === 'models') {
    document.querySelectorAll('.model-card').forEach(card => card.onclick = () => {
      const name = card.dataset.model;
      const box = $('#model-detail');
      const list = DATA.models[name] || [];
      const modelItems = list.map(component => ({ ...(itemByCode(component.code) || { code: component.code, description: component.description, stock: 0, safety: 0, analyst: '', family: '', obtentionType: '', orders: {}, unit: 'UN' }), requirement: component.quantity })).filter(matchesGlobalFilters);
      box.style.display = 'block';
      box.innerHTML = `<div class="panel-header"><h3>${esc(name)}</h3><span>${list.length} componentes</span></div><div class="toolbar"><select class="select" id="model-risk"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regular</option></select></div><div id="model-table">${table(modelItems, 100)}</div>`;
      $('#model-risk').onchange = () => { const selectedRisk = $('#model-risk').value; $('#model-table').innerHTML = table(selectedRisk === 'all' ? modelItems : modelItems.filter(item => risk(item)[0] === selectedRisk), 100); bindMaterialButtons(); bindProgressiveTables(); };
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (view === 'purchaseProcess') {
    document.querySelectorAll('[data-purchase-remove]').forEach(button => button.onclick = () => removeFromPurchaseProcess(button.dataset.purchaseRemove));
  }

  if (view === 'productionAlerts') {
    const search = $('#production-alert-search');
    const leaderFilter = $('#production-alert-leader');
    const lineFilter = $('#production-alert-line');
    const statusFilter = $('#production-alert-status');
    const stockFilterInput = $('#production-alert-stock-filter');
    const rerenderAlerts = () => {
      window.productionAlertQuery = search?.value || '';
      window.productionAlertLeader = leaderFilter?.value || 'all';
      window.productionAlertLine = lineFilter?.value || 'all';
      window.productionAlertStatus = statusFilter?.value || 'all';
      render();
    };
    if (search) search.oninput = rerenderAlerts;
    if (leaderFilter) leaderFilter.onchange = rerenderAlerts;
    if (lineFilter) lineFilter.onchange = rerenderAlerts;
    if (statusFilter) statusFilter.onchange = rerenderAlerts;
    if (stockFilterInput) stockFilterInput.onchange = () => { stockFilter = stockFilterInput.value; rerenderAlerts(); };
    const clearFilters = $('#clear-production-alert-filters');
    if (clearFilters) clearFilters.onclick = () => { window.productionAlertQuery = ''; window.productionAlertLeader = 'all'; window.productionAlertLine = 'all'; window.productionAlertStatus = 'all'; stockFilter = 'all'; render(); };
    const newAlert = $('#new-production-alert');
    if (newAlert) newAlert.onclick = openProductionAlertForm;
    document.querySelectorAll('.production-alert-code, .alert-detail-btn').forEach(button => button.onclick = () => openProductionAlertDetail(button.dataset.alertId));
    document.querySelectorAll('.alert-status-btn').forEach(button => button.onclick = () => {
      const alertData = PRODUCTION_ALERTS.find(item => item.id === button.dataset.alertId);
      if (!alertData) return;
      const nextStatus = alertData.status === 'Novo' ? 'Em análise' : alertData.status === 'Em análise' ? 'Resolvido' : 'Em análise';
      updateProductionAlertStatus(alertData.id, nextStatus);
      render();
    });
  }

  if (view === 'simulation') {
    $('#run-simulation').onclick = runWeeklySimulation;
  }
  if (view === 'enPV') {
    const search = $('#en-pv-search');
    if (search) search.oninput = () => {
      enPvQuery = search.value || '';
      const query = enPvQuery.trim().toLowerCase();
      document.querySelectorAll('.en-pv-row').forEach(row => { row.hidden = !!query && !String(row.dataset.enRowText || '').includes(query); });
    };
    document.querySelectorAll('.en-pv-preview img').forEach(image => {
      image.title = 'Clique para ampliar e ler o PV';
      image.onclick = () => openPVPreview(image.currentSrc || image.src);
    });
    document.querySelectorAll('[data-en-select]').forEach(button => button.onclick = () => { selectedEN = button.dataset.enSelect || ''; render(); openENCriticalDetail(selectedEN); });
    const fileInput = $('#en-pv-file');
    if (fileInput) fileInput.onchange = () => handleENPVUpload(fileInput.files?.[0]);
    const save = $('#en-pv-save');
    if (save) save.onclick = () => {
      if (!selectedEN) return;
      const pv = $('#en-pv-number')?.value.trim() || '';
      const sc = $('#en-pv-sc')?.value.trim() || '';
      const responsavel = $('#en-pv-owner')?.value.trim() || '';
      const linkedENs = EN_PV_IMPORT_RESULT?.matchedENs?.length ? EN_PV_IMPORT_RESULT.matchedENs : [selectedEN];
      linkedENs.forEach(en => {
        const current = EN_PV_REVIEWS[en] || {};
        const analysis = current.analysis ? { ...current.analysis, pv: pv || current.analysis.pv || current.pv || '' } : { pv, status: 'manual', ens: linkedENs };
        enPVUpdate(en, { pv, sc, responsavel, analysis, linkedFromPV: true });
      });
      if (EN_PV_IMPORT_RESULT) EN_PV_IMPORT_RESULT.pv = pv || EN_PV_IMPORT_RESULT.pv;
      render();
    };
    document.querySelectorAll('[data-en-check]').forEach(input => input.onchange = () => enPVChecklist(selectedEN, input.dataset.enCheck, input.checked));
  }
}

// Guarda a sessão e identifica o usuário autenticado sem decidir qual tela ficará visível.
function setAuthenticatedSession(user) {
  currentUser = user;
  // O login identifica a pessoa, mas não limita a consulta à carteira dela.
  analyst = 'all';
  $('#current-user-label').textContent = `Acesso: ${user.name}`;
  sessionStorage.setItem(AUTH_STORAGE_KEY, user.username);
}

// Oculta o login e mostra o dashboard depois que o usuário é validado.
function setAuthenticatedView(user) {
  setAuthenticatedSession(user);
  $('#login-screen').hidden = true;
  $('#splash-screen').hidden = true;
  $('#dashboard-shell').hidden = false;
}

// Mostra a animação de carregamento enquanto a base é preparada.
function showSplashScreen() {
  $('#login-screen').hidden = true;
  $('#splash-screen').hidden = false;
  $('#dashboard-shell').hidden = true;
}

// Deixa a animação visível por pelo menos dez segundos e carrega os dados em paralelo.
async function showSplashThenDashboard(user) {
  setAuthenticatedSession(user);
  showSplashScreen();
  const minimumSplashTime = new Promise(resolve => setTimeout(resolve, 10000));
  await Promise.all([minimumSplashTime, load()]);
  $('#splash-screen').hidden = true;
  $('#dashboard-shell').hidden = false;
}

function showLogin(message = '') {
  currentUser = null;
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  $('#splash-screen').hidden = true;
  $('#dashboard-shell').hidden = true;
  $('#login-screen').hidden = false;
  $('#login-error').textContent = message;
  $('#login-password').value = '';
  $('#login-username').focus();
}

function findLoginUser(username, password) {
  return LOGIN_USERS.find(user => user.username.toLowerCase() === username.trim().toLowerCase() && user.password === password);
}

// Recupera a sessão do navegador e configura o envio do formulário de login.
function startAuthentication() {
  const loginForm = $('#login-form');
  const savedUsername = sessionStorage.getItem(AUTH_STORAGE_KEY);
  const savedUser = LOGIN_USERS.find(user => user.username === savedUsername);

  if (savedUser) {
    setAuthenticatedView(savedUser);
    load();
  } else {
    showLogin();
  }

  loginForm.onsubmit = event => {
    event.preventDefault();
    const username = $('#login-username').value;
    const password = $('#login-password').value;
    const user = findLoginUser(username, password);

    if (!user) {
      $('#login-error').textContent = 'Utilizador ou senha inválidos.';
      $('#login-password').select();
      return;
    }

    $('#login-error').textContent = '';
     alert(`Bem-vindo, ${user.name}! 👋

O sistema será carregado em instantes. Pedimos atenção às informações apresentadas, pois esta plataforma ainda está em fase de testes e alguns dados podem sofrer ajustes.

Nossa equipe de analistas está realizando um duplo check das informações, buscando identificar possíveis inconsistências e garantir cada vez mais a confiabilidade dos dados.

Caso identifique alguma informação incorreta, agradecemos pela compreensão e colaboração. Estamos trabalhando continuamente para aprimorar o sistema.

Obrigado!.`);
    setAuthenticatedView(user);
    load();
    showSplashThenDashboard(user);
  };
}

// Lê o JSON local e inicia a primeira renderização do dashboard.
async function load() {
  try {
    const [dataResponse, historyResponse, consumablesResponse, planoResponse, annualPlanResponse, pinsResponse, cylindersResponse, cabinsResponse, sheetMetalResponse, programacaoResponse, calferResponse] = await Promise.all([
      fetch('data/explosao.json'),
      fetch('data/historico-estoque.json'),
      fetch('data/consumiveis.json'),
      fetch('data/plano-mes.json'),
      fetch('data/plano-anual.json'),
      fetch('data/pinos.json'),
      fetch('data/cilindros.json'),
      fetch('data/cabines.json'),
      fetch('data/chaparias.json'),
      fetch('data/programacao-modelos.json'),
      fetch('data/calfer.json')
    ]);
    DATA = await dataResponse.json();
    STOCK_HISTORY = historyResponse.ok ? await historyResponse.json() : { records: [] };
    CONSUMABLES = consumablesResponse.ok ? await consumablesResponse.json() : { items: [], months: [] };
    DATA.planMonth = planoResponse.ok ? await planoResponse.json() : { models: [], months: [] };
    DATA.planAnnual = annualPlanResponse.ok ? await annualPlanResponse.json() : { models: {}, rows: [] };
    PINS = pinsResponse.ok ? await pinsResponse.json() : { items: [], models: [] };
    CYLINDERS = cylindersResponse.ok ? await cylindersResponse.json() : { items: [], models: [] };
    CABINS = cabinsResponse.ok ? await cabinsResponse.json() : { items: [], models: [] };
    SHEET_METAL = sheetMetalResponse.ok ? await sheetMetalResponse.json() : { items: [], models: [] };
    DATA.programacaoModels = programacaoResponse.ok ? await programacaoResponse.json() : { models: [] };
    CALFER = calferResponse.ok ? await calferResponse.json() : { nextModels: [], calferModels: [], items: [], transactions: [] };
    loadCalferTransactions();
    const itemByCodeMap = new Map((DATA.items || []).map(item => [String(item.code), item]));
    CONSUMABLES.items = (CONSUMABLES.items || []).map(item => ({ ...item, lastMovement: item.lastMovement || itemByCodeMap.get(String(item.code))?.lastMovement || 'não tem' }));
    PINS.items = (PINS.items || []).map(item => ({ ...item, lastMovement: item.lastMovement || itemByCodeMap.get(String(item.code))?.lastMovement || 'não tem' }));
    CYLINDERS.items = (CYLINDERS.items || []).map(item => ({ ...item, lastMovement: item.lastMovement || itemByCodeMap.get(String(item.code))?.lastMovement || 'não tem' }));
    SHEET_METAL.items = (SHEET_METAL.items || []).map(item => ({ ...item, unit: item.unit || 'UN', lastMovement: item.lastMovement || itemByCodeMap.get(String(item.code))?.lastMovement || 'não tem' }));
    CABINS.items = (CABINS.items || []).map(item => ({ ...item, unit: item.unit || 'UN', lastMovement: item.lastMovement || itemByCodeMap.get(String(item.code))?.lastMovement || 'não tem' }));
    $('#source-file').textContent = DATA.sourceFile;
    $('#updated-at').textContent = `Base carregada · ${DATA.generatedAt}`;
    render();
  } catch (error) {
    $('#app').innerHTML = '<div class="panel empty">Não foi possível carregar data/explosao.json. Abra a pasta com um servidor local, como a extensão Live Server do VS Code.</div>';
  }
}

document.querySelectorAll('.nav-item').forEach(button => button.onclick = () => {
  view = button.dataset.view;
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === button));
  render();
  if (innerWidth < 900) $('#sidebar').classList.remove('open');
});

$('#mobile-menu').onclick = () => $('#sidebar').classList.toggle('open');
$('#refresh-data').onclick = load;
$('#theme-toggle').onclick = () => {
  const nextTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
  try { localStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch (error) { /* mantém a sessão atual */ }
  applyTheme(nextTheme);
};
$('#logout-button').onclick = () => showLogin('Sessão terminada.');
loadThemePreference();
loadPurchaseProcess();
loadCalferTransactions();
loadENPVReviews();
loadENPVPreviews();
void loadProductionAlerts();
if (alertsSyncTimer) clearInterval(alertsSyncTimer);
alertsSyncTimer = setInterval(() => { if (document.visibilityState !== 'hidden') void syncProductionAlerts(); }, 20000);
startAuthentication();

// Habilita a instalação como PWA quando o dashboard estiver publicado em HTTPS.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => console.info('PWA ativado'))
      .catch(error => console.warn('Não foi possível ativar o PWA.', error));
  });
}
