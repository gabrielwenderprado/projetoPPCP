"""Regressões para estoque mínimo local e decisão de compra do dashboard."""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = (ROOT / "assets/app.js").read_text(encoding="utf-8")
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
DATA = json.loads((ROOT / "data/explosao.json").read_text(encoding="utf-8"))
checks: list[tuple[str, bool]] = []
def check(name: str, condition: bool) -> None:
    checks.append((name, bool(condition)))

check("JavaScript passa pela verificação de sintaxe", subprocess.run(["node", "--check", "assets/app.js"], cwd=ROOT, capture_output=True).returncode == 0)
check("mínimos são guardados somente no localStorage do navegador", "pcm-stock-minimums-v1" in JS and "localStorage.setItem(STOCK_MINIMUMS_STORAGE_KEY" in JS)
check("mínimo pode ser editado diretamente na tabela", 'data-stock-minimum="${esc(item.code)}"' in JS and "bindStockMinimumInputs" in JS)
check("editar mínimo valida valor e permite restaurar padrão", "setConfiguredMinimum" in JS and "delete STOCK_MINIMUMS[key]" in JS)
check("itens abaixo do mínimo recebem indicação", "isBelowMinimum(item)" in JS and "Abaixo do mínimo" in JS)
check("estoque mínimo local é coluna da tabela", "Estoque mínimo (local)" in JS)
check("quantidade sugerida considera o mínimo configurado", "totalDemand + configuredMinimum(item) - n(item.stock)" in JS)
check("sugestão positiva tem prioridade operacional para Comprar", JS.index("if (suggested > 0) return { label: 'Comprar'") < JS.index("if (followUp) return { label: 'Follow-up'") )
check("processo de compra mantém botão quando a ação é Comprar", "decision.canBuy ? purchaseAction" in JS)
check("coluna de última movimentação foi removida", "Última movimentação" not in JS and "lastMovement" not in JS and "movementDate" not in JS)
check("navegação principal continua com Estoque e NIGURI", 'data-view="stock"' in HTML and 'data-view="pins"' in HTML)
check("snapshot mantém itens, pedidos e demandas", len(DATA.get("items", [])) > 0 and all("orders" in item and "demands" in item for item in DATA["items"][:100]))
check("edição de mínimo não redesenha página", "setConfiguredMinimum(input.dataset.stockMinimum, input.value); updateStockMinimumRow(input);" in JS and "setConfiguredMinimum(input.dataset.stockMinimum, input.value); render();" not in JS)
check("actualização conserva botão do código e input editado", "row.cells[statusIndex].innerHTML" in JS and "row.cells[purchaseIndex].innerHTML" in JS and "input.value = configuredMinimum(item)" in JS)
check("detalhe mostra o mínimo local como segurança", "fmt(configuredMinimum(item))" in JS)
check("demanda total da tabela agrega todos os períodos", "const periodDemand = includeDemand ? totalDemand : undefined" in JS and "Demanda total PLANO MES" in JS)

for name, passed in checks:
    print(f"[{'OK' if passed else 'FALHA'}] {name}")
failed = [name for name, passed in checks if not passed]
print(f"\n{len(checks)-len(failed)} aprovados; {len(failed)} falhas.")
if failed:
    sys.exit(1)
