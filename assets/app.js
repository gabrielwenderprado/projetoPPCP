let DATA = null;
// Snapshot central da programação produtiva; alimenta a primeira tela e o filtro do NIGURI.
let PRODUCTION_MAP = { records: [], summary: {} };
// Controla qual área do dashboard está aberta neste momento.
let view = 'productionMap';
let analyst = 'all';
let family = 'all';
let obtentionType = 'all';
let stockFilter = 'all';
const THEME_STORAGE_KEY = 'pcm-dashboard-theme';
const CHRISTMAS_THEME_STORAGE_KEY = 'pcm-christmas-theme-v1';

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

// Tema natalino temporário: vem ligado por padrão e pode ser alternado no login ou no dashboard.
function applyChristmasTheme(enabled) {
  const active = Boolean(enabled);
  document.body.classList.toggle('christmas-theme', active);
  document.querySelectorAll('.christmas-toggle').forEach(button => {
    const label = button.querySelector('.christmas-toggle-label');
    if (label) label.textContent = active ? 'Natal ativado' : 'Natal desativado';
    button.setAttribute('aria-label', active ? 'Desativar tema natalino' : 'Ativar tema natalino');
    button.title = active ? 'Desativar tema natalino' : 'Ativar tema natalino';
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function loadChristmasThemePreference() {
  let saved = 'on';
  try { saved = localStorage.getItem(CHRISTMAS_THEME_STORAGE_KEY) || 'on'; } catch (error) { /* usa a decoração sazonal como padrão */ }
  applyChristmasTheme(saved !== 'off');
}

function toggleChristmasTheme() {
  const enabled = !document.body.classList.contains('christmas-theme');
  try { localStorage.setItem(CHRISTMAS_THEME_STORAGE_KEY, enabled ? 'on' : 'off'); } catch (error) { /* mantém apenas durante a sessão */ }
  applyChristmasTheme(enabled);
}
// Guarda os filtros selecionados pelo usuário para manter a navegação consistente.
let productionMapQuery = '';
let productionMapStatus = 'all';
let productionMapDateStart = '';
let productionMapDateEnd = '';
let productionMapWeekStart = 'all';
let productionMapWeekEnd = 'all';
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
let stockPlanMonth = '';
let releaseWeekFilter = '';
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
const STOCK_MINIMUMS_STORAGE_KEY = 'pcm-stock-minimums-v1';
let STOCK_MINIMUMS = {};
function loadStockMinimums() {
  try { const saved = JSON.parse(localStorage.getItem(STOCK_MINIMUMS_STORAGE_KEY) || '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; } catch (error) { return {}; }
}
function saveStockMinimums() { try { localStorage.setItem(STOCK_MINIMUMS_STORAGE_KEY, JSON.stringify(STOCK_MINIMUMS)); } catch (error) { console.warn('Não foi possível guardar os mínimos neste computador.', error); } }
function configuredMinimum(item) { const key = String(item?.code || '').trim(); return Object.prototype.hasOwnProperty.call(STOCK_MINIMUMS, key) ? Math.max(0, n(STOCK_MINIMUMS[key])) : Math.max(0, n(item?.safety)); }
function isBelowMinimum(item) { return n(item?.stock) < configuredMinimum(item); }
function setConfiguredMinimum(code, value) { const key = String(code || '').trim(); if (!key) return; if (value === '' || value === null || value === undefined) delete STOCK_MINIMUMS[key]; else { const parsed = Number(value); if (Number.isFinite(parsed) && parsed >= 0) STOCK_MINIMUMS[key] = parsed; } saveStockMinimums(); }
function bindStockMinimumInputs() { document.querySelectorAll('[data-stock-minimum]').forEach(input => { input.onchange = () => { setConfiguredMinimum(input.dataset.stockMinimum, input.value); updateStockMinimumRow(input); }; }); }
// Lista local dos avisos enviados pela produção. Cada navegador mantém o seu histórico offline.
let PRODUCTION_ALERTS = [];
let ALERTS_ENDPOINT = '';
let alertsSyncTimer = null;
const PRODUCTION_ALERTS_STORAGE_KEY = 'pcm-alertas-producao';
// Itens dispensados manualmente em uma EN ficam ocultos somente neste navegador.
const PRODUCTION_DISMISSED_STORAGE_KEY = 'pcm-production-dismissed-items-v1';
let PRODUCTION_DISMISSED_ITEMS = {};

function loadProductionDismissedItems() {
  try {
    const saved = localStorage.getItem(PRODUCTION_DISMISSED_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) { return {}; }
}
function saveProductionDismissedItems() {
  try { localStorage.setItem(PRODUCTION_DISMISSED_STORAGE_KEY, JSON.stringify(PRODUCTION_DISMISSED_ITEMS)); } catch (error) { /* modo privado/armazenamento indisponível */ }
}
function productionDismissKey(en, code) {
  return `${String(en || '').trim().toUpperCase()}::${String(code || '').trim()}`;
}
function isProductionItemDismissed(en, code) {
  return !!PRODUCTION_DISMISSED_ITEMS[productionDismissKey(en, code)];
}
function dismissProductionItem(en, code) {
  const key = productionDismissKey(en, code);
  PRODUCTION_DISMISSED_ITEMS[key] = { en: String(en || '').trim().toUpperCase(), code: String(code || '').trim(), at: new Date().toISOString(), by: currentUser?.name || 'Usuário' };
  saveProductionDismissedItems();
}
function restoreProductionItem(en, code) {
  delete PRODUCTION_DISMISSED_ITEMS[productionDismissKey(en, code)];
  saveProductionDismissedItems();
}

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
  const safety = configuredMinimum(item);
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

// A classificação comprado/fabricado vem do cadastro principal do Estoque.
function isPurchasedMaterial(item) {
  const type = String(item?.obtentionType || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return type === 'comprado' || type.startsWith('comprado ');
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
  return selectedDemand + configuredMinimum(item);
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
  const followUp = hasFollowUpOrder(item, demandLabel || demand);
  const suggested = suggestedPurchase(item, demand, demandLabel);
  if (suggested > 0) return { label: 'Comprar', color: 'red', canBuy: true, hasOrder: false };
  if (followUp) return { label: 'Follow-up', color: 'amber', canBuy: false, hasOrder: true };
  return { label: 'Não comprar', color: 'green', canBuy: false, hasOrder: false };
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

// Calcula a necessidade bruta de compra; a decisão operacional aplica prioridade à sugestão positiva.
function suggestedPurchase(item, demand, demandLabel = '') {
  const totalDemand = demand !== undefined && demand !== null && demand !== ''
    ? n(demand)
    : demandLabel
      ? n(item.demands?.[demandLabel])
      : Object.values(item.demands || {}).reduce((sum, value) => sum + n(value), 0);
  return Math.max(0, totalDemand + configuredMinimum(item) - n(item.stock));
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

function calferSelectedModel(modelName) {
  const list = CALFER.calferModels || [];
  return list.find(model => model.name === modelName) || list[0] || { name: modelName || '—', items: [] };
}
function calferReferenceItem(code) {
  return (CALFER.items || []).find(item => String(item.code) === String(code)) || {};
}
function calferModelItems(modelName) {
  const model = calferSelectedModel(modelName);
  const grouped = new Map();
  (model.items || []).forEach(item => {
    const code = String(item.code || '').trim();
    if (!code) return;
    const existing = grouped.get(code) || { ...item, code, quantityPerMachine: 0 };
    existing.quantityPerMachine += n(item.quantityPerMachine);
    const reference = calferReferenceItem(code);
    existing.nextStock = n(reference.nextStock);
    existing.calferStock = n(item.calferStock);
    existing.description = item.description || reference.description || '';
    grouped.set(code, existing);
  });
  return [...grouped.values()];
}
function calferAvailabilityPlan(modelName, machines) {
  const requested = Math.max(1, Math.floor(n(machines) || 1));
  return calferModelItems(modelName).map(item => {
    const perMachine = n(item.quantityPerMachine);
    const required = perMachine * requested;
    const available = Math.max(0, n(item.calferStock));
    const shortage = Math.max(0, required - available);
    const capacity = perMachine > 0 ? Math.floor(available / perMachine) : 0;
    return { ...item, requested, required, available, shortage, capacity, covered: shortage === 0 };
  });
}
function calferCompleteMachineCapacity(modelName) {
  const rows = calferAvailabilityPlan(modelName, 1);
  const capacities = rows.filter(row => n(row.quantityPerMachine) > 0).map(row => row.capacity);
  return capacities.length ? Math.max(0, Math.min(...capacities)) : 0;
}
function calferRows(plan) {
  return plan.map(row => `<tr><td><b>${esc(row.code)}</b><div class="desc">${esc(row.description || '—')}</div></td><td>${fmt(row.nextStock)}</td><td>${fmt(row.quantityPerMachine)}</td><td>${fmt(row.calferStock)}</td><td>${fmt(row.required)}</td><td class="${row.shortage > 0 ? 'danger-text' : 'success-text'}">${row.shortage > 0 ? `Faltam ${fmt(row.shortage)}` : 'Atende'}</td><td>${fmt(row.capacity)}</td></tr>`).join('');
}
function calferView() {
  const modelNames = [...new Set((CALFER.calferModels || []).map(item => item.name))];
  const active = selectedCalferModel && modelNames.includes(selectedCalferModel) ? selectedCalferModel : (modelNames[0] || '');
  const machines = Math.max(1, Math.floor(n(calferMachineCount) || 1));
  const plan = calferAvailabilityPlan(active, machines);
  const capacity = calferCompleteMachineCapacity(active);
  const missing = plan.filter(row => row.shortage > 0);
  const totalMissing = missing.reduce((sum, row) => sum + row.shortage, 0);
  const model = calferSelectedModel(active);
  return `<div class="view-title"><div><span class="eyebrow">Controle de fornecedor</span><h2>Estoque Calfer</h2><p>Visão consolidada do estoque informado na aba <b>calfer</b>. O estoque Next é exibido somente como referência.</p></div><div class="date-pill">${esc(CALFER.sourceFile || 'aba calfer')}</div></div><div class="pins-model-strip calfer-model-strip">${modelNames.map(name => `<button class="pins-model-card${name === active ? ' selected' : ''}" data-calfer-model="${esc(name)}"><span>Modelo</span><strong>${esc(name)}</strong><small>${name === active ? 'selecionado' : 'consultar capacidade'}</small></button>`).join('')}</div><div class="panel calfer-capacity-panel"><div class="panel-header"><div><h3>${esc(active || 'Modelo não selecionado')}</h3><span>${fmt(model.items?.length || 0)} componentes na estrutura Calfer</span></div><div class="toolbar"><label class="filter-label" for="calfer-machines">Quantidade de máquinas</label><input class="input" id="calfer-machines" type="number" min="1" value="${machines}" style="max-width:120px" /></div></div><div class="summary-strip"><div class="summary-box"><b class="${capacity > 0 ? 'success' : 'danger'}">${fmt(capacity)}</b><span>máquinas completas possíveis</span></div><div class="summary-box"><b>${fmt(machines)}</b><span>máquinas solicitadas</span></div><div class="summary-box"><b class="${missing.length ? 'danger' : 'success'}">${fmt(missing.length)}</b><span>componentes insuficientes</span></div><div class="summary-box"><b class="${totalMissing ? 'danger' : 'success'}">${fmt(totalMissing)}</b><span>peças faltantes</span></div></div></div><div class="panel"><div class="panel-header"><div><h3>Componentes do modelo ${esc(active || '—')}</h3><span>Capacidade calculada pelo menor saldo entre os componentes do estoque Calfer.</span></div></div><div class="table-wrap"><table class="data-table calfer-single-table"><thead><tr><th>Código / descrição</th><th>Estoque Next<br><small>referência</small></th><th>Qtd. por máquina</th><th>Estoque Calfer</th><th>Necessário para ${fmt(machines)}</th><th>Atendimento</th><th>Máquinas possíveis</th></tr></thead><tbody>${calferRows(plan) || '<tr><td colspan="7" class="empty">O modelo não possui componentes na aba calfer.</td></tr>'}</tbody></table></div></div>${missing.length ? `<div class="panel calfer-shortage-panel"><div class="panel-header"><div><h3>O que falta para montar ${fmt(machines)} máquina(s)</h3><span>Itens abaixo do necessário no estoque da Calfer.</span></div></div><div class="detail-list">${missing.map(row => `<div class="detail-list-row detail-overdue"><span><b>${esc(row.code)}</b> · ${esc(row.description || '—')}</span><b>Faltam ${fmt(row.shortage)} · estoque ${fmt(row.available)} / necessário ${fmt(row.required)}</b></div>`).join('')}</div></div>` : `<div class="panel calfer-success-panel"><div class="panel-body"><strong>Estoque suficiente para montar ${fmt(machines)} máquina(s) do modelo ${esc(active)}.</strong></div></div>`}</div>`;
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

function itemRows(items, limit = 200, showDemand = false, offset = 0, demandLabel = '', includeDemand = false, stockPeriod = '') {
  return items.slice(offset, offset + limit).map(item => {
    const totalDemand = Object.values(item.demands || {}).reduce((sum, value) => sum + n(value), 0);
    const periodDemand = includeDemand ? totalDemand : undefined;
    const [riskLabel, riskColor] = risk(item, showDemand ? item.need : periodDemand);
    const decision = procurementDecision(item, showDemand ? item.need : periodDemand, includeDemand ? `DEM ${stockPeriod}` : (showDemand ? demandLabel : ''));
    const label = decision.label === 'Comprar' ? 'Comprar' : riskLabel;
    const color = decision.label === 'Comprar' ? 'red' : riskColor;
    const orders = includeDemand ? orderQuantityForPeriod(item, stockPeriod) : Object.values(item.orders || {}).reduce((sum, value) => sum + n(value), 0);
    const demand = showDemand
      ? `<td>${fmt(item.need || 0)} ${esc(item.unit)}</td><td class="${n(item.balance) < 0 ? 'danger' : ''}">${fmt(item.balance || 0)}</td>`
      : '';
    const stockDemand = includeDemand ? `<td>${fmt(periodDemand)} ${esc(item.unit)}</td>` : '';
    const obtainingType = includeDemand ? `<td>${esc(item.obtentionType || '—')}</td>` : '';
    return `<tr>
      <td><button class="material-code" data-code="${esc(item.code)}" title="Abrir detalhe do material">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td>
      <td>${esc(item.analyst || '—')}</td>
      <td>${fmt(item.stock)} ${esc(item.unit)}</td>
      <td>${fmt(item.stockMax || 0)} ${esc(item.unit)}</td>
      <td><input class="input stock-minimum-input" type="number" min="0" step="any" value="${esc(n(configuredMinimum(item)))}" data-stock-minimum="${esc(item.code)}" aria-label="Estoque mínimo de ${esc(item.code)}" /></td>
      ${obtainingType}
      ${stockDemand}${demand}<td>${fmt(orders)}</td><td><span class="status ${color}">${label}</span>${isBelowMinimum(item) ? '<small class="below-minimum-flag">Abaixo do mínimo</small>' : ''}</td><td>${procurementAction(item, showDemand ? item.need : periodDemand, includeDemand ? `DEM ${stockPeriod}` : (showDemand ? demandLabel : ''))}</td>
    </tr>`;
  }).join('');
}

function updateStockMinimumRow(input) {
  const row = input?.closest('tr');
  const container = input?.closest('[data-progressive-table]');
  const dataset = container ? TABLE_DATASETS.get(container.dataset.progressiveTable) : null;
  const code = String(input?.dataset?.stockMinimum || '').trim();
  const item = dataset?.items.find(entry => String(entry.code || '').trim() === code);
  if (!row || !item || !dataset) return false;
  const holder = document.createElement('tbody');
  holder.innerHTML = itemRows([item], 1, dataset.showDemand, 0, dataset.demandLabel, dataset.includeDemand, dataset.stockPeriod);
  const freshRow = holder.firstElementChild;
  if (!freshRow || freshRow.cells.length !== row.cells.length) return false;
  // Manter intactos o botão do código (o clique pode estar em curso) e o input editado.
  const statusIndex = row.cells.length - 2;
  const purchaseIndex = row.cells.length - 1;
  row.cells[statusIndex].innerHTML = freshRow.cells[statusIndex].innerHTML;
  row.cells[purchaseIndex].innerHTML = freshRow.cells[purchaseIndex].innerHTML;
  input.value = configuredMinimum(item);
  bindPurchaseButtons();
  return true;
}

function table(items, limit = TABLE_CHUNK_SIZE, showDemand = false, demandLabel = '', includeDemand = false, stockPeriod = '') {
  const columns = 8 + (showDemand ? 2 : 0) + (includeDemand ? 2 : 0);
  const id = `progressive-table-${++TABLE_SEQUENCE}`;
  const initialLimit = Math.min(Math.max(Number(limit) || TABLE_CHUNK_SIZE, 50), TABLE_CHUNK_SIZE);
  TABLE_DATASETS.set(id, { items, showDemand, demandLabel, includeDemand, stockPeriod, cursor: initialLimit });
  const rows = itemRows(items, initialLimit, showDemand, 0, demandLabel, includeDemand, stockPeriod);
  const more = items.length > initialLimit ? `<div class="table-load-more"><span>Mostrando ${fmt(initialLimit)} de ${fmt(items.length)} itens</span><button class="secondary-btn table-more-btn" data-table-id="${id}">Carregar mais</button></div>` : `<div class="table-load-more"><span>${fmt(items.length)} itens carregados</span></div>`;
  return `<div class="progressive-table" data-progressive-table="${id}"><div class="table-wrap"><table class="data-table"><thead><tr>
    <th>Material</th><th>Analista</th><th>Estoque</th><th>Estoque máximo</th><th>Estoque mínimo (local)</th>${includeDemand ? '<th>Tipo de obtenção</th>' : ''}${includeDemand ? '<th>Demanda total PLANO MES</th>' : ''}
    ${showDemand ? '<th>Demanda</th><th>Saldo</th>' : ''}<th>${includeDemand ? `Pedido · ${esc(stockPeriod)}` : 'Pedidos'}</th><th>Situação</th><th>Processo de compra</th>
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
        tbody.insertAdjacentHTML('beforeend', itemRows(dataset.items, end - start, dataset.showDemand, start, dataset.demandLabel, dataset.includeDemand, dataset.stockPeriod));
        dataset.cursor = end;
        const label = container.querySelector('.table-load-more span');
        if (label) label.textContent = end < dataset.items.length ? `Mostrando ${fmt(end)} de ${fmt(dataset.items.length)} itens` : `${fmt(end)} itens carregados`;
        if (end < dataset.items.length) button.disabled = false;
        else button.remove();
        bindMaterialButtons();
        bindPurchaseButtons();
        bindStockMinimumInputs();
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

function planMonthPeriods() {
  const plan = DATA?.planMonth || {};
  if (Array.isArray(plan.periods) && plan.periods.length) return plan.periods;
  const months = Array.isArray(plan.months) ? plan.months : [];
  let year = new Date().getFullYear(); let previous = null;
  return months.map(value => {
    const raw = String(value || ''); const match = raw.match(/^(\d{1,2})(?:\/(\d{4}))?$/);
    if (!match) return null;
    const month = Number(match[1]);
    if (match[2]) year = Number(match[2]);
    else if (previous !== null && month < previous) year += 1;
    previous = month;
    return { key: `${String(month).padStart(2, '0')}/${year}`, month: String(month).padStart(2, '0'), year: String(year) };
  }).filter(Boolean);
}

function currentPlanMonthPeriod() {
  const periods = planMonthPeriods();
  const now = new Date(); const current = now.getFullYear() * 100 + now.getMonth() + 1;
  return periods.find(period => Number(period.year) * 100 + Number(period.month) >= current)?.key || periods.at(-1)?.key || '';
}

function planMonthPanel() {
  const plan = DATA.planMonth || { models: [], months: [] };
  const models = plan.models || [];
  const periods = planMonthPeriods();
  const months = periods.map(period => period.key);
  if (!models.length || !months.length) return '<div class="panel"><div class="empty">Plano Mês não disponível neste snapshot.</div></div>';
  const totals = months.map(month => models.reduce((sum, model) => sum + n(model.quantidades?.[month]), 0));
  const max = Math.max(...totals, 1);
  return `<div class="panel plan-month-panel"><div class="panel-header"><div><h3>Plano Mês · produção prevista</h3><span>Quantidade de veículos planeados por mês</span></div><span>Fonte: aba PLANO MES</span></div><div class="panel-body"><div class="plan-month-grid">${months.map((month, index) => `<div class="plan-month-card"><span>${esc(month)}</span><strong>${fmt(totals[index])}</strong><small>veículos</small><div class="bar-track"><div class="bar-fill" style="background:#1b9a82;width:${totals[index] / max * 100}%"></div></div></div>`).join('')}</div><div class="plan-month-table-wrap"><table class="data-table plan-month-table"><thead><tr><th>Modelo</th>${months.map(month => `<th>${esc(month)}</th>`).join('')}</tr></thead><tbody>${models.map(model => `<tr><td><strong>${esc(model.modelo)}</strong></td>${months.map(month => `<td>${fmt(model.quantidades?.[month])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></div>`;
}

function bindMaterialButtons() {
  document.querySelectorAll('.material-code:not(.production-en-btn)').forEach(button => {
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
    <div class="detail-metrics"><div><span>Estoque atual</span><b>${fmt(item.stock)} ${esc(item.unit)}</b></div><div><span>Estoque máximo</span><b>${fmt(item.stockMax || 0)} ${esc(item.unit)}</b></div><div><span>Segurança</span><b>${fmt(configuredMinimum(item))} ${esc(item.unit)}</b></div><div><span>Compra sugerida</span><b class="detail-danger">${fmt(purchase)} ${esc(item.unit)}</b></div><div><span>Analista</span><b>${esc(item.analyst || '—')}</b></div></div>
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
  return items.map(item => `<tr><td><button class="material-code" data-code="${esc(item.code)}">${esc(item.code)}</button><div class="desc">${esc(item.description)}</div></td><td>${esc(item.analyst || '—')}</td><td>${fmt(item.stock)} ${esc(item.unit)}</td><td>${fmt(item.stockMax || 0)} ${esc(item.unit)}</td><td>${item.overdueOrders.map(order => `<span class="overdue-tag">${esc(order.month.replace('PED ', ''))}: ${fmt(order.quantity)} ${esc(item.unit)}</span>`).join(' ')}</td><td><span class="status red">Follow-up necessário</span></td></tr>`).join('');
}

// Renderiza a tela com pedidos de meses anteriores que precisam de acompanhamento.
function followUpView() {
  const items = followUpItems();
  const rows = followUpRows(items);
  return `${filterBar()}<div class="view-title"><div><h2>Pedidos atrasados para acompanhamento</h2><p>Pedidos abertos em meses anteriores ao mês atual. Confirme o status com o time de compras.</p></div><button class="secondary-btn" id="back-to-overview">← Voltar à visão geral</button></div><div class="summary-strip"><div class="summary-box"><b class="danger">${fmt(items.length)}</b><span>Itens para acompanhamento</span></div><div class="summary-box"><b>${esc(currentMonthDate().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</b><span>Mês de referência</span></div></div><div class="panel"><div class="panel-header"><h3>Lista de pedidos atrasados</h3><span>${fmt(items.length)} itens</span></div><div class="panel-body"><div class="toolbar"><input class="input" id="follow-up-search" placeholder="Pesquisar código, descrição ou analista" /></div><div id="follow-up-table"><div class="table-wrap"><table class="data-table"><thead><tr><th>Material</th><th>Analista</th><th>Estoque</th><th>Estoque máximo</th><th>Pedido em atraso</th><th>Situação</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">Nenhum pedido de mês anterior encontrado.</td></tr>'}</tbody></table></div></div></div></div>`;
}

// Formata o valor máximo do eixo vertical sem sobrecarregar o gráfico.
function chartValue(value) {
  const amount = n(value);
  if (amount >= 1000000) return `R$ ${(amount / 1000000).toFixed(1).replace('.', ',')} mi`;
  if (amount >= 1000) return `R$ ${(amount / 1000).toFixed(0)} mil`;
  return money(amount);
}

// Cria um gráfico de barras do valor mensal; a quantidade fica visível na tabela inferior.
function stockHistoryChart() {
  const byMonth = new Map();
  (STOCK_HISTORY.records || []).forEach(record => {
    const key = String(record.date || record.label || '');
    const monthKey = key.match(/^\d{4}-\d{2}/)?.[0] || key;
    byMonth.set(monthKey, record);
  });
  const records = [...byMonth.values()].sort((a, b) => String(a.date || a.label || '').localeCompare(String(b.date || b.label || ''))).slice(-12);
  if (!records.length) return '<div class="empty">Ainda não existe histórico registado.</div>';

  const width = Math.max(900, records.length * 112);
  const height = 320;
  const padding = { top: 42, right: 24, bottom: 58, left: 86 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = records.map(record => n(record.stockValue));
  const counts = records.map(record => n(record.itemCount));
  const maxValue = Math.max(...values, 1);
  const slotWidth = plotWidth / records.length;
  const x = index => padding.left + slotWidth * (index + 0.5);
  const yValue = value => padding.top + plotHeight - (value / maxValue) * plotHeight;
  const grid = [0, 0.5, 1].map(step => {
    const y = padding.top + plotHeight - step * plotHeight;
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="history-grid-line" /><text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" class="history-axis-label">${chartValue(maxValue * step)}</text>`;
  }).join('');
  const bars = records.map((record, index) => {
    const barWidth = Math.min(56, slotWidth * 0.56);
    const barHeight = Math.max(1, plotHeight - (yValue(values[index]) - padding.top));
    const barY = padding.top + plotHeight - barHeight;
    const label = record.label || record.date;
    return `<rect x="${(x(index) - barWidth / 2).toFixed(1)}" y="${barY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="5" class="history-bar"><title>${esc(label)} · ${money(values[index])} · ${fmt(counts[index])} itens</title></rect><text x="${x(index)}" y="${Math.max(16, barY - 8)}" text-anchor="middle" class="history-bar-value-label">${esc(chartValue(values[index]))}</text><text x="${x(index)}" y="${height - 22}" text-anchor="middle" class="history-axis-label">${esc(label)}</text>`;
  }).join('');
  const latest = records[records.length - 1];
  const details = records.map(record => `<tr><td>${esc(record.label || record.date)}</td><td>${money(record.stockValue)}</td><td>${fmt(record.itemCount)}</td></tr>`).join('');
  return `<div class="history-chart-wrap"><div class="history-summary"><div><span>Último valor registado</span><b>${money(latest.stockValue)}</b></div><div><span>Itens no último registo</span><b>${fmt(latest.itemCount)}</b></div><div><span>Registos disponíveis</span><b>${fmt(records.length)}</b></div></div><div class="history-chart-scroll"><svg class="history-chart" style="width:${width}px;max-width:none" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de barras com valor do estoque por mês"><g>${grid}</g>${bars}</svg></div><div class="table-wrap history-values-table-wrap"><table class="data-table"><thead><tr><th>Mês</th><th>Valor do estoque</th><th>Quantidade de materiais</th></tr></thead><tbody>${details}</tbody></table></div></div>`;
}

// Renderiza uma página separada para acompanhar a evolução histórica do estoque.
function stockHistoryView() {
  return `${filterBar()}<div class="view-title"><div><h2>Evolução do estoque</h2><p>Valor total do estoque por mês, com os valores exactos na tabela abaixo.</p></div><div class="date-pill">A partir de ${esc(STOCK_HISTORY.records?.[0]?.label || 'este mês')}</div></div><div class="panel"><div class="panel-header"><h3>Histórico do estoque</h3><span>Atualização mensal</span></div><div class="panel-body">${stockHistoryChart()}</div></div><div class="panel history-help-panel"><div class="panel-header"><h3>Como o histórico cresce</h3></div><div class="panel-body"><p>Cada atualização da planilha acrescenta um registo mensal com a data, o valor total do estoque e a quantidade de materiais.</p><p class="history-note">Se houver mais de um registo no mesmo mês, será exibido o mais recente desse mês.</p></div></div>`;
}

function plannedModelKey(name) {
  const raw = String(name || '').toUpperCase();
  const aliases = [['10S','10S'],['10HDOC','10HDOC'],['15LDDI','15LDDI'],['13,5 AT','13AT'],['13.5 AT','13AT'],['13 69','13-69kv'],['13 LDI','13ldi-46kv'],['16.5T','guin-16T'],['25T','guin-25T'],['45T','guin-45'],['21T','21T'],['30T','30-T'],['12T','12-T'],['7T','7T']];
  const alias = aliases.find(([needle]) => raw.includes(needle.replace('.', ',')) || raw.includes(needle));
  if (alias && DATA?.models?.[alias[1]]) return alias[1];
  const target = raw.replace(/[^A-Z0-9]/g, '');
  return Object.keys(DATA?.models || {}).find(key => { const candidate = String(key).toUpperCase().replace(/[^A-Z0-9]/g, ''); return candidate && (target.includes(candidate) || candidate.includes(target)); }) || '';
}
function annualWeekInfo(value) {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  const weekKey = pinsNiguriWeekKey(date.toISOString().slice(0, 10));
  const thursday = new Date(date); thursday.setDate(thursday.getDate() + (4 - (thursday.getDay() || 7)));
  const week = getWeekNumber(date);
  const year = thursday.getFullYear();
  return { key: weekKey, week, year, label: `Semana ${String(week).padStart(2, '0')} · ${year}` };
}
function releaseRowsForWeek(weekKey) {
  const annualRows = DATA?.planAnnual?.rows || [];
  const grouped = new Map();
  annualRows.forEach(entry => {
    const week = annualWeekInfo(entry.data);
    const en = String(entry.pedido || '').trim().toUpperCase();
    if (!week || week.key !== weekKey || !en || annualRowIsExcluded(entry)) return;
    const key = `${en}::${week.key}`;
    const row = grouped.get(key) || { en, model: entry.modelo || entry.estrutura || '—', client: entry.cliente || '—', week, criticalItems: [], attentionItems: [], forecastItems: [], structureMissing: false };
    const structure = modelNiguriStructureName(row.model);
    const components = structure ? modelNiguriStructureRows(row.model) : [];
    if (!components.length) row.structureMissing = true;
    components.filter(isPurchasedMaterial).forEach(item => {
      const [status] = risk(item, item.quantity);
      if (status !== 'Crítico' && status !== 'Em atenção') return;
      const detail = { code: item.code, description: item.description, unit: item.unit || 'UN', quantity: n(item.quantity), analyst: item.analyst || 'Não informado', obtentionType: item.obtentionType, hasOrder: hasOpenOrder(item), orders: item.orders || {} };
      const target = status === 'Crítico' ? row.criticalItems : row.attentionItems;
      if (!target.some(existing => existing.code === detail.code)) target.push(detail);
      if (detail.hasOrder && !row.forecastItems.some(existing => existing.code === detail.code)) row.forecastItems.push(detail);
    });
    grouped.set(key, row);
  });
  return [...grouped.values()].sort((a, b) => a.week.key.localeCompare(b.week.key) || a.en.localeCompare(b.en));
}
function releaseWeekOptions() {
  const options = new Map();
  (DATA?.planAnnual?.rows || []).forEach(row => { const info = annualWeekInfo(row.data); if (info) options.set(info.key, info); });
  return [...options.values()].sort((a, b) => a.key.localeCompare(b.key));
}
function releaseItemText(item) { return `${item.code} — ${item.description} (Analista: ${item.analyst || 'Não informado'})`; }
function releaseItemList(items, className) {
  return items.length ? `<ul class="release-item-list ${className}">${items.map(item => `<li><strong>${esc(item.code)}</strong><span>${esc(item.description)} · Analista: ${esc(item.analyst || 'Não informado')}</span></li>`).join('')}</ul>` : '<span class="release-none">—</span>';
}
function releaseCurrentRows() {
  const options = releaseWeekOptions();
  if (!options.length) return { options, selected: '', rows: [] };
  const selected = options.some(option => option.key === releaseWeekFilter) ? releaseWeekFilter : (options.find(option => option.key >= pinsNiguriCurrentWeekKey()) || options[0]).key;
  releaseWeekFilter = selected;
  return { options, selected, rows: releaseRowsForWeek(selected) };
}
async function exportReleaseWeekXlsx() {
  const { options, selected, rows } = releaseCurrentRows();
  const info = options.find(option => option.key === selected);
  const exportRows = rows;
  if (!window.ExcelJS) { alert('A biblioteca de exportação Excel não carregou. Recarregue o painel e tente novamente.'); return; }
  const workbook = new window.ExcelJS.Workbook();
  workbook.creator = 'PCP Next'; workbook.subject = `Carros a liberar · ${info?.label || 'semana'}`; workbook.title = 'Carros a liberar — itens críticos';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Carros a liberar', { views: [{ state: 'frozen', ySplit: 4 }] });
  sheet.columns = [
    { header: 'EN', key: 'en', width: 16 }, { header: 'Modelo', key: 'model', width: 23 },
    { header: 'Cliente', key: 'client', width: 30 }, { header: 'Semana', key: 'week', width: 18 },
    { header: 'Itens críticos', key: 'critical', width: 58 }, { header: 'Previsão de pedido', key: 'forecast', width: 25 }
  ];
  sheet.mergeCells('A1:F1'); sheet.getCell('A1').value = 'CARROS A LIBERAR · ITENS CRÍTICOS';
  sheet.getCell('A1').font = { name: 'Aptos Display', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102847' } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' }; sheet.getRow(1).height = 32;
  sheet.mergeCells('A2:F2'); sheet.getCell('A2').value = `${info?.label || 'Semana não definida'}  |  ${exportRows.length} EN(s)  |  Exportado em ${new Date().toLocaleDateString('pt-BR')}`;
  sheet.getCell('A2').font = { name: 'Aptos', size: 10, color: { argb: 'FF526579' }, italic: true };
  sheet.getCell('A2').alignment = { vertical: 'middle' }; sheet.getRow(2).height = 23;
  sheet.mergeCells('A3:F3'); sheet.getCell('A3').value = 'Inclui todas as ENs da semana. A coluna de materiais lista itens críticos (estoque insuficiente ou zero); quando não houver, indica “Sem crítico”.';
  sheet.getCell('A3').font = { name: 'Aptos', size: 9, color: { argb: 'FF526579' } };
  sheet.getCell('A3').alignment = { wrapText: true, vertical: 'middle' }; sheet.getRow(3).height = 28;
  const headers = ['EN', 'Modelo', 'Cliente', 'Semana', 'Itens críticos', 'Previsão de pedido'];
  const header = sheet.getRow(4); header.values = headers; header.height = 28;
  header.eachCell(cell => { cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1769A6' } }; cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; cell.border = { bottom: { style: 'medium', color: { argb: 'FF0D4975' } } }; });
  exportRows.forEach((row, index) => {
    const criticalForecastItems = row.criticalItems.filter(item => item.hasOrder);
    const forecast = !row.criticalItems.length ? 'Sem item crítico' : criticalForecastItems.length ? `Tem pedido (${criticalForecastItems.length} item(ns) crítico(s))` : 'Sem pedido para os itens críticos';
    const values = [row.en, row.model, row.client, row.week.label, row.criticalItems.map(releaseItemText).join('\n') || 'Sem crítico', forecast];
    const excelRow = sheet.addRow(values); excelRow.height = Math.max(30, Math.min(120, 20 + row.criticalItems.length * 18));
    excelRow.eachCell(cell => { cell.font = { name: 'Aptos', size: 10, color: { argb: 'FF24364B' } }; cell.alignment = { vertical: 'top', wrapText: true }; cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE5EF' } } }; if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } }; });
    excelRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: row.criticalItems.length ? { argb: 'FFFFE2D5' } : { argb: 'FFE5F5EB' } };
    excelRow.getCell(5).font = { name: 'Aptos', size: 10, color: { argb: row.criticalItems.length ? 'FF9B2618' : 'FF176442' }, bold: !!row.criticalItems.length };
    excelRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: criticalForecastItems.length ? { argb: 'FFFFF1C9' } : { argb: 'FFE5F5EB' } };
    excelRow.getCell(6).font = { name: 'Aptos', size: 10, bold: true, color: { argb: criticalForecastItems.length ? 'FF805A00' : 'FF176442' } };
  });
  if (!exportRows.length) {
    sheet.mergeCells('A5:F5'); sheet.getCell('A5').value = 'Nenhuma EN prevista nesta semana.';
    sheet.getCell('A5').font = { name: 'Aptos', size: 11, color: { argb: 'FF526579' }, italic: true };
    sheet.getCell('A5').alignment = { vertical: 'middle', horizontal: 'center' }; sheet.getRow(5).height = 28;
  }
  sheet.autoFilter = { from: 'A4', to: `F${Math.max(4, 4 + exportRows.length)}` };
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 } };
  sheet.headerFooter.oddFooter = '&LPCP Next&CConfidencial&R&P / &N';
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  const weekFile = (info?.label || 'semana').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  link.href = url; link.download = `carros-a-liberar-${weekFile}-${new Date().toISOString().slice(0, 10)}.xlsx`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function programacaoAlertPanel() {
  const { options, selected, rows } = releaseCurrentRows();
  const weekInfo = options.find(option => option.key === selected);
  const criticalCount = rows.reduce((sum, row) => sum + row.criticalItems.length, 0);
  const attentionCount = rows.reduce((sum, row) => sum + row.attentionItems.length, 0);
  const optionHtml = options.map(option => `<option value="${esc(option.key)}" ${option.key === selected ? 'selected' : ''}>${esc(option.label)}</option>`).join('') || '<option value="">Sem semanas no Plano Anual</option>';
  const tableRows = rows.map(row => {
    const forecast = row.structureMissing ? 'Estrutura indisponível' : row.forecastItems.length ? 'Tem pedido em aberto' : 'Sem pedido em aberto';
    const forecastClass = row.structureMissing ? 'muted' : row.forecastItems.length ? 'attention' : 'good';
    return `<tr><td><strong>${esc(row.en)}</strong></td><td>${esc(row.model)}</td><td>${esc(row.client)}</td><td>${esc(row.week.label)}</td><td>${releaseItemList(row.criticalItems, 'critical-list')}</td><td>${releaseItemList(row.attentionItems, 'attention-list')}</td><td><span class="release-forecast ${forecastClass}" title="${esc(row.forecastItems.map(item => `${item.code} · ${Object.entries(item.orders).filter(([, value]) => n(value) > 0).map(([month]) => month).join(', ')}`).join('\n'))}">${forecast}</span></td></tr>`;
  }).join('');
  const cards = rows.map(row => `<article class="release-mobile-card"><div class="release-mobile-card-head"><strong>${esc(row.en)}</strong><span class="release-week-pill">${esc(row.week.label)}</span></div><div class="release-mobile-model">${esc(row.model)} · ${esc(row.client)}</div><div class="release-mobile-block critical-list"><b>Itens críticos</b>${releaseItemList(row.criticalItems, 'critical-list')}</div><div class="release-mobile-block attention-list"><b>Itens em atenção</b>${releaseItemList(row.attentionItems, 'attention-list')}</div><div class="release-mobile-forecast"><b>Previsão</b><span>${row.structureMissing ? 'Estrutura não encontrada' : row.forecastItems.length ? 'Tem pedido em aberto' : 'Sem pedido em aberto'}</span></div></article>`).join('');
  return `<div class="panel programacao-alert-panel"><div class="panel-header"><div><span class="eyebrow">Liberação programada</span><h3>Visão geral · carros a liberar</h3><span>Fonte: PLANO ANUAL · datas previstas da coluna D</span></div><span class="date-pill">${fmt(rows.length)} ENs · ${esc(weekInfo?.label || 'semana')}</span></div><div class="panel-body"><div class="release-week-toolbar"><label for="release-week-filter">Semana do Plano Anual</label><select class="select" id="release-week-filter">${optionHtml}</select><button class="primary-btn release-export-btn" id="export-release-week" type="button">Exportar semana (.xlsx)</button></div><div class="release-week-summary"><span><b class="danger-text">${fmt(criticalCount)}</b> itens críticos</span><span><b class="attention-text">${fmt(attentionCount)}</b> itens em atenção</span><span>${fmt(rows.filter(row => row.forecastItems.length).length)} EN(s) com pedido para item em risco</span></div><div class="release-table-wrap"><table class="data-table release-table"><thead><tr><th>EN</th><th>Modelo</th><th>Cliente</th><th>Semana</th><th>Itens críticos</th><th>Itens em atenção</th><th>Previsão de pedido</th></tr></thead><tbody>${tableRows || '<tr><td colspan="7" class="empty">Nenhuma EN prevista para esta semana.</td></tr>'}</tbody></table></div><div class="release-mobile-list">${cards || '<div class="empty">Nenhuma EN prevista para esta semana.</div>'}</div><p class="release-method-note">O Excel mantém todas as ENs da semana e os materiais críticos; quando não há itens críticos, mostra “Sem crítico”. Os itens em atenção permanecem visíveis no painel, mas não são exportados.</p></div></div>`;
}
function productionStatusExcluded(value) {
  const status = String(value || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return status === 'ENTREGUE' || status === 'VITRINI' || status === 'VITRINE';
}
function productionRecordByEN(en) {
  const key = String(en || '').trim().toUpperCase();
  return (PRODUCTION_MAP.records || []).find(row => String(row.en || '').trim().toUpperCase() === key) || null;
}
function productionENExcludedFromNiguri(en) {
  const row = productionRecordByEN(en);
  return !!row && productionStatusExcluded(row.productionStatusNormalized || row.productionStatus);
}
function productionMapStatusClass(status) {
  const s = String(status || '').toUpperCase();
  return productionStatusExcluded(status) ? 'status gray' : s === 'EM PRODUÇÃO' ? 'status green' : s === 'PROJETO' ? 'status blue' : s === 'ARRANJO' ? 'status amber' : s === 'CANCELADO' ? 'status red' : 'status purple';
}
function productionMapStages(row) {
  const stages = row.stages || [];
  return `<div class="production-stage-list">${stages.map(stage => `<span class="production-stage-chip ${stage.completed ? 'done' : 'pending'}"><i class="production-stage-dot ${stage.completed ? 'done' : 'pending'}"></i>${esc(stage.name)}</span>`).join('')}</div>`;
}
function productionMapDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date;
}
function productionMapLate(row) {
  const finalDate = productionMapDate(productionMapScheduleDate(row));
  return !!finalDate && finalDate < new Date() && !productionStatusExcluded(row.productionStatus);
}
function productionMapWeekNumber(value) {
  const match = String(value || '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}
function productionMapWeekOptions() {
  return [...new Set((PRODUCTION_MAP.records || []).map(row => row.week).filter(Boolean))].sort((a, b) => (productionMapWeekNumber(a) || 0) - (productionMapWeekNumber(b) || 0));
}
function productionMapModelForEN(row) {
  const plan = (DATA?.planAnnual?.rows || []).find(item => String(item.pedido || '').trim().toUpperCase() === String(row.en || '').trim().toUpperCase());
  if (plan?.modelo && DATA?.models?.[plan.modelo]) return plan.modelo;
  const raw = String(plan?.modelo || row.model || '').trim();
  const candidate = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const exact = Object.keys(DATA?.models || {}).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === candidate);
  if (exact) return exact;
  const sky = raw.match(/(?:skycity|skyritz)?\s*(\d{1,2})\s*([a-z]{1,4})/i);
  if (sky) {
    const compact = `${sky[1]}${sky[2]}`.toLowerCase();
    const alias = Object.keys(DATA?.models || {}).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === compact || key.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(compact));
    if (alias) return alias;
  }
  return plan?.modelo || '';
}
function productionMapOrderForMonth(item, row) {
  const orders = item?.orders || {};
  const finalDate = String(row?.finalDate || row?.date || '').slice(0, 10);
  const dateMatch = finalDate.match(/^(\d{4})-(\d{2})-/);
  const monthMatch = String(row?.month || '').match(/(\d{1,2})/);
  const month = monthMatch ? String(Number(monthMatch[1])).padStart(2, '0') : '';
  const year = dateMatch ? dateMatch[1] : '';
  const candidates = [];
  if (month && year) candidates.push(`PED ${month}/${year}`);
  if (month) candidates.push(`PED ${month}`);
  const exactKey = Object.keys(orders).find(key => candidates.some(candidate => String(key).trim().toUpperCase() === candidate));
  if (exactKey) return { key: exactKey, quantity: n(orders[exactKey]) };
  // Compatibilidade com chaves antigas ou planilhas que trazem espaços/ano em formatos diferentes.
  const fallback = Object.keys(orders).find(key => {
    const normalized = String(key).toUpperCase().replace(/\s+/g, '');
    return month && (normalized === `PED${month}` || (year && normalized === `PED${month}/${year}`));
  });
  return fallback ? { key: fallback, quantity: n(orders[fallback]) } : { key: candidates[0] || '', quantity: 0 };
}
function productionMapStagesComplete(row) {
  const stages = Array.isArray(row?.stages) ? row.stages : [];
  const requiredNames = ['montagem final', 'maquina', 'integracao'];
  if (!stages.length || !stages.every(stage => stage.completed === true)) return false;
  return requiredNames.every(name => stages.some(stage => String(stage.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(name) && stage.completed === true));
}
function productionMapPlanRow(row) {
  const en = String(row?.en || '').trim().toUpperCase();
  return (DATA?.planAnnual?.rows || []).find(item => String(item.pedido || '').trim().toUpperCase() === en) || null;
}
function productionMapIsoWeekDate(week, year) {
  const weekNo = productionMapWeekNumber(week);
  if (!weekNo || !year) return null;
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (weekNo - 1) * 7);
  return monday.toISOString().slice(0, 10);
}
function productionMapScheduleDate(row) {
  const plan = productionMapPlanRow(row);
  const planDate = String(plan?.data || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(planDate)) return planDate;
  const finalDate = String(row?.finalDate || row?.date || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) return finalDate;
  const annualYear = String(plan?.mes || '').match(/(20\d{2})/)?.[1];
  const fallbackYear = annualYear || String(new Date().getFullYear());
  return productionMapIsoWeekDate(row?.week, fallbackYear);
}
function productionMapMissingItems(row) {
  if (!row || productionStatusExcluded(row.productionStatusNormalized || row.productionStatus) || productionMapStagesComplete(row)) return [];
  const schedule = (PRODUCTION_MAP.records || []).filter(candidate => !productionStatusExcluded(candidate.productionStatusNormalized || candidate.productionStatus) && !productionMapStagesComplete(candidate));
  schedule.sort((a, b) => {
    const da = productionMapScheduleDate(a) || '9999-12-31'; const db = productionMapScheduleDate(b) || '9999-12-31';
    return da.localeCompare(db) || String(a.week || '').localeCompare(String(b.week || ''), 'pt-BR') || String(a.en || '').localeCompare(String(b.en || ''));
  });
  const targetEN = String(row.en || '').trim().toUpperCase();
  const targetStructure = DATA?.models?.[productionMapModelForEN(row)] || [];
  const targetCodes = new Set(targetStructure.map(component => String(component?.code || '').trim()).filter(Boolean));
  const balances = new Map(); const seenReceipts = new Set(); let targetMissing = [];
  schedule.forEach(candidate => {
    const model = productionMapModelForEN(candidate);
    const components = DATA?.models?.[model] || [];
    const needs = new Map();
    components.forEach(component => { const code = String(component?.code || '').trim(); if (code) needs.set(code, n(needs.get(code)) + n(component.quantity)); });
    const date = productionMapScheduleDate(candidate) || '';
    const period = date ? `${date.slice(5,7)}/${date.slice(0,4)}` : `S${productionMapWeekNumber(candidate.week) || ''}/${new Date().getFullYear()}`;
    const currentNeeds = [];
    needs.forEach((required, code) => {
      if (!targetCodes.has(code)) return;
      const item = itemByCode(code) || { code, description: components.find(component => String(component.code) === code)?.description || '', stock: 0, orders: {}, unit: 'UN' };
      if (!balances.has(code)) balances.set(code, n(item.stock));
      const receiptKey = `${code}::${period}`;
      let order = 0; let orderMonth = 'pedidos abertos';
      if (!seenReceipts.has(receiptKey)) { const info = productionMapOrderForMonth(item, { ...candidate, finalDate: date, month: date ? Number(date.slice(5,7)) : candidate.month }); order = info.quantity; orderMonth = info.key || orderMonth; balances.set(code, balances.get(code) + order); seenReceipts.add(receiptKey); }
      currentNeeds.push({ item, code, required, order, orderMonth, before: balances.get(code), period });
    });
    currentNeeds.forEach(entry => {
      const balanceWithOrder = entry.before - entry.required;
      if (String(candidate.en || '').trim().toUpperCase() === targetEN && entry.before < entry.required) targetMissing.push({ ...entry.item, required: entry.required, stock: n(entry.item.stock), order: entry.order, orderMonth: entry.orderMonth, balanceNow: n(entry.item.stock) - entry.required, balanceWithOrder, covered: balanceWithOrder >= 0, missing: true });
      balances.set(entry.code, balanceWithOrder);
    });
  });
  return targetMissing.filter(item => isPurchasedMaterial(item) && !isProductionItemDismissed(row.en, item.code)).sort((a,b) => a.balanceWithOrder-b.balanceWithOrder);
}
function openProductionMapDetail(en) {
  const row = productionRecordByEN(en);
  if (!row) return;
  const structuralModel = productionMapModelForEN(row);
  const missing = productionMapMissingItems(row);
  const dismissedForEN = Object.values(PRODUCTION_DISMISSED_ITEMS).filter(item => item.en === String(row.en || '').trim().toUpperCase());
  const covered = missing.filter(item => item.covered).length;
  const uncovered = missing.length - covered;
  const finalDate = productionMapDate(productionMapScheduleDate(row));
  const late = productionMapLate(row);
  const stages = row.stages || [];
  const overlay = document.createElement('div');
  overlay.className = 'detail-overlay production-map-detail-overlay';
  overlay.innerHTML = `<section class="material-detail production-map-detail" role="dialog" aria-modal="true"><div class="material-detail-header"><div><span class="eyebrow">Mapa produtivo · detalhe da EN</span><h2>${esc(row.en)}</h2><p>${esc(row.client || 'Cliente não informado')} · ${esc(row.model || 'Modelo não informado')}</p></div><button class="icon-btn" id="close-production-map-detail">×</button></div><div class="production-map-detail-body"><div class="production-map-detail-meta"><div><span>PV / PL</span><b>${esc(row.pv || '—')} / ${esc(row.pl || '—')}</b></div><div><span>Modelo estrutural</span><b>${esc(structuralModel || 'Não identificado')}</b></div><div><span>Data final</span><b class="${late ? 'production-late-text' : ''}">${esc(row.finalDate || '—')}${late ? ' · ATRASADO' : ''}</b></div><div><span>Semana / mês</span><b>${esc(row.week || '—')} · ${esc(row.month || '—')}</b></div><div><span>Status</span><b><span class="${productionMapStatusClass(row.productionStatus)}">${esc(row.productionStatus || 'SEM STATUS')}</span></b></div><div><span>Itens faltantes</span><b>${fmt(missing.length)} · ${fmt(covered)} cobertos / ${fmt(uncovered)} sem cobertura</b></div></div><div class="production-map-detail-section"><h3>Etapas produtivas</h3><div class="production-stage-detail-grid">${stages.map(stage => `<div class="production-stage-detail ${stage.completed ? 'done' : 'pending'}"><i class="production-stage-dot ${stage.completed ? 'done' : 'pending'}"></i><div><b>${esc(stage.name)}</b><small>${stage.completed ? `Concluída${stage.statusValue ? ` · ${esc(stage.statusValue)}` : ''}` : 'Pendente'}</small></div></div>`).join('')}</div></div><div class="production-map-detail-section"><div class="production-map-detail-title"><div><h3>Itens faltantes e atendimento</h3><p>Comparação da estrutura com estoque e pedido previsto para o mês da entrega. Itens removidos ficam ocultos somente para esta EN neste navegador.</p></div>${dismissedForEN.length ? `<button class="secondary-btn production-restore-items-btn" id="restore-production-items">Restaurar removidos (${fmt(dismissedForEN.length)})</button>` : ''}<span class="status ${uncovered ? 'red' : 'green'}">${uncovered ? `${fmt(uncovered)} sem cobertura` : 'Pedidos cobrem a falta'}</span></div><div class="table-wrap"><table class="data-table production-missing-table"><thead><tr><th>Código / descrição</th><th>Necessidade</th><th>Estoque</th><th>Pedido no mês</th><th>Saldo após pedido</th><th>Atende a data?</th><th>Ação</th></tr></thead><tbody>${missing.map(item => `<tr><td><b>${esc(item.code)}</b><div class="desc">${esc(item.description || '—')}</div></td><td>${fmt(item.required)} ${esc(item.unit || 'UN')}</td><td>${fmt(item.stock)}</td><td>${fmt(item.order)}<div class="desc">${esc(item.orderMonth || 'pedidos abertos')}</div></td><td class="${item.balanceWithOrder < 0 ? 'danger-text' : 'attention-text'}">${fmt(item.balanceWithOrder)}</td><td><span class="status ${item.covered ? 'green' : 'red'}">${item.covered ? 'Sim' : 'Não'}</span></td><td><button type="button" class="secondary-btn production-dismiss-item" data-production-dismiss-en="${esc(row.en)}" data-production-dismiss-code="${esc(item.code)}" title="Remover este item somente desta análise">Remover</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Nenhum item faltante: estoque atual cobre a estrutura.</td></tr>'}</tbody></table></div></div></div><div class="detail-footer"><span>${late ? 'Atenção: esta EN está atrasada.' : 'Prazo conforme mapa produtivo.'}</span><button class="secondary-btn" id="close-production-map-detail-bottom">Fechar</button></div></section>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  $('#close-production-map-detail').onclick = close;
  $('#close-production-map-detail-bottom').onclick = close;
  document.querySelectorAll('[data-production-dismiss-en]').forEach(button => button.onclick = () => {
    dismissProductionItem(button.dataset.productionDismissEn, button.dataset.productionDismissCode);
    close();
    openProductionMapDetail(button.dataset.productionDismissEn);
  });
  const restore = $('#restore-production-items');
  if (restore) restore.onclick = () => {
    Object.keys(PRODUCTION_DISMISSED_ITEMS).forEach(key => { if (PRODUCTION_DISMISSED_ITEMS[key]?.en === String(row.en || '').trim().toUpperCase()) delete PRODUCTION_DISMISSED_ITEMS[key]; });
    saveProductionDismissedItems();
    close();
    openProductionMapDetail(row.en);
  };
  overlay.onclick = event => { if (event.target === overlay) close(); };
}
function productionMapView() {
  const weekStartNumber = productionMapWeekStart === 'all' ? null : productionMapWeekNumber(productionMapWeekStart);
  const weekEndNumber = productionMapWeekEnd === 'all' ? null : productionMapWeekNumber(productionMapWeekEnd);
  const startDate = productionMapDate(productionMapDateStart);
  const endDate = productionMapDate(productionMapDateEnd);
  const records = (PRODUCTION_MAP.records || []).filter(row => {
    const textMatch = !productionMapQuery || `${row.en} ${row.pv || ''} ${row.client || ''} ${row.model || ''}`.toLowerCase().includes(productionMapQuery.toLowerCase());
    const statusMatch = productionMapStatus === 'all' || String(row.productionStatus || '') === productionMapStatus;
    const rowDate = productionMapDate(productionMapScheduleDate(row));
    const dateMatch = (!startDate || (rowDate && rowDate >= startDate)) && (!endDate || (rowDate && rowDate <= endDate));
    const rowWeek = productionMapWeekNumber(row.week);
    const weekMatch = (!weekStartNumber || (rowWeek !== null && rowWeek >= weekStartNumber)) && (!weekEndNumber || (rowWeek !== null && rowWeek <= weekEndNumber));
    return textMatch && statusMatch && dateMatch && weekMatch;
  });
  const summary = PRODUCTION_MAP.summary || {};
  const statusCounts = records.reduce((counts, row) => { const key = String(row.productionStatus || 'SEM STATUS'); counts[key] = (counts[key] || 0) + 1; return counts; }, {});
  const deliveredCount = (statusCounts.ENTREGUE || 0) + (statusCounts.VITRINE || 0) + (statusCounts.VITRINI || 0);
  const lateCount = records.filter(productionMapLate).length;
  const pendingCount = (statusCounts.ARRANJO || 0) + (statusCounts.COMERCIAL || 0);
  const rows = records.slice(0, 250).map(row => `<tr class="production-map-row" data-production-row-text="${esc(`${row.en || ''} ${row.pv || ''} ${row.client || ''} ${row.model || ''}`.toLowerCase())}"><td><button class="material-code production-en-btn" data-production-en="${esc(row.en)}">${esc(row.en)}</button><div class="desc">${esc(row.pv || 'PV não informado')} · ${esc(row.pl || 'PL não informado')}</div></td><td><strong>${esc(row.client || '—')}</strong><div class="desc">${esc(row.model || '—')}</div></td><td><div class="production-stage-dots">${productionMapStages(row)}</div></td><td><span class="${productionMapStatusClass(row.productionStatus)}">${esc(row.productionStatus || 'SEM STATUS')}</span></td><td>${esc(productionMapScheduleDate(row) || '—')}</td><td>${esc(row.week || '—')}</td></tr>`).join('');
  return `<div class="view-title production-map-heading"><div><span class="eyebrow">Planejamento produtivo integrado</span><h2>Mapa produtivo</h2><p>Programação por EN, etapas concluídas, prazo final e status do carro.</p></div><div class="date-pill">${fmt(summary.totalENs || records.length)} ENs · fonte: ${esc(PRODUCTION_MAP.sourceFile || 'planejamento produtivo')}</div></div><div class="production-map-metrics"><div class="metric"><span>Total de ENs</span><b>${fmt(summary.totalENs || 0)}</b></div><div class="metric green"><span>Em produção</span><b>${fmt(statusCounts['EM PRODUÇÃO'] || 0)}</b></div><div class="metric blue"><span>Em projeto</span><b>${fmt(statusCounts.PROJETO || 0)}</b></div><div class="metric amber"><span>Arranjo</span><b>${fmt(statusCounts.ARRANJO || 0)}</b></div><div class="metric purple"><span>Comercial</span><b>${fmt(statusCounts.COMERCIAL || 0)}</b></div><div class="metric gray"><span>Entregues</span><b>${fmt(deliveredCount)}</b><small>visíveis no mapa</small></div><div class="metric red"><span>Atrasados</span><b>${fmt(lateCount)}</b><small>prazo final vencido</small></div><div class="metric amber"><span>Arranjo/Comercial</span><b>${fmt(pendingCount)}</b><small>com pendência</small></div></div><div class="panel production-map-panel"><div class="toolbar production-map-filters"><input class="input" id="production-map-search" value="${esc(productionMapQuery)}" placeholder="Pesquisar EN, PV, cliente ou modelo" /><select class="select" id="production-map-status"><option value="all">Todos os status</option>${Object.keys(statusCounts).map(status => `<option value="${esc(status)}" ${productionMapStatus === status ? 'selected' : ''}>${esc(status)}</option>`).join('')}</select><label class="production-map-filter-field">Data inicial<input class="input" id="production-map-date-start" type="date" value="${esc(productionMapDateStart)}" /></label><label class="production-map-filter-field">Data final<input class="input" id="production-map-date-end" type="date" value="${esc(productionMapDateEnd)}" /></label><label class="production-map-filter-field">Semana inicial<select class="select" id="production-map-week-start"><option value="all">Todas</option>${productionMapWeekOptions().map(week => `<option value="${esc(week)}" ${productionMapWeekStart === week ? 'selected' : ''}>${esc(week)}</option>`).join('')}</select></label><label class="production-map-filter-field">Semana final<select class="select" id="production-map-week-end"><option value="all">Todas</option>${productionMapWeekOptions().map(week => `<option value="${esc(week)}" ${productionMapWeekEnd === week ? 'selected' : ''}>${esc(week)}</option>`).join('')}</select></label><button class="secondary-btn production-map-clear" id="production-map-clear-filters">Limpar filtros</button><span class="production-map-count" id="production-map-count">${fmt(records.length)} registros encontrados</span></div><div class="table-wrap"><table class="data-table production-map-table"><thead><tr><th>EN / PV</th><th>Cliente / modelo</th><th>Etapas produtivas</th><th>Status</th><th>Data final</th><th>Semana</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">Nenhuma EN encontrada.</td></tr>'}</tbody></table></div><div class="production-map-legend"><span><i class="production-stage-dot done"></i> etapa concluída</span><span><i class="production-stage-dot pending"></i> etapa pendente</span><span>Clique na EN para ver etapas, itens faltantes, pedidos e cobertura da data.</span></div></div>`;
}
function overview() {
  const base = scopedItems();
  const attention = base.filter(item => risk(item)[0] !== 'Regular').length;
  const regular = base.length - attention;
  const stockValue = base.reduce((sum, item) => sum + n(item.stockValue), 0);
  return `${filterBar()}${metrics()}<div class="dashboard-grid">${riskChart()}${orderPanel()}</div>${planMonthPanel()}${programacaoAlertPanel()}`;
}

function stockView() {
  const periods = planMonthPeriods();
  const selected = periods.some(period => period.key === stockPlanMonth) ? stockPlanMonth : currentPlanMonthPeriod();
  stockPlanMonth = selected;
  const unmatched = DATA.planMonthUnmatchedModels || [];
  const warning = unmatched.length ? `<p class="history-note stock-plan-warning">Sem estrutura correspondente no Excel; não foi possível calcular demanda para: ${unmatched.map(esc).join(', ')}.</p>` : '';
  return `${filterBar()}<div class="view-title"><div><h2>Estoque</h2><p>Demanda total acumulada pelas estruturas × produção da aba PLANO MES; selecione o mês dos pedidos em aberto.</p></div></div><div class="panel"><div class="panel-body"><div class="toolbar"><label class="filter-label" for="stock-plan-month">Mês dos pedidos:</label><select class="select" id="stock-plan-month">${periods.map(period => `<option value="${esc(period.key)}" ${period.key === selected ? 'selected' : ''}>${esc(period.key)}</option>`).join('')}</select><input class="input" id="stock-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="stock-risk"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regular</option></select></div>${warning}<div id="stock-table">${table(scopedItems(), 250, false, '', true, selected)}</div></div></div>`;
}

function ordersItemsForMonth(base, month) {
  return (base || []).map(item => ({ ...item, need: n(item.demands?.[month]), balance: n(item.stock) - n(item.demands?.[month]) })).filter(item => n(item.need) > 0).sort((a, b) => a.balance - b.balance);
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
  return rows.map(row => `<tr class="excess-row"><td><button class="material-code excess-code" data-excess-code="${esc(row.code)}" data-excess-month="${esc(row.orderMonth)}">${esc(row.code)}</button><div class="desc">${esc(row.description)}</div></td><td>${fmt(row.stock)} ${esc(row.unit)}</td><td>${fmt(row.demand)} ${esc(row.unit)}</td><td>${fmt(row.order)} ${esc(row.unit)}</td><td class="danger-text">${fmt(row.excess)} ${esc(row.unit)}</td><td>${esc(row.label)}</td><td><span class="status amber">Follow-up</span></td></tr>`).join('');
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
  return `${filterBar()}<div class="view-title"><div><h2>Pedidos em excesso</h2><p>Comparação exata entre pedido e demanda do próprio mês.</p></div><div class="date-pill">Follow-up com Compras</div></div><div class="toolbar"><label class="filter-label">Mês:</label><select class="select" id="excess-month"><option value="all">Todos os meses</option>${excessMonthPairs().map(pair => `<option value="${esc(pair.orderMonth)}" ${excessMonth === pair.orderMonth ? 'selected' : ''}>${esc(pair.label)}</option>`).join('')} </select><input class="input" id="excess-search" placeholder="Pesquisar código ou descrição" /></div><div class="summary-strip"><div class="summary-box"><b class="danger">${fmt(rows.length)}</b><span>Excessos mensais</span></div><div class="summary-box"><b>${fmt(new Set(rows.map(row => row.code)).size)}</b><span>Materiais para verificar</span></div><div class="summary-box"><b>${fmt(rows.reduce((sum, row) => sum + row.excess, 0))}</b><span>Unidades em excesso</span></div></div><div class="panel"><div class="panel-header"><h3>Pedidos acima da demanda do mês</h3><span>Clique no código para abrir os próximos meses</span></div><div class="table-wrap"><table class="data-table excess-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Demanda</th><th>Pedido</th><th>Excesso</th><th>Mês</th><th>Follow-up</th></tr></thead><tbody id="excess-table-body">${excessRows(rows) || '<tr><td colspan="8" class="empty">Nenhum pedido acima da demanda mensal.</td></tr>'}</tbody></table></div></div>`;
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
    return `<tr><td><button class="material-code simulation-code" data-sim-code="${esc(row.code)}" title="Ver em quais modelos este código é utilizado">${esc(row.code)}</button><div class="desc" title="${esc(row.description)}">${esc(row.description)}</div></td><td>${fmt(row.need)} ${esc(row.unit || 'UN')}</td><td>${fmt(row.stock)} ${esc(row.unit || 'UN')}</td><td class="${row.balance < 0 ? 'danger-text' : ''}">${fmt(row.balance)} ${esc(row.unit || 'UN')}</td><td><span class="status ${row.simRisk === 'Crítico' ? 'red' : row.simRisk === 'Em atenção' ? 'amber' : 'green'}">${esc(row.simRisk)}</span></td><td><span class="status ${orderState.color}">${esc(orderState.label)}${orderState.hasOrder ? ` · ${fmt(orderState.total)} ${esc(row.unit || 'UN')}` : ''}</span>${simulationOrderMonths(row)}</td><td>${row.models.map(model => `<span class="model-chip">${esc(model.name)} · ${fmt(model.need)}</span>`).join('')}</td><td><span class="status ${decision.color}">${decision.label}</span>${canAdd ? `<button class="purchase-add-btn simulation-purchase-btn" data-sim-purchase-code="${esc(row.code)}" title="Adicionar ${fmt(suggested)} ${esc(row.unit || 'UN')} ao Processo de compra" aria-label="Adicionar ao Processo de compra">+</button>` : ''}</td></tr>`;
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
  result.innerHTML = `<div class="panel-header"><div><h3>Resultado · ${startLabel} a ${endLabel}</h3><span>${selections.map(selection => `${esc(selection.name)} · ${fmt(selection.cars)} carro${selection.cars === 1 ? '' : 's'}`).join(' · ')}</span></div><span id="sim-filter-count">${fmt(rows.length)} códigos</span></div><div class="panel-body"><div class="summary-strip"><div class="summary-box"><b class="danger">${counts['Crítico']}</b><span>Críticos</span></div><div class="summary-box"><b style="color:#a36a08">${counts['Em atenção']}</b><span>Em atenção</span></div><div class="summary-box"><b style="color:#19784f">${counts.Regular}</b><span>Regulares</span></div><div class="summary-box"><b>${fmt(rows.reduce((sum, row) => sum + row.need, 0))}</b><span>Necessidade total</span></div></div><div class="simulation-filters"><label class="filter-label simulation-search-label" for="simulation-search">Pesquisar código ou descrição</label><input class="input simulation-search-input" id="simulation-search" type="search" placeholder="Digite o código ou a descrição..." autocomplete="off" /><label class="filter-label" for="simulation-risk-filter">Situação</label><select class="select" id="simulation-risk-filter"><option value="all">Todas as situações</option><option value="Regular">Regular</option><option value="Em atenção">Em atenção</option><option value="Crítico">Crítico</option></select><label class="filter-label" for="simulation-order-filter">Pedidos</label><select class="select" id="simulation-order-filter"><option value="all">Todos os pedidos</option><option value="sem-pedido">Sem pedido</option><option value="com-pedido">Com pedido</option><option value="pedido-atrasado">Com pedido em atraso</option></select></div><div class="table-wrap simulation-full-width"><table class="data-table weekly-simulation-table"><thead><tr><th>Código / descrição</th><th>Necessidade</th><th>Estoque</th><th>Saldo</th><th>Risco</th><th>Pedidos por mês</th><th>Modelos que utilizam</th><th>Decisão</th></tr></thead><tbody id="sim-weekly-tbody"></tbody></table></div></div>`;
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
          return `<tr><td><button class="material-code consumable-code" data-code="${esc(item.code)}" title="Abrir detalhe do consumível">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${fmt(item.stock)}</td><td>${fmt(item.purchaseQty)}</td><td>${fmt(item.minStock)}</td><td>${fmt(item.maxStock)}</td><td>${esc(item.stockStatus || '—')}</td><td>${esc(item.maxStatus || '—')}</td><td>${hasOrder ? 'Sim' : 'Não'}</td><td>${overdue ? '<span class="status red">Follow-up</span>' : '<span class="status green">Sem atraso</span>'}</td><td><span class="status ${state.color}">${state.label}</span></td><td>${purchaseAction(item, 'consumable')}</td></tr>`;

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
  return `${filterBar()}<div class="view-title"><div><h2>Consumíveis</h2><p>Controle itens específicos, quantidade de compra, estoque mínimo e máximo.</p></div><div class="date-pill">Base: ${esc(CONSUMABLES.sourceFile || 'consumiveis')}</div></div><div class="summary-strip"><div class="summary-box"><b>${fmt(items.length)}</b><span>Consumíveis cadastrados</span></div><div class="summary-box"><b class="danger">${fmt(items.filter(item => consumableDecision(item).label === 'Comprar').length)}</b><span>Itens para comprar</span></div><div class="summary-box"><b>${fmt(items.filter(item => consumableDecision(item).label === 'Follow-up' || consumableHasOverdueOrder(item)).length)}</b><span>Itens em Follow-up</span></div></div><div class="panel"><div class="panel-body"><div class="toolbar"><input class="input" id="consumables-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="consumables-stock-status"><option value="all">Status do estoque: todos</option><option value="OK">OK</option><option value="Comprar">Comprar</option></select><select class="select" id="consumables-max-status"><option value="all">Status do máximo: todos</option><option value="ok">Dentro do máximo</option><option value="above">Acima do máximo</option></select><select class="select" id="consumables-followup"><option value="all">Pedidos: todos (${fmt(items.length)})</option><option value="order">Com pedido (${fmt(items.filter(consumableHasOrder).length)})</option><option value="overdue">Com atraso / follow-up (${fmt(items.filter(consumableHasOverdueOrder).length)})</option><option value="none">Sem pedido (${fmt(items.filter(item => !consumableHasOrder(item)).length)})</option></select></div><div class="table-wrap"><table class="data-table consumables-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Qtd. compra</th><th>Mínimo</th><th>Máximo</th><th>Status M</th><th>Status N</th><th>Pedido</th><th>Follow-up</th><th>Decisão</th><th>Processo de compra</th></tr></thead><tbody id="consumables-table-body">${consumableRows(items)}</tbody></table></div></div></div>`;
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
  return visibleRows.map(item => `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}" title="Abrir detalhe do material">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${fmt(item.stock)} ${esc(item.unit || 'UN')}</td><td class="specialized-order-cell" title="${esc(specializedOrderInfo(item).months || 'Sem pedidos em aberto')}">${esc(specializedOrderInfo(item).label)}</td><td>${fmt(item.unitNeed)} ${esc(item.unit || 'UN')}</td><td>${fmt(cars)}</td><td><strong>${fmt(item.required)} ${esc(item.unit || 'UN')}</strong></td><td class="${item.balance < 0 ? 'danger-text' : ''}">${fmt(item.balance)} ${esc(item.unit || 'UN')}</td><td><span class="status ${item.color}">${item.status}</span></td></tr>`).join('');
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
function annualRowIsExcluded(row) {
  const mapRecords = typeof PRODUCTION_MAP !== 'undefined' ? (PRODUCTION_MAP.records || []) : [];
  const found = mapRecords.find(item => String(item.en || '').trim().toUpperCase() === String(row?.pedido || '').trim().toUpperCase());
  const status = String(found?.productionStatusNormalized || found?.productionStatus || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return status === 'ENTREGUE' || status === 'VITRINI' || status === 'VITRINE';
}
function activeAnnualQuantities(model) {
  const annual = DATA?.planAnnual?.models || {};
  const fallback = { ...(annual[model] || {}) };
  const rows = DATA?.planAnnual?.rows || [];
  if (!rows.length) return fallback;
  const modelRows = rows.filter(row => String(row.modelo || '') === String(model));
  if (!modelRows.length) return fallback;
  const result = {};
  modelRows.filter(row => !annualRowIsExcluded(row)).forEach(row => { const month = String(row.mes || '').trim(); if (month) result[month] = n(result[month]) + 1; });
  return result;
}

function pinsNiguriPlanModels(model) {
  const annual = DATA?.planAnnual?.models || {};
  if (Object.keys(annual).length) {
    const selected = model && model !== 'Todos os modelos' ? [model] : (PINS.models || Object.keys(annual));
    return selected.map(name => ({ modelo: name, quantidades: activeAnnualQuantities(name) })).filter(entry => Object.values(entry.quantidades).some(value => n(value) > 0));
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

function pinsNiguriAnnualTimeline(model, requestedStartKey = '') {
  const now = new Date();
  const currentKey = pinsNiguriCurrentWeekKey(now);
  const currentDate = pinsNiguriWeekDate(currentKey);
  if (!currentDate) return null;
  const selectedModels = model && model !== 'Todos os modelos' ? [model] : (PINS.models || []);
  const selectedNames = new Set(selectedModels.map(pinsNiguriNormalize));
  const allPinNames = new Set((PINS.models || []).map(pinsNiguriNormalize));
  const annualRows = DATA?.planAnnual?.rows || [];
  const matched = annualRows.filter(row => [row.modelo, row.estrutura].some(value => selectedNames.has(pinsNiguriNormalize(value))));
  const horizonRows = annualRows.filter(row => [row.modelo, row.estrutura].some(value => allPinNames.has(pinsNiguriNormalize(value))));
  if (!horizonRows.length) return null;
  const activeRows = matched.filter(row => {
    const date = String(row.data || '').slice(0, 10);
    const monday = pinsNiguriWeekDate(pinsNiguriWeekKey(date));
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && monday && monday >= currentDate && !annualRowIsExcluded(row);
  });
  const plannedByWeek = new Map();
  activeRows.forEach(row => {
    const key = pinsNiguriWeekKey(row.data);
    if (!plannedByWeek.has(key)) plannedByWeek.set(key, []);
    plannedByWeek.get(key).push(row);
  });
  const horizonDates = horizonRows.filter(row => !annualRowIsExcluded(row)).map(row => {
    const date = String(row.data || '').slice(0, 10);
    const monday = pinsNiguriWeekDate(pinsNiguriWeekKey(date));
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && monday && monday >= currentDate ? monday : null;
  }).filter(Boolean);
  const lastDate = horizonDates.sort((a,b) => b-a)[0];
  const allSlots = [];
  if (lastDate) {
    for (const monday = new Date(currentDate); monday <= lastDate; monday.setDate(monday.getDate() + 7)) {
      const key = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
      const plannedEntries = plannedByWeek.get(key) || [];
      allSlots.push({ key, label: `S${String(getWeekNumber(monday)).padStart(2, '0')}`, week: getWeekNumber(monday), month: String(monday.getMonth()+1).padStart(2,'0'), year: String(monday.getFullYear()), quantity: plannedEntries.length, plannedEntries, consumption: 0, receipts: 0 });
    }
  }
  const counts = new Map();
  activeRows.forEach(row => {
    const modelName = selectedModels.find(name => [row.modelo, row.estrutura].some(value => pinsNiguriNormalize(value) === pinsNiguriNormalize(name))) || row.modelo || row.estrutura;
    counts.set(modelName, (counts.get(modelName) || 0) + 1);
  });
  const planModels = [...counts].map(([modelo, quantity]) => ({ modelo, quantidades: { total: quantity } }));
  const requested = requestedStartKey || pinsNiguriStartWeek || 'all';
  const weekFilter = requested !== 'all' && allSlots.some(slot => slot.key === requested) ? requested : 'all';
  const selectedDate = pinsNiguriWeekDate(weekFilter === 'all' ? currentKey : weekFilter) || currentDate;
  const calculationSlots = allSlots.filter(slot => {
    const date = pinsNiguriWeekDate(slot.key);
    return date && date >= currentDate && (weekFilter === 'all' || date <= selectedDate);
  });
  const slots = weekFilter === 'all' ? allSlots : allSlots.filter(slot => slot.key === weekFilter);
  return { slots, allSlots, calculationSlots, planModels, selectedMonths: [], currentKey, startKey: weekFilter, weekFilter, calculationStartKey: currentKey, annualSource: true, weeklySource: false };
}

function pinsNiguriTimeline(model, requestedStartKey = '') {
  const annualTimeline = pinsNiguriAnnualTimeline(model, requestedStartKey);
  if (annualTimeline) return annualTimeline;
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

function pinsNiguriUnitNeed(item, model) {
  const target = pinsNiguriNormalize(model);
  const structures = DATA?.models || {};
  const structureName = Object.keys(structures).find(name => pinsNiguriNormalize(name) === target);
  if (structureName) {
    const component = (structures[structureName] || []).find(entry => String(entry.code) === String(item.code));
    return n(component?.quantity);
  }
  const itemModel = Object.keys(item?.modelNeeds || {}).find(name => pinsNiguriNormalize(name) === target);
  return n(item?.modelNeeds?.[itemModel || model]);
}

function pinsNiguriWeeklyConsumption(item, model, slot) {
  if (Array.isArray(slot?.plannedEntries)) {
    const models = model === 'Todos os modelos' ? (PINS.models || []) : [model];
    const allowed = new Set(models.map(pinsNiguriNormalize));
    return slot.plannedEntries.reduce((sum, row) => {
      const rowModel = [row.modelo, row.estrutura].find(value => allowed.has(pinsNiguriNormalize(value)));
      const modelName = models.find(name => pinsNiguriNormalize(name) === pinsNiguriNormalize(rowModel));
      return sum + (modelName ? pinsNiguriUnitNeed(item, modelName) : 0);
    }, 0);
  }
  if (!slot?.week || !item?.weeklyDemand) return null;
  const models = model === 'Todos os modelos' ? (PINS.models || []) : [model];
  return models.reduce((sum, name) => sum + n(item.weeklyDemand?.[name]?.[`S${slot.week}`]), 0);
}

function pinsNiguriRows(model, query = '', statusFilter = 'all') {
  const timeline = pinsNiguriTimeline(model, pinsNiguriStartWeek);
  const rows = (PINS.items || []).map(item => {
    const modelNeed = model === 'Todos os modelos'
      ? [...new Set(timeline.planModels.map(entry => entry.modelo))].reduce((sum, name) => sum + pinsNiguriUnitNeed(item, name), 0)
      : pinsNiguriUnitNeed(item, model);
    if (modelNeed <= 0) return null;
    let balance = n(itemByCode(item.code)?.stock ?? item.stock);
    const balances = [];
    let totalNeed = 0;
    const visibleKeys = new Set(timeline.slots.map(slot => slot.key));
    timeline.calculationSlots.forEach(slot => {
      const weeklyConsumption = timeline.annualSource || timeline.weeklySource ? pinsNiguriWeeklyConsumption(item, model, slot) : null;
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
  const weekOptions = `<option value="all" ${timeline.weekFilter === 'all' ? 'selected' : ''}>Todas as semanas</option>${timeline.allSlots.map(slot => `<option value="${esc(slot.key)}" ${slot.key === timeline.weekFilter ? 'selected' : ''}>${esc(slot.label)} · ${esc(slot.month)}/${esc(slot.year)}</option>`).join('')}`;
  return `<div class="pins-page pins-niguri-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado · linha do tempo</span><h2>NIGURI dos Pinos</h2><p>Saldo projectado por semana com as datas exactas do PLANO ANUAL.</p></div><div class="date-pill">Fonte: PLANO ANUAL</div></div><div class="panel pins-niguri-controls"><label>Modelo analisado<select class="select" id="pins-niguri-model"><option>Todos os modelos</option>${PINS.models.map(entry => `<option value="${esc(entry)}" ${entry === model ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></label><label>Semana analisada<select class="select" id="pins-niguri-start-week">${weekOptions}</select></label><label>Pesquisar<input class="input" id="pins-niguri-search" placeholder="Código ou descrição" /></label><label>Situação<select class="select" id="pins-niguri-status"><option value="all">Todos</option><option value="Crítico">Com falta prevista</option><option value="Em atenção">Atenção</option><option value="Regular">Regulares</option></select></label></div><div class="pins-niguri-note"><strong>Leitura da projeção:</strong> seleccione “Todas as semanas” para ver o período completo, ou uma semana para analisar apenas esse corte. O saldo semanal acumula consumos e recebimentos desde a semana actual. Verde = saldo suficiente, amarelo = recebimento na semana ou saldo próximo do limite, vermelho = saldo negativo.</div><div class="pins-result-panel panel"><div class="pins-result-head"><div><span class="eyebrow">Necessidade consolidada até março de 2027</span><h3>${esc(model)}</h3><p>${fmt(rows.length)} pinos utilizados · início em ${esc(timeline.slots[0]?.label || '—')} · primeira falta identificada: ${esc(firstWeek)}</p></div><div class="pins-result-total"><span>Necessidade total</span><strong>${fmt(totalNeed)}</strong><small>Críticos: ${fmt(critical)} · Atenção: ${fmt(attention)}</small></div></div></div><div class="panel pins-panel"><div class="panel-header"><div><h3>Saldo acumulado por semana</h3><span>Verde: disponível · amarelo: recebimento/próximo do limite · vermelho: falta prevista</span></div><span class="pins-legend"><i></i>${fmt(timeline.slots.length)} semanas projetadas</span></div><div class="table-wrap pins-niguri-table-wrap"><table class="data-table pins-table pins-niguri-table"><thead><tr><th>Código / descrição</th><th>Estoque inicial</th><th>Necessidade no período</th><th>Primeira falta</th>${weekHeaders}</tr></thead><tbody>${rowHtml || '<tr><td colspan="8" class="empty">Nenhum pino corresponde aos filtros.</td></tr>'}</tbody></table></div></div></div>`;
}

function pinsView() {
  const active = pinsSubView === 'niguri' ? 'niguri' : 'simulation';
  const content = active === 'niguri' ? pinsNiguriView() : pinsSimulationView();
  return `<div class="pins-page"><div class="pins-subnav"><button class="pins-subtab ${active === 'simulation' ? 'active' : ''}" data-pins-subview="simulation">Pinos por modelo</button><button class="pins-subtab ${active === 'niguri' ? 'active' : ''}" data-pins-subview="niguri">NIGURI dos pinos</button></div>${content}</div>`;
}

function modelNiguriNormalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function modelNiguriStructureName(model) {
  const structures = Object.keys(DATA?.models || {});
  const aliases = {
    '13': '13ldi-46kv', '13ldi': '13ldi-46kv', '1369': '13-69kv', '1369kv': '13-69kv', '13lddi': '13-69kv',
    '18': '18lddi', 'guindaste16': 'guin-16T', 'guindaste25': 'guin-25T', 'guindate25': 'guin-25T',
    'guindaste45': 'guin-45', 'guindaste21': '21T', 'guindaste30t': '30-T', 'guindaste12': '12-T', 'guindaste75': '7T'
  };
  const normalized = modelNiguriNormalize(model);
  const crane = normalized.match(/^(?:guindaste|guindate)(\d+)/);
  const craneAliases = { '7': '7T', '12': '12-T', '16': 'guin-16T', '21': '21T', '25': 'guin-25T', '30': '30-T', '35': 'guin-35T', '45': 'guin-45' };
  const craneBase = crane ? Object.keys(craneAliases).sort((a, b) => b.length - a.length).find(prefix => crane[1].startsWith(prefix)) : '';
  const preferred = aliases[normalized] || (craneBase ? craneAliases[craneBase] : model);
  if (DATA?.models?.[preferred]) return preferred;
  return structures.find(name => modelNiguriNormalize(name) === modelNiguriNormalize(preferred))
    || structures.find(name => modelNiguriNormalize(name).includes(normalized))
    || structures.find(name => normalized && normalized.includes(modelNiguriNormalize(name))) || '';
}
function planMonthModelQuantity(modelEntry, period) {
  const values = modelEntry?.quantidades || {};
  const key = period?.key || '';
  if (values[key] !== undefined) return n(values[key]);
  return n(values[period?.month || '']);
}
function planModelStructureRows(modelLabel) {
  const structureName = modelNiguriStructureName(modelLabel);
  if (structureName) return DATA?.models?.[structureName] || [];
  const label = modelNiguriNormalize(modelLabel);
  const cabinAliases = {
    'cabine4lugar': '4 LUGAR', 'cabine6lugar': '6 LUGAR',
    'cabine6lugarcombanheiro': '6 LUGAR C/ BANHEIRO', 'cabine8lugar': '8 LUGAR'
  };
  const cabinName = cabinAliases[label] || (CABINS.models || []).find(name => modelNiguriNormalize(name) === label);
  if (!cabinName) return [];
  return (CABINS.items || []).map(item => ({ ...item, quantity: n(item.modelNeeds?.[cabinName]) })).filter(item => item.quantity > 0);
}
function orderQuantityForPeriod(item, periodKey) {
  const [month, year] = String(periodKey || '').split('/');
  const orders = item?.orders || {};
  const exact = `PED ${month}/${year}`.replace(/\s+/g, ' ').trim().toUpperCase();
  const monthly = `PED ${month}`.replace(/\s+/g, ' ').trim().toUpperCase();
  const entry = Object.entries(orders).find(([key]) => String(key).replace(/\s+/g, ' ').trim().toUpperCase() === exact)
    || Object.entries(orders).find(([key]) => String(key).replace(/\s+/g, ' ').trim().toUpperCase() === monthly);
  return n(entry?.[1]);
}
function syncPlanMonthDemands() {
  if (!DATA?.items) return;
  const periods = planMonthPeriods();
  const demandByCode = new Map();
  const unmatched = new Set();
  (DATA.planMonth?.models || []).forEach(modelEntry => {
    const quantities = periods.map(period => planMonthModelQuantity(modelEntry, period));
    if (!quantities.some(quantity => quantity > 0)) return;
    const components = planModelStructureRows(modelEntry.modelo);
    if (!components.length) { unmatched.add(String(modelEntry.modelo)); return; }
    periods.forEach((period, index) => {
      const plannedMachines = quantities[index];
      if (!plannedMachines) return;
      components.forEach(component => {
        const code = String(component.code || '').trim();
        if (!code) return;
        const demand = n(component.quantity) * plannedMachines;
        const byPeriod = demandByCode.get(code) || {};
        byPeriod[period.key] = n(byPeriod[period.key]) + demand;
        demandByCode.set(code, byPeriod);
      });
    });
  });
  DATA.demandMonths = periods.map(period => `DEM ${period.key}`);
  DATA.planMonthUnmatchedModels = [...unmatched];
  DATA.items.forEach(item => {
    const planned = demandByCode.get(String(item.code)) || {};
    item.demands = Object.fromEntries(periods.map(period => [`DEM ${period.key}`, n(planned[period.key])]));
  });
}
function modelNiguriStructureRows(model) {
  const base = new Map((DATA?.items || []).map(item => [String(item.code), item]));
  const sourceRows = model === 'Todos os modelos'
    ? Object.values(DATA?.models || {}).flat()
    : (DATA?.models?.[modelNiguriStructureName(model)] || []);
  const grouped = new Map();
  sourceRows.forEach(entry => {
    const code = String(entry.code || '').trim();
    if (!code || !/^\d{2}(?:\.\d{2}){2}\.\d{10}$/.test(code) || n(entry.quantity) <= 0) return;
    const current = grouped.get(code) || { ...entry, code, quantity: 0 };
    current.quantity += n(entry.quantity);
    grouped.set(code, current);
  });
  return [...grouped.values()].map(entry => {
    const code = String(entry.code || '').trim();
    if (!/^\d{2}(?:\.\d{2}){2}\.\d{10}$/.test(code)) return null;
    const source = base.get(code) || {};
    const quantity = n(entry.quantity);
    if (quantity <= 0) return null;
    return { ...source, code, description: source.description || entry.description || code, quantity, unit: source.unit || 'UN', stock: n(source.stock ?? entry.stock), analyst: source.analyst || 'Não informado', safety: n(source.safety), orders: source.orders || {} };
  }).filter(Boolean);
}
function modelNiguriPlanEntries(model) {
  const structureName = modelNiguriStructureName(model);
  const annualRows = DATA?.planAnnual?.rows || [];
  const matched = model === 'Todos os modelos'
    ? annualRows.filter(entry => modelNiguriStructureName(entry.estrutura || entry.modelo))
    : annualRows.filter(entry => { const plannedStructure = entry.estrutura || entry.modelo; return structureName && modelNiguriStructureName(plannedStructure) === structureName; });
  const datedRows = matched.filter(entry => {
    const date = String(entry.data || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && Boolean(pinsNiguriWeekKey(date));
  });
  const undatedRows = matched.filter(entry => !datedRows.includes(entry));
  return [{ modelo: structureName || model, rows: datedRows, undatedRows, allRows: matched }];
}
function modelNiguriUnmatchedCraneProducts(model) {
  if (model === 'Todos os modelos') return (DATA?.planAnnual?.unmatchedCraneProducts || []).filter(entry => /GUINDASTE/i.test(String(entry.produto || '')) && !/CARROCERIA/i.test(String(entry.produto || '')));
  const structureName = modelNiguriStructureName(model);
  const baseByStructure = { 'guin-16T': 16, 'guin-25T': 25, 'guin-45': 45, '21T': 21, '30-T': 30, '12-T': 12, '7T': 7 };
  const base = baseByStructure[structureName];
  if (!base) return [];
  return (DATA?.planAnnual?.unmatchedCraneProducts || []).filter(entry => {
    const match = String(entry.produto || '').toUpperCase().match(/NX\s*(\d+(?:[.,]\d+)?)/);
    return match && Math.floor(Number(match[1].replace(',', '.'))) === base;
  });
}
function modelNiguriOrders(item, slot, timelineSlots = []) {
  // modelNiguriStructureRows já devolve a linha enriquecida com stock/pedidos/recebimentos; evitar pesquisa linear no stock para cada semana.
  const source = item;
  const obtention = Array.isArray(source.obtention) ? source.obtention : [];
  const monthKeys = slot.monthKeys || [`${slot.month}/${slot.year}`];
  let total = 0;
  monthKeys.forEach(monthKey => {
    const [month, year] = String(monthKey).split('/');
    if (!month || !year) return;
    const prefix = `${year}-${month}-`;
    const monthEntries = obtention.filter(entry => String(entry.plannedDate || '').startsWith(prefix));
    const exactEntries = monthEntries.filter(entry => pinsNiguriWeekKey(entry.plannedDate) === slot.key);
    if (exactEntries.length) {
      total += exactEntries.reduce((sum, entry) => sum + n(entry.quantity), 0);
      return;
    }
    if (monthEntries.length) return;
    const monthSlots = timelineSlots.filter(candidate => (candidate.monthKeys || [`${candidate.month}/${candidate.year}`]).includes(monthKey));
    if (monthSlots[0]?.key !== slot.key) return;
    const orders = source.orders || {};
    const exactKey = `PED ${month}/${year}`.replace(/\s+/g, ' ').trim().toUpperCase();
    const monthlyKey = `PED ${month}`.replace(/\s+/g, ' ').trim().toUpperCase();
    const entry = Object.entries(orders).find(([key]) => String(key).replace(/\s+/g, ' ').trim().toUpperCase() === exactKey)
      || Object.entries(orders).find(([key]) => String(key).replace(/\s+/g, ' ').trim().toUpperCase() === monthlyKey);
    total += n(entry?.[1]);
  });
  return total;
}
function modelNiguriTimeline(model) {
  const plan = modelNiguriPlanEntries(model)[0] || { rows: [], undatedRows: [] };
  const currentKey = pinsNiguriCurrentWeekKey(new Date());
  const currentDate = pinsNiguriWeekDate(currentKey);
  const quantityByWeek = new Map();
  plan.rows.forEach(entry => {
    const key = pinsNiguriWeekKey(entry.data);
    const date = pinsNiguriWeekDate(key);
    if (!key || !date || !currentDate || date < currentDate) return;
    const record = quantityByWeek.get(key) || { quantity: 0, entries: [] };
    record.quantity += 1;
    record.entries.push(entry);
    quantityByWeek.set(key, record);
  });
  const lastWeekDate = [...quantityByWeek.keys()].map(pinsNiguriWeekDate).filter(Boolean).sort((a, b) => b - a)[0];
  const allSlots = [];
  if (currentDate && lastWeekDate) {
    for (const monday = new Date(currentDate); monday <= lastWeekDate; monday.setDate(monday.getDate() + 7)) {
      const key = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
      const weekRecord = quantityByWeek.get(key) || { quantity: 0, entries: [] };
      const monthKeys = new Set();
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(monday); date.setDate(date.getDate() + day);
        monthKeys.add(`${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`);
      }
      const labelDate = weekRecord.entries[0]?.data ? new Date(`${String(weekRecord.entries[0].data).slice(0, 10)}T12:00:00`) : monday;
      allSlots.push({ key, label: `S${String(getWeekNumber(monday)).padStart(2, '0')}`, month: String(labelDate.getMonth() + 1).padStart(2, '0'), year: String(labelDate.getFullYear()), monthKeys: [...monthKeys], quantity: weekRecord.quantity, plannedEntries: weekRecord.entries, consumption: 0, receipts: 0 });
    }
  }
  const weekFilter = modelNiguriStartWeek && modelNiguriStartWeek !== 'all' && allSlots.some(slot => slot.key === modelNiguriStartWeek) ? modelNiguriStartWeek : 'all';
  const selectedDate = pinsNiguriWeekDate(weekFilter === 'all' ? currentKey : weekFilter) || currentDate;
  const calcDate = selectedDate && currentDate && selectedDate > currentDate ? currentDate : selectedDate;
  const calculationSlots = allSlots.filter(slot => {
    const date = pinsNiguriWeekDate(slot.key);
    return date && calcDate && date >= calcDate && (weekFilter === 'all' || date <= selectedDate);
  });
  const slots = weekFilter === 'all' ? allSlots.filter(slot => pinsNiguriWeekDate(slot.key) >= currentDate) : allSlots.filter(slot => slot.key === weekFilter);
  return { slots, allSlots, calculationSlots, startKey: weekFilter, weekFilter, currentKey, model, structureName: model === 'Todos os modelos' ? 'Todos os modelos' : modelNiguriStructureName(model), undatedRows: plan.undatedRows || [], planRows: plan.rows || [] };
}
function modelNiguriRows(model, analyst = 'all', query = '', statusFilter = 'all') {
  const startKey = modelNiguriStartWeek || '';
  const cached = modelNiguriRows._cache;
  let timeline;
  let calculatedRows;
  if (cached && cached.data === DATA && cached.model === model && cached.startKey === startKey) {
    ({ timeline, rows: calculatedRows } = cached);
  } else {
    timeline = modelNiguriTimeline(model);
    const visible = new Set(timeline.slots.map(slot => slot.key));
    const weeklyNeeds = new Map();
    if (model === 'Todos os modelos') {
      const needsByStructure = new Map();
      timeline.calculationSlots.forEach(slot => {
        const needs = new Map();
        slot.plannedEntries.forEach(planned => {
          const structure = modelNiguriStructureName(planned.estrutura || planned.modelo);
          if (!needsByStructure.has(structure)) {
            const components = new Map();
            (DATA?.models?.[structure] || []).forEach(entry => {
              const code = String(entry.code || '').trim();
              if (code && !components.has(code)) components.set(code, n(entry.quantity));
            });
            needsByStructure.set(structure, components);
          }
          needsByStructure.get(structure).forEach((quantity, code) => {
            needs.set(code, (needs.get(code) || 0) + quantity);
          });
        });
        weeklyNeeds.set(slot.key, needs);
      });
    }
    calculatedRows = modelNiguriStructureRows(model).map(item => {
      let balance = n(item.stock);
      const balances = [];
      let totalNeed = 0;
      timeline.calculationSlots.forEach(slot => {
        const consumption = model === 'Todos os modelos'
          ? (weeklyNeeds.get(slot.key)?.get(String(item.code)) || 0)
          : item.quantity * slot.quantity;
        const receipt = modelNiguriOrders(item, slot, timeline.calculationSlots);
        balance = balance - consumption + receipt;
        if (visible.has(slot.key)) {
          totalNeed += consumption;
          balances.push({ ...slot, consumption, receipts: receipt, balance });
        }
      });
      const firstShortage = balances.find(slot => slot.balance < 0);
      const status = firstShortage ? 'Crítico' : balances.some(slot => slot.balance <= n(item.safety)) ? 'Em atenção' : 'Regular';
      return { ...item, totalNeed, balances, firstShortage, status };
    });
    modelNiguriRows._cache = { data: DATA, model, startKey, timeline, rows: calculatedRows };
  }
  const needle = String(query).trim().toLowerCase();
  const rows = calculatedRows.filter(item =>
    (analyst === 'all' || item.analyst === analyst) &&
    `${item.code} ${item.description}`.toLowerCase().includes(needle) &&
    (statusFilter === 'all' || item.status === statusFilter)
  );
  return { rows, timeline };
}
const MODEL_NIGURI_PAGE_SIZE = 200;
let modelNiguriVisibleLimit = MODEL_NIGURI_PAGE_SIZE;
function modelNiguriPage(rows, limit = modelNiguriVisibleLimit) {
  return rows.slice(0, Math.max(0, Number(limit) || 0));
}
function advanceModelNiguriPage(total) {
  modelNiguriVisibleLimit = Math.min(total, modelNiguriVisibleLimit + MODEL_NIGURI_PAGE_SIZE);
}
function modelNiguriLoadMoreMarkup(total, visible) {
  if (!total) return '<div class="table-footer model-niguri-load-more" id="model-niguri-load-more"><span>Nenhum material corresponde aos filtros.</span></div>';
  return visible < total
    ? `<div class="table-footer model-niguri-load-more" id="model-niguri-load-more"><button class="secondary-btn" id="model-niguri-load-more-btn">Carregar mais (${fmt(Math.min(MODEL_NIGURI_PAGE_SIZE, total - visible))})</button><span>Mostrando ${fmt(visible)} de ${fmt(total)} materiais</span></div>`
    : `<div class="table-footer model-niguri-load-more" id="model-niguri-load-more"><span>Todos os ${fmt(total)} materiais carregados</span></div>`;
}
function bindModelNiguriLoadMore() {
  const button = $('#model-niguri-load-more-btn');
  if (button) button.onclick = () => {
    const rows = modelNiguriRows(modelNiguriModel, modelNiguriAnalyst, $('#model-niguri-search')?.value || '', $('#model-niguri-status')?.value || 'all').rows;
    const start = Math.min(modelNiguriVisibleLimit, rows.length);
    advanceModelNiguriPage(rows.length);
    const end = modelNiguriVisibleLimit;
    const tbody = document.querySelector('.pins-niguri-table tbody');
    if (tbody) {
      if (start === 0) tbody.innerHTML = '';
      tbody.insertAdjacentHTML('beforeend', rows.slice(start, end).map(modelNiguriRowMarkup).join(''));
    }
    const footer = $('#model-niguri-load-more');
    if (footer) footer.outerHTML = modelNiguriLoadMoreMarkup(rows.length, Math.min(end, rows.length));
    bindMaterialButtons();
    bindModelNiguriLoadMore();
  };
}
function refreshModelNiguriTable() {
  const current = modelNiguriView();
  const temp = document.createElement('div');
  temp.innerHTML = current;
  const oldBody = document.querySelector('.pins-niguri-table tbody');
  const newBody = temp.querySelector('.pins-niguri-table tbody');
  if (oldBody && newBody) oldBody.innerHTML = newBody.innerHTML;
  const oldFooter = document.querySelector('#model-niguri-load-more');
  const newFooter = temp.querySelector('#model-niguri-load-more');
  if (oldFooter && newFooter) oldFooter.outerHTML = newFooter.outerHTML;
  bindMaterialButtons();
  bindModelNiguriLoadMore();
}
function modelNiguriRowMarkup(item) {
  const cells = item.balances.map(cell => {
    const color = cell.balance < 0 ? 'danger' : cell.receipts > 0 ? 'receipt' : cell.balance <= n(item.safety) ? 'attention' : 'good';
    return `<td class="niguri-cell ${color}" title="Consumo: ${fmt(cell.consumption)} · Recebimento: ${fmt(cell.receipts)}">${fmt(cell.balance)}</td>`;
  }).join('');
  return `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${esc(item.analyst)}</td><td>${fmt(item.stock)} ${esc(item.unit)}</td><td>${fmt(item.quantity)} ${esc(item.unit)}</td><td><strong>${fmt(item.totalNeed)} ${esc(item.unit)}</strong></td><td>${item.firstShortage ? `<span class="status red">${esc(item.firstShortage.label)}</span>` : '<span class="status green">Sem falta</span>'}</td>${cells}</tr>`;
}
function modelNiguriView() {
  const models = Object.keys(DATA?.models || {}).sort((a, b) => a.localeCompare(b));
  const model = modelNiguriModel === 'Todos os modelos' ? modelNiguriModel : (models.includes(modelNiguriModel) ? modelNiguriModel : (models[0] || ''));
  modelNiguriModel = model;
  const analysts = [...new Set((DATA?.items || []).map(item => item.analyst).filter(Boolean))].sort();
  const query = $('#model-niguri-search')?.value || ''; const status = $('#model-niguri-status')?.value || 'all';
  const analyst = modelNiguriAnalyst || 'all'; const { rows, timeline } = modelNiguriRows(model, analyst, query, status);
  const unmatchedCraneProducts = modelNiguriUnmatchedCraneProducts(model);
  const planWarning = timeline.undatedRows.length ? `<div class="history-note stock-plan-warning">${fmt(timeline.undatedRows.length)} linha(s) do PLANO ANUAL correspondem a esta estrutura, mas não têm uma data exacta reconhecível na coluna D; não entram no consumo semanal.</div>` : '';
  const craneWarning = unmatchedCraneProducts.length ? `<div class="history-note stock-plan-warning">O PLANO ANUAL tem produto(s) deste porte sem correspondência exacta com a estrutura carregada: ${unmatchedCraneProducts.map(entry => `${esc(entry.produto)} (${fmt(entry.quantidade)})`).join('; ')}. Não foram incluídos no consumo; confirme se a configuração do guindaste usa esta BOM.</div>` : '';
  const scheduleNote = timeline.allSlots.some(slot => n(slot.quantity) > 0) ? '' : '<div class="history-note stock-plan-warning">Não há ENs com data prevista actual ou futura no PLANO ANUAL para esta estrutura. A estrutura continua disponível, mas não haverá consumo projectado.</div>';
  const headers = timeline.slots.map(slot => `<th title="${esc(slot.month)}/${esc(slot.year)} · ${fmt(slot.quantity)} EN(s) do PLANO ANUAL">${esc(slot.label)}<small>${esc(slot.month)}/${esc(slot.year)}</small></th>`).join('');
  const visibleRows = modelNiguriPage(rows); const body = visibleRows.map(modelNiguriRowMarkup).join('');
  const options = `<option value="all" ${timeline.weekFilter === 'all' ? 'selected' : ''}>Todas as semanas</option>${timeline.allSlots.map(slot => `<option value="${esc(slot.key)}" ${slot.key === timeline.weekFilter ? 'selected' : ''}>${esc(slot.label)} · ${esc(slot.month)}/${esc(slot.year)}</option>`).join('')}`;
  return `<div class="pins-page pins-niguri-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado · estrutura completa</span><h2>NIGURI dos modelos</h2><p>Estruturas das abas de modelos com consumo semanal pela data prevista de cada EN na aba PLANO ANUAL.</p></div><div class="date-pill">Estrutura: ${esc(timeline.structureName || 'não encontrada')}</div></div>${planWarning}${craneWarning}${scheduleNote}<div class="panel pins-niguri-controls"><label>Modelo<select class="select" id="model-niguri-model"><option value="Todos os modelos" ${model === 'Todos os modelos' ? 'selected' : ''}>Todos os modelos</option>${models.map(entry => `<option value="${esc(entry)}" ${entry === model ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></label><label>Semana analisada<select class="select" id="model-niguri-start-week">${options}</select></label><label>Analista<select class="select" id="model-niguri-analyst"><option value="all">Todos os analistas</option>${analysts.map(entry => `<option value="${esc(entry)}" ${entry === analyst ? 'selected' : ''}>${esc(entry)}</option>`).join('')}</select></label><label>Pesquisar<input class="input" id="model-niguri-search" placeholder="Código ou descrição" /></label><label>Situação<select class="select" id="model-niguri-status"><option value="all">Todas</option><option value="Crítico">Críticos</option><option value="Em atenção">Atenção</option><option value="Regular">Regulares</option></select></label></div><div class="pins-niguri-note"><strong>Regra:</strong> cada linha/EN do PLANO ANUAL conta como um veículo planeado, e o consumo da sua estrutura entra na semana ISO correspondente à data prevista da coluna D. Os recebimentos previstos continuam a ser lançados no saldo acumulado.</div><div class="panel pins-panel"><div class="panel-header"><div><h3>Itens da estrutura · ${esc(model)}</h3><span>${fmt(rows.length)} materiais consolidados · ${fmt(timeline.slots.length)} semanas projectadas</span></div><span class="pins-legend"><i></i> Verde: saldo · amarelo: recebimento/limite · vermelho: falta</span></div><div class="table-wrap pins-niguri-table-wrap"><table class="data-table pins-table pins-niguri-table"><thead><tr><th>Código / descrição</th><th>Analista</th><th>Estoque</th><th>Qtd./modelo</th><th>Necessidade no período</th><th>Primeira falta</th>${headers}</tr></thead><tbody>${body || '<tr><td colspan="8" class="empty">Nenhum item corresponde aos filtros.</td></tr>'}</tbody></table></div>${modelNiguriLoadMoreMarkup(rows.length, visibleRows.length)}</div></div>`;
}

function pinsSimulationView() {
  const items = PINS.items || [];
  const models = PINS.models || [];
  const activeModel = selectedPinModel || models[0] || '';
  return `<div class="pins-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado</span><h2></h2><p></p></div><div class="date-pill">${esc(PINS.sourceFile || 'Aba Pinos')}</div></div><div class="pins-model-strip">${models.map(model => `<button class="pins-model-card${model === activeModel ? ' selected' : ''}" data-pin-model="${esc(model)}"><span>Pinos</span><strong>${esc(model)}</strong><small>${model === activeModel ? 'modelo selecionado' : 'selecionar modelo'}</small></button>`).join('')}</div><div class="panel pins-config-panel"><div class="pins-config-copy"><span class="eyebrow">Configuração da produção</span><h3>Quantas máquinas ${esc(activeModel)} serão produzidas?</h3><p>A quantidade planejada multiplica a necessidade unitária informada na aba Pinos.</p></div><div class="pins-config-controls"><label for="pins-cars">Quantidade de máquinas</label><div class="pins-cars-control"><input class="input" id="pins-cars" type="number" min="1" step="1" value="${fmt(Math.max(1, n(pinCars)))}" /><button class="primary-btn" id="run-pins-simulation">Calcular necessidade</button></div></div></div><div id="pins-result" class="panel pins-result-panel"></div><div class="panel pins-panel"><div class="panel-header"><div><h3>Detalhamento dos pinos · ${esc(activeModel)}</h3><span>${fmt(items.length)} códigos disponíveis na aba Pinos</span></div><span class="pins-legend"><i></i> Estoque insuficiente para o plano</span></div><div class="panel-body"><div class="toolbar pins-toolbar"><input class="input" id="pins-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="pins-coverage"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regulares</option></select><select class="select" id="pins-stock-filter"><option value="all">Estoque: todos</option><option value="zero">Estoque igual a zero</option><option value="positive">Estoque maior que zero</option></select></div><div class="table-wrap pins-table-wrap"><table class="data-table pins-table pins-simulation-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Pedido em aberto</th><th>Necessidade / máquina</th><th>Máquinas</th><th>Necessidade calculada</th><th>Saldo</th><th>Situação</th></tr></thead><tbody id="pins-table-body"></tbody></table></div><div class="table-footer specialized-load-more" id="pins-load-more"></div></div></div></div>`;
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
  return visibleRows.map(item => `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}" title="Abrir detalhe do material">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${fmt(item.stock)} ${esc(item.unit || 'UN')}</td><td class="specialized-order-cell" title="${esc(specializedOrderInfo(item).months || 'Sem pedidos em aberto')}">${esc(specializedOrderInfo(item).label)}</td><td>${fmt(item.unitNeed)} ${esc(item.unit || 'UN')}</td><td>${fmt(cars)}</td><td><strong>${fmt(item.required)} ${esc(item.unit || 'UN')}</strong></td><td class="${item.balance < 0 ? 'danger-text' : ''}">${fmt(item.balance)} ${esc(item.unit || 'UN')}</td><td><span class="status ${item.color}">${item.status}</span></td></tr>`).join('');
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
  return `<div class="pins-page cylinders-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado</span><h2></h2><p></p></div><div class="date-pill">${esc(CYLINDERS.sourceFile || 'Aba cilindros')}</div></div><div class="pins-model-strip">${models.map(model => `<button class="pins-model-card${model === activeModel ? ' selected' : ''}" data-cylinder-model="${esc(model)}"><span>Cilindros</span><strong>${esc(model)}</strong><small>${model === activeModel ? 'modelo selecionado' : 'selecionar modelo'}</small></button>`).join('')}</div><div class="panel pins-config-panel"><div class="pins-config-copy"><span class="eyebrow">Configuração da produção</span><h3>Quantas máquinas ${esc(activeModel || 'deste modelo')} serão produzidas?</h3><p>A quantidade planejada multiplica a necessidade unitária informada na aba cilindros.</p></div><div class="pins-config-controls"><label for="cylinders-cars">Quantidade de máquinas</label><div class="pins-cars-control"><input class="input" id="cylinders-cars" type="number" min="1" step="1" value="${fmt(Math.max(1, n(cylinderCars)))}" /><button class="primary-btn" id="run-cylinders-simulation">Calcular necessidade</button></div></div></div><div id="cylinders-result" class="panel pins-result-panel"></div><div class="panel pins-panel"><div class="panel-header"><div><h3>Detalhamento dos cilindros · ${esc(activeModel || '—')}</h3><span>${fmt(items.length)} códigos disponíveis na aba cilindros</span></div><span class="pins-legend"><i></i> Estoque insuficiente para o plano</span></div><div class="panel-body">${items.length ? `<div class="toolbar pins-toolbar"><input class="input" id="cylinders-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="cylinders-coverage"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regulares</option></select><select class="select" id="cylinders-stock-filter"><option value="all">Estoque: todos</option><option value="zero">Estoque igual a zero</option><option value="positive">Estoque maior que zero</option></select></div><div class="table-wrap pins-table-wrap"><table class="data-table pins-table pins-simulation-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Pedido em aberto</th><th>Necessidade / máquina</th><th>Máquinas</th><th>Necessidade calculada</th><th>Saldo</th><th>Situação</th></tr></thead><tbody id="cylinders-table-body"></tbody></table></div><div class="table-footer specialized-load-more" id="cylinders-load-more"></div>` : `<div class="empty cylinders-empty">${emptyMessage}</div>`}</div></div></div>`;
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
  return visibleRows.map(item => `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}" title="Abrir detalhe do material">${esc(item.code)}</button><div class="desc" title="${esc(item.description)}">${esc(item.description)}</div></td><td>${fmt(item.stock)} ${esc(item.unit || 'UN')}</td><td class="specialized-order-cell" title="${esc(specializedOrderInfo(item).months || 'Sem pedidos em aberto')}">${esc(specializedOrderInfo(item).label)}</td><td>${fmt(item.unitNeed)} ${esc(item.unit || 'UN')}</td><td>${fmt(cars)}</td><td><strong>${fmt(item.required)} ${esc(item.unit || 'UN')}</strong></td><td class="${item.balance < 0 ? 'danger-text' : ''}">${fmt(item.balance)} ${esc(item.unit || 'UN')}</td><td><span class="status ${item.color}">${item.status}</span></td></tr>`).join('');
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
  return `<div class="pins-page cabins-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado</span><h2></h2><p></p></div><div class="date-pill">${esc(CABINS.sourceFile || 'Aba cabines')}</div></div><div class="pins-model-strip">${models.map(model => `<button class="pins-model-card${model === activeModel ? ' selected' : ''}" data-cabin-model="${esc(model)}"><span>Cabines</span><strong>${esc(model)}</strong><small>${model === activeModel ? 'modelo selecionado' : 'selecionar modelo'}</small></button>`).join('')}</div><div class="panel pins-config-panel"><div class="pins-config-copy"><span class="eyebrow">Configuração da produção</span><h3>Quantas máquinas ${esc(activeModel || 'deste modelo')} serão produzidas?</h3><p>A quantidade planejada multiplica a necessidade unitária informada na aba cabines.</p></div><div class="pins-config-controls"><label for="cabins-cars">Quantidade de máquinas</label><div class="pins-cars-control"><input class="input" id="cabins-cars" type="number" min="1" step="1" value="${fmt(Math.max(1, n(cabinCars)))}" /><button class="primary-btn" id="run-cabins-simulation">Calcular necessidade</button></div></div></div><div id="cabins-result" class="panel pins-result-panel"></div><div class="panel pins-panel"><div class="panel-header"><div><h3>Detalhamento das cabines · ${esc(activeModel || '—')}</h3><span>${fmt(items.length)} códigos disponíveis na aba cabines</span></div><span class="pins-legend"><i></i> Estoque insuficiente para o plano</span></div><div class="panel-body">${items.length ? `<div class="toolbar pins-toolbar"><input class="input" id="cabins-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="cabins-coverage"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regulares</option></select><select class="select" id="cabins-stock-filter"><option value="all">Estoque: todos</option><option value="zero">Estoque igual a zero</option><option value="positive">Estoque maior que zero</option></select></div><div class="table-wrap pins-table-wrap"><table class="data-table pins-table pins-simulation-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Pedido em aberto</th><th>Necessidade / máquina</th><th>Máquinas</th><th>Necessidade calculada</th><th>Saldo</th><th>Situação</th></tr></thead><tbody id="cabins-table-body"></tbody></table></div><div class="table-footer specialized-load-more" id="cabins-load-more"></div>` : `<div class="empty cabins-empty">${emptyMessage}</div>`}</div></div></div>`;
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
  return visible.map(item => `<tr><td><button class="material-code specialized-material-code" data-code="${esc(item.code)}">${esc(item.code)}</button><div class="desc">${esc(item.description)}</div></td><td>${fmt(item.stock)} ${esc(item.unit||'UN')}</td><td>${specializedOrderInfo(item).label}</td><td>${fmt(item.minimum)}</td><td>${fmt(cars)}</td><td>${fmt(item.required)}</td><td class="${item.balance<0?'danger-text':''}">${fmt(item.balance)}</td><td><span class="status ${item.color}">${item.status}</span></td><td>${purchaseAction(item,'explosion',item.required,'Chaparias')}</td></tr>`).join('');
}
function renderSheetMetalSimulation() {
  const model=selectedSheetMetalModel||SHEET_METAL.models[0]||'CHAPARIAS'; const cars=Math.max(1,sheetMetalCars); const query=$('#sheet-metal-search')?.value||''; const status=$('#sheet-metal-coverage')?.value||'all'; const stock=$('#sheet-metal-stock-filter')?.value||'all'; const body=$('#sheet-metal-table-body'); if(body) body.innerHTML=sheetMetalRows(SHEET_METAL.items||[],model,cars,query,status,stock)||'<tr><td colspan="10" class="empty">Nenhuma chaparia corresponde aos filtros.</td></tr>'; setSpecializedLoadMore('sheetMetal',specializedCounts.sheetMetal,Math.min(specializedCounts.sheetMetal,specializedLimits.sheetMetal),renderSheetMetalSimulation); bindMaterialButtons(); bindPurchaseButtons();
}
function sheetMetalView() { const items=SHEET_METAL.items||[]; const models=SHEET_METAL.models||['CHAPARIAS']; const active=selectedSheetMetalModel||models[0]; return `<div class="pins-page"><div class="view-title pins-heading"><div><span class="eyebrow">Planejamento especializado</span><h2>Chaparias</h2><p>Dados lidos diretamente da aba chaparias da Explosão.</p></div><div class="date-pill">${esc(SHEET_METAL.sourceFile||'Aba chaparias')}</div></div><div class="pins-model-strip">${models.map(m=>`<button class="pins-model-card${m===active?' selected':''}" data-sheet-metal-model="${esc(m)}"><span>Chaparias</span><strong>${esc(m)}</strong><small>${m===active?'modelo selecionado':'selecionar modelo'}</small></button>`).join('')}</div><div class="panel pins-panel"><div class="panel-header"><div><h3>Detalhamento das chaparias</h3><span>${fmt(items.length)} códigos disponíveis na aba chaparias</span></div><span class="pins-legend"><i></i> Estoque insuficiente para o mínimo</span></div><div class="panel-body">${items.length?`<div class="toolbar pins-toolbar"><input class="input" id="sheet-metal-search" placeholder="Pesquisar código ou descrição" /><select class="select" id="sheet-metal-coverage"><option value="all">Todas as situações</option><option value="Crítico">Críticos</option><option value="Em atenção">Em atenção</option><option value="Regular">Regulares</option></select><select class="select" id="sheet-metal-stock-filter"><option value="all">Estoque: todos</option><option value="zero">Estoque igual a zero</option><option value="positive">Estoque maior que zero</option></select></div><div class="table-wrap pins-table-wrap"><table class="data-table pins-table pins-simulation-table"><thead><tr><th>Código / descrição</th><th>Estoque</th><th>Pedido em aberto</th><th>Mínimo</th><th>Quantidade</th><th>Necessidade</th><th>Saldo</th><th>Situação</th><th>Compras</th></tr></thead><tbody id="sheet-metal-table-body"></tbody></table></div><div class="table-footer specialized-load-more" id="sheetMetal-load-more"></div>`:'<div class="empty">Nenhuma chaparia encontrada.</div>'}</div></div></div>`; }
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
  return items.map(alert => `<tr><td><span class="status ${productionAlertStatusClass(alert.status)}">${esc(alert.status)}</span></td><td><b class="alert-title">ALERTA DA PRODUÇÃO</b><div class="desc">${esc(alert.message)}</div></td><td>${esc(alert.leader || '—')}</td><td>${esc(alert.line || '—')}</td><td><button class="material-code production-alert-code" data-alert-id="${esc(alert.id)}">${esc(alert.code || '—')}</button><div class="desc" title="${esc(alert.description)}">${esc(alert.description || 'Descrição não informada')}</div></td><td>${fmt(alert.stock)} ${esc(alert.unit || 'UN')}</td><td>${fmt(alert.orders)} ${esc(alert.unit || 'UN')}</td><td class="danger-text">${fmt(alert.suggestedPurchase)} ${esc(alert.unit || 'UN')}</td><td>${esc(alert.analyst || '—')}</td><td><button class="secondary-btn alert-detail-btn" data-alert-id="${esc(alert.id)}">Ver material</button><button class="primary-btn alert-status-btn" data-alert-id="${esc(alert.id)}">${alert.status === 'Novo' ? 'Iniciar análise' : alert.status === 'Em análise' ? 'Marcar resolvido' : 'Atualizar estado'}</button></td></tr>`).join('');
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
  return `<div class="view-title production-alert-heading"><div><h2>Alertas da produção</h2><p>Avisos enviados pelos líderes da produção.</p></div><button class="primary-btn" id="new-production-alert">＋ Enviar aviso</button></div><div class="summary-strip alert-metrics"><div class="summary-box"><b>${fmt(open.filter(alert => alert.status === 'Novo').length)}</b><span>Novos</span></div><div class="summary-box"><b>${fmt(open.filter(alert => alert.status === 'Em análise').length)}</b><span>Em análise</span></div><div class="summary-box"><b class="danger">${fmt(critical.length)}</b><span>Críticos</span></div><div class="summary-box"><b class="success">${fmt(resolvedToday.length)}</b><span>Resolvidos hoje</span></div></div><div class="panel alert-filter-panel"><div class="toolbar"><select class="select" id="production-alert-leader"><option value="all">Todos os líderes</option>${leaders.map(value => `<option value="${esc(value)}" ${selectedLeader === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select><select class="select" id="production-alert-line"><option value="all">Todas as linhas</option>${lines.map(value => `<option value="${esc(value)}" ${selectedLine === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select><select class="select" id="production-alert-status"><option value="all">Todos os estados</option>${['Novo', 'Em análise', 'Resolvido', 'Cancelado'].map(value => `<option value="${value}" ${selectedStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select class="select" id="production-alert-stock-filter"><option value="all" ${stockFilter === 'all' ? 'selected' : ''}>Estoque: todos</option><option value="zero" ${stockFilter === 'zero' ? 'selected' : ''}>Estoque igual a zero</option><option value="positive" ${stockFilter === 'positive' ? 'selected' : ''}>Estoque maior que zero</option></select><input class="input" id="production-alert-search" value="${esc(window.productionAlertQuery || '')}" placeholder="Pesquisar código, descrição ou mensagem" /><button class="secondary-btn" id="clear-production-alert-filters">Limpar filtros</button></div></div><div class="panel"><div class="table-wrap production-alert-table-wrap"><table class="data-table production-alert-table"><thead><tr><th>Estado</th><th>Alerta</th><th>Líder</th><th>Linha</th><th>Código / descrição</th><th>Estoque</th><th>Pedidos em aberto</th><th>Compra sugerida</th><th>Analista</th><th>Ações</th></tr></thead><tbody>${productionAlertRows(items) || '<tr><td colspan="10" class="empty">Nenhum alerta encontrado.</td></tr>'}</tbody></table></div><div class="table-footer">Mostrando ${items.length} de ${all.length} alerta(s).</div></div>`;
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

// Reconstrói o conteúdo da tela sempre que uma área ou filtro muda.
function render() {
  if (!DATA) return;
  const titles = { productionMap: 'Mapa produtivo', overview: 'Visão geral', stock: 'Estoque', simulation: 'Simulação', history: 'Evolução do estoque', consumables: 'Consumíveis', pins: 'Pinos por modelo', modelNiguri: 'NIGURI dos modelos', cylinders: 'Cilindros por modelo', cabins: 'Cabines por modelo', sheetMetal: 'Chaparias', calfer: 'Estoque Calfer', purchaseProcess: 'Processo de compra', excess: 'Pedidos em excesso', followup: 'Acompanhamento', productionAlerts: 'Aviso da produção' };
  $('#page-title').textContent = titles[view];
  const pages = { productionMap: productionMapView, overview, stock: stockView, simulation, followup: followUpView, history: stockHistoryView, consumables: consumablesView, pins: pinsView, modelNiguri: modelNiguriView, cylinders: cylindersView, cabins: cabinsView, sheetMetal: sheetMetalView, calfer: calferView, purchaseProcess: renderPurchaseProcessPage, excess: excessView, productionAlerts: productionAlertsView };
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
  if (view === 'productionMap') {
    const search = $('#production-map-search'); const status = $('#production-map-status');
    if (search) search.oninput = () => {
      productionMapQuery = search.value || '';
      const query = productionMapQuery.trim().toLowerCase();
      let visible = 0;
      document.querySelectorAll('.production-map-row').forEach(row => {
        const matches = !query || String(row.dataset.productionRowText || '').includes(query);
        row.hidden = !matches;
        if (matches) visible += 1;
      });
      const counter = $('#production-map-count');
      if (counter) counter.textContent = `${fmt(visible)} registros encontrados`;
    };
    if (status) status.onchange = () => { productionMapStatus = status.value || 'all'; render(); };
    const dateStart = $('#production-map-date-start'); const dateEnd = $('#production-map-date-end'); const weekStart = $('#production-map-week-start'); const weekEnd = $('#production-map-week-end');
    if (dateStart) dateStart.onchange = () => { productionMapDateStart = dateStart.value || ''; render(); };
    if (dateEnd) dateEnd.onchange = () => { productionMapDateEnd = dateEnd.value || ''; render(); };
    if (weekStart) weekStart.onchange = () => { productionMapWeekStart = weekStart.value || 'all'; render(); };
    if (weekEnd) weekEnd.onchange = () => { productionMapWeekEnd = weekEnd.value || 'all'; render(); };
    const clearFilters = $('#production-map-clear-filters');
    if (clearFilters) clearFilters.onclick = () => { productionMapQuery = ''; productionMapStatus = 'all'; productionMapDateStart = ''; productionMapDateEnd = ''; productionMapWeekStart = 'all'; productionMapWeekEnd = 'all'; render(); };
    document.querySelectorAll('.production-en-btn').forEach(button => button.onclick = () => openProductionMapDetail(button.dataset.productionEn || ''));
  }
  if (view === 'overview') {
    const releaseWeek = $('#release-week-filter');
    if (releaseWeek) releaseWeek.onchange = () => { releaseWeekFilter = releaseWeek.value; render(); };
    const exportRelease = $('#export-release-week');
    if (exportRelease) exportRelease.onclick = () => exportReleaseWeekXlsx().catch(error => { console.error('Falha ao exportar carros a liberar.', error); alert('Não foi possível gerar o Excel. Tente novamente.'); });
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
  bindStockMinimumInputs();
  if (view === 'modelNiguri') {
    const model = $('#model-niguri-model'); const week = $('#model-niguri-start-week'); const analystSelect = $('#model-niguri-analyst'); const search = $('#model-niguri-search'); const status = $('#model-niguri-status');
    if (model) model.onchange = () => { modelNiguriModel = model.value; modelNiguriStartWeek = 'all'; modelNiguriVisibleLimit = MODEL_NIGURI_PAGE_SIZE; render(); };
    if (week) week.onchange = () => { modelNiguriStartWeek = week.value; modelNiguriVisibleLimit = MODEL_NIGURI_PAGE_SIZE; render(); };
    if (analystSelect) analystSelect.onchange = () => { modelNiguriAnalyst = analystSelect.value; modelNiguriVisibleLimit = MODEL_NIGURI_PAGE_SIZE; render(); };
    if (search) search.oninput = () => { modelNiguriVisibleLimit = MODEL_NIGURI_PAGE_SIZE; refreshModelNiguriTable(); };
    if (status) status.onchange = () => { modelNiguriVisibleLimit = MODEL_NIGURI_PAGE_SIZE; refreshModelNiguriTable(); };
    bindModelNiguriLoadMore();
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
    if (machines) machines.oninput = () => {
      calferMachineCount = Math.max(1, Math.floor(n(machines.value) || 1));
      const value = calferMachineCount;
      if (String(machines.value) !== String(value)) machines.value = value;
      render();
      const refreshed = $('#calfer-machines');
      if (refreshed) { refreshed.focus(); refreshed.setSelectionRange(String(value).length, String(value).length); }
    };
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
      if (modelSelect) modelSelect.onchange = () => { selectedPinModel = modelSelect.value; pinsNiguriStartWeek = 'all'; render(); };
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
      $('#consumables-table-body').innerHTML = consumableRows(items) || '<tr><td colspan="11" class="empty">Nenhum consumível encontrado.</td></tr>';
      document.querySelectorAll('.consumable-code').forEach(button => button.onclick = () => openConsumableDetail(button.dataset.code));
      bindPurchaseButtons();
    };
    $('#consumables-search').oninput = filter;
    $('#consumables-stock-status').onchange = filter;
    $('#consumables-max-status').onchange = filter;
    $('#consumables-followup').onchange = filter;
  }

  if (view === 'stock') {
    const monthSelect = $('#stock-plan-month');
    const filter = () => {
      const query = ($('#stock-search').value || '').toLowerCase();
      const selectedRisk = $('#stock-risk').value;
      const period = monthSelect?.value || stockPlanMonth || currentPlanMonthPeriod();
      stockPlanMonth = period;
      const items = scopedItems().filter(item => (!query || `${item.code} ${item.description}`.toLowerCase().includes(query)) && (selectedRisk === 'all' || risk(item, totalDemand(item))[0] === selectedRisk));
      $('#stock-table').innerHTML = table(items, 250, false, '', true, period);
      bindMaterialButtons();
      bindPurchaseButtons();
      bindProgressiveTables();
      bindStockMinimumInputs();
    };
    $('#stock-search').oninput = filter;
    $('#stock-risk').onchange = filter;
    if (monthSelect) monthSelect.onchange = filter;
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

// Mantém a animação visível apenas o suficiente para não piscar e carrega os dados uma vez.
async function showSplashThenDashboard(user) {
  setAuthenticatedSession(user);
  showSplashScreen();
  const minimumSplashTime = new Promise(resolve => setTimeout(resolve, 450));
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
    showSplashThenDashboard(user);
  };
}

// Lê o JSON local e inicia a primeira renderização do dashboard.
async function load() {
  try {
    const [dataResponse, historyResponse, consumablesResponse, planoResponse, annualPlanResponse, productionMapResponse, pinsResponse, cylindersResponse, cabinsResponse, sheetMetalResponse, programacaoResponse, calferResponse] = await Promise.all([
      fetch('data/explosao.json'),
      fetch('data/historico-estoque.json'),
      fetch('data/consumiveis.json'),
      fetch('data/plano-mes.json'),
      fetch('data/plano-anual.json'),
      fetch('data/mapa-produtivo.json'),
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
    PRODUCTION_MAP = productionMapResponse.ok ? await productionMapResponse.json() : { records: [], summary: {} };
    PINS = pinsResponse.ok ? await pinsResponse.json() : { items: [], models: [] };
    CYLINDERS = cylindersResponse.ok ? await cylindersResponse.json() : { items: [], models: [] };
    CABINS = cabinsResponse.ok ? await cabinsResponse.json() : { items: [], models: [] };
    SHEET_METAL = sheetMetalResponse.ok ? await sheetMetalResponse.json() : { items: [], models: [] };
    DATA.programacaoModels = programacaoResponse.ok ? await programacaoResponse.json() : { models: [] };
    CALFER = calferResponse.ok ? await calferResponse.json() : { nextModels: [], calferModels: [], items: [], transactions: [] };
    loadCalferTransactions();
    CONSUMABLES.items = (CONSUMABLES.items || []).map(item => ({ ...item }));
    PINS.items = (PINS.items || []).map(item => ({ ...item }));
    CYLINDERS.items = (CYLINDERS.items || []).map(item => ({ ...item }));
    SHEET_METAL.items = (SHEET_METAL.items || []).map(item => ({ ...item, unit: item.unit || 'UN' }));
    CABINS.items = (CABINS.items || []).map(item => ({ ...item, unit: item.unit || 'UN' }));
    syncPlanMonthDemands();
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
$('#login-christmas-toggle').onclick = toggleChristmasTheme;
$('#dashboard-christmas-toggle').onclick = toggleChristmasTheme;
$('#logout-button').onclick = () => showLogin('Sessão terminada.');
loadThemePreference();
loadChristmasThemePreference();
PRODUCTION_DISMISSED_ITEMS = loadProductionDismissedItems();
loadPurchaseProcess();
STOCK_MINIMUMS = loadStockMinimums();
loadCalferTransactions();
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
