from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
passed = 0
failed = []


def check(number: int, description: str, condition: bool) -> None:
    global passed
    if condition:
        passed += 1
        print(f"[OK {number:02d}] {description}")
    else:
        failed.append(f"{number:02d} - {description}")
        print(f"[FALHA {number:02d}] {description}")


js = (ROOT / "assets/app.js").read_text(encoding="utf-8")
html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "assets/styles.css").read_text(encoding="utf-8")
converter = (ROOT / "scripts/convert_pinos.py").read_text(encoding="utf-8")
main_converter = (ROOT / "scripts/convert_excel.py").read_text(encoding="utf-8")
data = json.loads((ROOT / "data/pinos.json").read_text(encoding="utf-8"))
explosion = json.loads((ROOT / "data/explosao.json").read_text(encoding="utf-8"))

check(1, "conversor de pinos existe", (ROOT / "scripts/convert_pinos.py").is_file())
check(2, "snapshot de pinos existe", (ROOT / "data/pinos.json").is_file())
check(3, "snapshot identifica a aba Pinos", data.get("sourceSheet") == "Pinos")
check(4, "snapshot contém seis modelos", len(data.get("models", [])) == 7)
check(5, "snapshot contém itens", len(data.get("items", [])) > 0)
check(6, "cada item possui código e descrição", all(item.get("code") and item.get("description") for item in data["items"]))
check(7, "cada item possui estoque numérico", all(isinstance(item.get("stock"), (int, float)) for item in data["items"]))
check(8, "cada item possui necessidade por todos os modelos", all(set(data["models"]).issubset(item.get("modelNeeds", {})) for item in data["items"]))
check(9, "necessidade total é consistente", all(item["totalNeed"] == sum(item["modelNeeds"].values()) for item in data["items"]))
check(10, "quantidade de modelos utilizados é consistente", all(item["modelCount"] == sum(value > 0 for value in item["modelNeeds"].values()) for item in data["items"]))
check(11, "itens estão ordenados por necessidade decrescente", [item["totalNeed"] for item in data["items"]] == sorted((item["totalNeed"] for item in data["items"]), reverse=True))
check(12, "conversor reconhece cabeçalho Código", '"código"' in converter.lower())
check(13, "conversor lê linhas a partir da 4", "FIRST_DATA_ROW = 4" in converter)
check(14, "conversor procura a aba Pinos", '"Pinos", "pinos"' in converter)
check(15, "conversor é chamado pelo fluxo principal", "extrair_pinos(SOURCE, PINOS_OUTPUT)" in main_converter)
check(16, "menu contém a área de pinos", 'data-view="pins"' in html)
check(17, "JavaScript carrega data/pinos.json", "fetch('data/pinos.json')" in js)
check(18, "JavaScript possui vista de pinos", "function pinsView()" in js)
check(19, "vista de pinos possui tabela por modelo", "item.modelNeeds?.[model]" in js)
check(20, "vista possui pesquisa", "pins-search" in js)
check(21, "vista possui filtro de situação", "pins-coverage" in js)
check(22, "vista possui seleção de modelo", "data-pin-model" in js and "selectedPinModel" in js)
check(23, "vista possui quantidade de máquinas", "pins-cars" in js and "pinCars" in js)
check(24, "vista possui botão de cálculo", "run-pins-simulation" in js)
check(25, "simulação multiplica a necessidade pela quantidade de máquinas", "const required = unitNeed * cars" in js)
check(26, "simulação calcula o saldo projetado", "const balance = n(item.stock) - required" in js)
check(27, "simulação classifica os pinos", "function pinSimulationStatus" in js and "Crítico" in js and "Em atenção" in js and "Regular" in js)
check(28, "simulação exclui itens sem necessidade no modelo", ".filter(item => item.unitNeed > 0)" in js)
check(29, "simulação apresenta resumo por situação", "pins-result-summary" in js and "critical" in js and "attention" in js)
check(30, "simulação preserva a pesquisa e o filtro", "renderPinSimulation" in js and "statusFilter" in js)
check(31, "tabela tem cabeçalho fixo", ".pins-table thead th" in css and "position: sticky" in css)
check(32, "área possui cartões de modelos", ".pins-model-card" in css and "pins-model-strip" in js)
check(33, "área possui regras responsivas", "@media (max-width: 760px)" in css and ".pins-toolbar" in css)
check(34, "outras vistas principais continuam no mapa", all(name in js for name in ["overview", "stockView", "ordersView", "modelsView", "simulation", "consumablesView", "renderPurchaseProcessPage"]))
check(35, "dados principais continuam sendo carregados", "fetch('data/explosao.json')" in js)
check(36, "conversor principal continua gerando o Plano Mês", "extrair_plano_mes(SOURCE, PLANO_OUTPUT)" in main_converter)
check(37, "snapshot principal contém itens", len(explosion.get("items", [])) > 0)
check(38, "JavaScript passa na verificação de sintaxe", subprocess.run(["node", "--check", str(ROOT / "assets/app.js")], capture_output=True).returncode == 0)
check(39, "conversor de pinos passa na compilação", subprocess.run([sys.executable, "-m", "py_compile", str(ROOT / "scripts/convert_pinos.py")], capture_output=True).returncode == 0)
positive = next((item for item in data["items"] if any(value > 0 for value in item["modelNeeds"].values())), None)
if positive:
    model = next(model for model, value in positive["modelNeeds"].items() if value > 0)
    cars = 10
    required = positive["modelNeeds"][model] * cars
    balance = positive["stock"] - required
    check(40, "cálculo de 10 máquinas produz uma necessidade positiva", required > positive["modelNeeds"][model])
    check(41, "saldo de simulação é estoque menos necessidade", balance == positive["stock"] - required)
    check(42, "estrutura tem necessidade unitária e estoque para simular", positive["modelNeeds"][model] > 0 and isinstance(positive["stock"], (int, float)))
else:
    check(40, "existe item com necessidade positiva", False)
    check(41, "saldo de simulação é estoque menos necessidade", False)
    check(42, "estrutura tem necessidade unitária e estoque para simular", False)

print(f"Resultado: {passed} verificações aprovadas; {len(failed)} falhas.")
if failed:
    print("Falhas encontradas:")
    print("\n".join(failed))
    raise SystemExit(1)
