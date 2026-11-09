"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "assets/app.js"), "utf8");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/explosao.json"), "utf8"));
const planMonth = JSON.parse(fs.readFileSync(path.join(root, "data/plano-mes.json"), "utf8"));
const cabins = JSON.parse(fs.readFileSync(path.join(root, "data/cabines.json"), "utf8"));
function between(start, end) {
  const a = app.indexOf(start); const b = app.indexOf(end, a);
  assert.notEqual(a, -1, `não encontrou ${start}`); assert.notEqual(b, -1, `não encontrou ${end}`);
  return app.slice(a, b);
}
const snippets = [
  between("function planMonthPeriods()", "function currentPlanMonthPeriod()"),
  between("function modelNiguriNormalize", "function modelNiguriStructureRows")
].join("\n");
const context = { DATA: { ...data, planMonth }, CABINS: cabins, n: value => Number(value) || 0 };
vm.createContext(context);
vm.runInContext(`${snippets}\nthis.api = { planMonthPeriods, planMonthModelQuantity, planModelStructureRows, orderQuantityForPeriod, syncPlanMonthDemands };`, context);

const { api } = context;
api.syncPlanMonthDemands();
const periods = api.planMonthPeriods();
assert.deepEqual(context.DATA.demandMonths, periods.map(period => `DEM ${period.key}`));
for (const model of ["10S", "13", "13-69", "guindaste 16", "guindate 25", "guindaste 21", "guindaste 45", "guindaste 7,5", "guindaste 30T", "cabine 4 lugar", "cabine 6 lugar com banheiro", "carroceriaAberta"]) {
  assert.ok(api.planModelStructureRows(model).length > 0, `${model} deve resolver para uma estrutura`);
}
assert.ok(context.DATA.planMonthUnmatchedModels.includes("guindaste 35"), "modelo PLANO MES sem estrutura deve ser identificado");

const component = api.planModelStructureRows("guindaste 16").find(entry => context.DATA.items.some(item => String(item.code) === String(entry.code)));
assert.ok(component, "o NIGURI/Estoque deve encontrar um componente real do guindaste de 16T");
const item = context.DATA.items.find(entry => String(entry.code) === String(component.code));
for (const period of periods) {
  const expected = planMonth.models.reduce((sum, modelEntry) => {
    const units = api.planMonthModelQuantity(modelEntry, period);
    const need = api.planModelStructureRows(modelEntry.modelo)
      .filter(row => String(row.code) === String(item.code))
      .reduce((subtotal, row) => subtotal + Number(row.quantity || 0) * units, 0);
    return sum + need;
  }, 0);
  assert.ok(Math.abs(Number(item.demands[`DEM ${period.key}`] || 0) - expected) < 1e-6, `demanda do componente ${item.code} no período ${period.key}`);
}
assert.equal(api.orderQuantityForPeriod({ orders: { "PED 11/2026": 4, "PED 12/2026": 9 } }, "11/2026"), 4);
assert.equal(api.orderQuantityForPeriod({ orders: { "PED 11": 3 } }, "11/2026"), 3, "compatibilidade com pedido sem ano explícito");
console.log("DEMANDA_PLANO_MES_OK: períodos, aliases, cabines, guindastes, pedidos e demanda em Estoque validados");
