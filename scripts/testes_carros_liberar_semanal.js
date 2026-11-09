"use strict";
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
const DATA = JSON.parse(fs.readFileSync(path.join(root, 'data/explosao.json'), 'utf8'));
DATA.planAnnual = JSON.parse(fs.readFileSync(path.join(root, 'data/plano-anual.json'), 'utf8'));
const PRODUCTION_MAP = JSON.parse(fs.readFileSync(path.join(root, 'data/mapa-produtivo.json'), 'utf8'));
const get = (start, end) => {
  const a = source.indexOf(start); const b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`função não encontrada: ${start}`);
  return source.slice(a, b);
};
const snippets = [
  get('function annualWeekInfo', 'function productionStatusExcluded'),
  get('function pinsNiguriNormalize', 'function planMonthModelQuantity'),
  get('function modelNiguriStructureRows', 'function modelNiguriPlanEntries'),
  get('function pinsNiguriMonthSlots', 'function pinsNiguriOrders'),
  get('async function exportReleaseWeekXlsx', 'function programacaoAlertPanel')
].join('\n');
const context = {
  DATA, PRODUCTION_MAP, view: 'overview', releaseWeekFilter: '',
  n: value => Number(value) || 0,
  fmt: value => String(Number(value) || 0),
  esc: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
  itemByCode: code => DATA.items.find(item => String(item.code) === String(code)),
  hasOpenOrder: item => Object.values(item.orders || {}).some(value => Number(value) > 0),
  risk: (item, demand) => {
    const needed = Number(demand) || 0; const orders = Object.values(item.orders || {}).some(value => Number(value) > 0);
    if (needed <= 0) return ['Regular', 'green'];
    if (Number(item.stock) <= 0) return ['Crítico', 'red'];
    if (orders) return ['Em atenção', 'amber'];
    if (Number(item.stock) < needed) return ['Crítico', 'red'];
    return ['Regular', 'green'];
  },
  getWeekNumber: (date) => {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = target.getUTCDay() || 7; target.setUTCDate(target.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  }
};
context.window = {};
context.annualWeekInfo = undefined;
context.pinsNiguriCurrentWeekKey = () => {
  const now = new Date(); const day = now.getDay() || 7; now.setDate(now.getDate() - day + 1);
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
};
vm.createContext(context);
vm.runInContext(`${snippets}\nthis.api = { annualWeekInfo, releaseRowsForWeek, releaseWeekOptions, releaseCurrentRows, programacaoAlertPanel, modelNiguriStructureName, exportReleaseWeekXlsx };`, context);
const { api } = context;
const options = api.releaseWeekOptions();
if (!options.length) throw new Error('Plano Anual deve fornecer semanas selecionáveis');
let checks = 0;
const assert = (value, message) => { checks += 1; if (!value) throw new Error(`Falha ${checks}: ${message}`); };
const chosen = options.find(option => option.key >= context.pinsNiguriCurrentWeekKey()) || options[0];
const rows = api.releaseRowsForWeek(chosen.key);
assert(rows.length > 0, `${chosen.label} deve trazer ENs agrupadas por semana do Plano Anual`);
assert(rows.every(row => row.week.key === chosen.key), 'todas as linhas pertencem apenas à semana filtrada');
assert(rows.every(row => row.en && row.model && row.client), 'cada linha deve incluir EN, modelo e cliente');
assert(rows.every(row => Array.isArray(row.criticalItems) && Array.isArray(row.attentionItems)), 'cada EN deve incluir listas separadas de criticidade');
assert(rows.every(row => ['Crítico', 'Em atenção'].every(status => [...row.criticalItems, ...row.attentionItems].every(item => item.code && item.description))), 'itens de risco devem conter código e descrição');
const byWeek = api.releaseRowsForWeek(options[0].key);
assert(byWeek.every(row => row.week.key === options[0].key), 'filtro de outra semana não deve misturar ENs');
context.releaseWeekFilter = chosen.key;
const html = api.programacaoAlertPanel();
for (const field of ['EN', 'Modelo', 'Cliente', 'Itens críticos', 'Itens em atenção', 'Previsão de pedido', 'export-release-week']) assert(html.includes(field), `a interface deve apresentar ${field}`);
assert(html.includes('PLANO ANUAL') && html.includes('release-week-filter'), 'a secção deve declarar a fonte anual e o filtro semanal');
assert(source.includes("workbook.addWorksheet('Carros a liberar'") && source.includes('writeBuffer()') && source.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'exportação deve gerar um arquivo XLSX real');
const exportFunction = source.slice(source.indexOf('async function exportReleaseWeekXlsx'), source.indexOf('function programacaoAlertPanel'));
assert(exportFunction.includes('const exportRows = rows') && exportFunction.includes("|| 'Sem crítico'") && exportFunction.includes("'Itens críticos'") && !exportFunction.includes('Itens em atenção'), 'XLSX deve manter todas as ENs, marcar as sem crítico e omitir itens em atenção');
assert(exportFunction.includes("'Previsão de pedido'") && exportFunction.includes("sheet.autoFilter") && exportFunction.includes("sheet.pageSetup"), 'XLSX crítico deve manter previsão, filtros e formatação de impressão');
assert(html.includes('Exportar semana (.xlsx)'), 'o botão deve deixar claro que exporta a semana filtrada');
console.log(`CARROS_LIBERAR_SEMANAL_OK checks=${checks} weeks=${options.length} rows=${rows.length}`);
