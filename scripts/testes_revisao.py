"""Bateria de verificações da cópia revisada do dashboard.

Cada teste valida uma propriedade independente do projeto para tornar a revisão
repetível antes de qualquer atualização futura.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
passed = 0
failed: list[str] = []

def check(number: int, description: str, condition: bool) -> None:
    global passed
    if condition:
        passed += 1
        print(f"[OK {number:02d}] {description}")
    else:
        failed.append(f"{number:02d} - {description}")
        print(f"[FALHA {number:02d}] {description}")


def run(command: list[str]) -> bool:
    return subprocess.run(command, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0

required_files = [
    "index.html", "assets/app.js", "assets/styles.css", "assets/login-pcp.png",
    "NEXT - Logo_edited.avif", "data/explosao.json", "data/historico-estoque.json", "README.md", "GUIA-LOGIN.md",
    "scripts/convert_excel.py", "scripts/convert_plano_mes.py", "scripts/convert_pinos.py", "data/plano-mes.json", "data/pinos.json", "data/alertas-config.json", "scripts/google-apps-script-alertas.gs", "start-local.bat", "start-local.sh", "atualizar-dados.bat",
]
for index, relative in enumerate(required_files, 1):
    check(index, f"ficheiro obrigatório presente: {relative}", (ROOT / relative).is_file())

html = (ROOT / "index.html").read_text(encoding="utf-8")
js = (ROOT / "assets/app.js").read_text(encoding="utf-8")
css = (ROOT / "assets/styles.css").read_text(encoding="utf-8")
readme = (ROOT / "README.md").read_text(encoding="utf-8")
converter = (ROOT / "scripts/convert_excel.py").read_text(encoding="utf-8")
start_bat = (ROOT / "start-local.bat").read_text(encoding="utf-8")
start_sh = (ROOT / "start-local.sh").read_text(encoding="utf-8")
atualizar_bat = (ROOT / "atualizar-dados.bat").read_text(encoding="utf-8")

check(14, "HTML declara idioma pt-BR", 'lang="pt-BR"' in html)
check(15, "HTML contém o formulário de login", 'id="login-form"' in html)
check(16, "HTML contém o contentor principal do dashboard", 'id="app"' in html)
check(17, "HTML referencia o JavaScript principal", 'assets/app.js' in html)
check(18, "HTML referencia a folha de estilos", 'assets/styles.css' in html)
check(19, "JavaScript contém a lista LOGIN_USERS", 'const LOGIN_USERS = [' in js)
check(20, "JavaScript contém a chave de sessão", "pcm-dashboard-session" in js)
check(21, "JavaScript contém a leitura do JSON", "fetch('data/explosao.json')" in js)
check(22, "JavaScript contém a visão de acompanhamento", "followup: 'Acompanhamento'" in js)
check(23, "JavaScript contém a abertura do detalhe do material", "openMaterialDetail" in js)
check(24, "JavaScript contém a leitura do histórico", "data/historico-estoque.json" in js)
check(25, "JavaScript contém o gráfico histórico de barras", "stockHistoryChart" in js and "history-bar" in js and "history-line" not in js)
check(26, "HTML contém o botão de evolução", 'data-view="history"' in html)
check(27, "JavaScript contém a simulação por modelo", "run-simulation" in js)
check(28, "CSS contém regras de login", ".login-screen" in css)
check(29, "CSS contém regras da tabela", ".data-table" in css)
check(30, "CSS contém estilos das barras históricas", ".history-chart" in css and ".history-bar" in css)
check(31, "README documenta a porta 5502", "5502" in readme)
check(32, "script Windows verifica index.html", "INDEX_FILE" in start_bat and "index.html" in start_bat)
check(33, "script Windows usa a porta 5502", "http.server 5502" in start_bat)
check(34, "script Linux verifica index.html", '[ ! -f "$SCRIPT_DIR/index.html" ]' in start_sh)
check(35, "script Linux usa a porta 5502", "http.server 5502" in start_sh)
check(36, "conversor importa Path", "from pathlib import Path" in converter)
check(37, "conversor escreve no JSON do projeto", "OUTPUT = PROJECT_ROOT / 'data' / 'explosao.json'" in converter)
check(38, "conversor escreve no histórico", "HISTORY_OUTPUT" in converter and "stockValue" in converter)
check(39, "JavaScript passa pela verificação de sintaxe", run(["node", "--check", "assets/app.js"]))
check(40, "conversor Python passa pela compilação", run([sys.executable, "-B", "-c", "compile(open('scripts/convert_excel.py', encoding='utf-8').read(), 'scripts/convert_excel.py', 'exec')"]))

try:
    data = json.loads((ROOT / "data/explosao.json").read_text(encoding="utf-8"))
    check(41, "JSON possui itens", isinstance(data.get("items"), list) and len(data["items"]) > 0)
    check(42, "JSON possui modelos", isinstance(data.get("models"), dict) and len(data["models"]) > 0)
    check(43, "JSON possui analistas", isinstance(data.get("analysts"), list))
    check(44, "JSON possui famílias", isinstance(data.get("families"), list))
    check(45, "JSON possui tipos de obtenção", isinstance(data.get("obtentionTypes"), list))
    check(46, "JSON possui meses de demanda", isinstance(data.get("demandMonths"), list))
    check(47, "itens têm código, estoque e segurança", all(all(key in item for key in ("code", "stock", "safety")) for item in data["items"]))
    check(48, "itens têm pedidos e demandas", all(all(key in item for key in ("orders", "demands")) for item in data["items"]))
    check(49, "modelos têm componentes", all(isinstance(items, list) for items in data["models"].values()))
    check(50, "códigos dos itens não estão vazios", all(str(item["code"]).strip() for item in data["items"]))
except Exception:
    for number in range(41, 51):
        check(number, "JSON carregável e íntegro", False)

history = json.loads((ROOT / "data/historico-estoque.json").read_text(encoding="utf-8"))
check(51, "histórico é um objeto com records", isinstance(history.get("records"), list) and len(history["records"]) > 0)
check(52, "registos do histórico têm data, valor e quantidade", all(all(key in item for key in ("date", "stockValue", "itemCount")) for item in history["records"]))
check(53, "valores do histórico são numéricos", all(isinstance(item["stockValue"], (int, float)) and isinstance(item["itemCount"], (int, float)) for item in history["records"]))
check(54, "não há referência à pasta antiga", "explosao-dashboard-local-update-002" not in readme)
check(55, "não há endereço 0.0.0.0 no arranque Windows", "0.0.0.0" not in start_bat)
check(56, "não há endereço 0.0.0.0 no arranque Linux", "0.0.0.0" not in start_sh)
check(57, "guia de login explica o campo username", "username" in (ROOT / "GUIA-LOGIN.md").read_text(encoding="utf-8"))
check(58, "guia de login explica a limpeza da sessão", "Ctrl + F5" in (ROOT / "GUIA-LOGIN.md").read_text(encoding="utf-8"))

plano = json.loads((ROOT / "data/plano-mes.json").read_text(encoding="utf-8"))
check(59, "Plano Mês contém períodos dinâmicos com ano", len(plano.get("periods", [])) > 0 and all(re.fullmatch(r"\d{2}/\d{4}", period.get("key", "")) for period in plano.get("periods", [])))
check(60, "Plano Mês contém todas as linhas de modelos", len(plano.get("models", [])) >= 21 and any(model.get("modelo") == "10HDOC" for model in plano.get("models", [])))
check(61, "Plano Mês identifica a origem e o intervalo real", plano.get("sourceSheet") == "PLANO MES" and re.fullmatch(r"A15:[A-Z]+\d+", plano.get("sourceRange", "")) is not None)
check(62, "configuração central permanece offline por padrão", json.loads((ROOT / "data/alertas-config.json").read_text(encoding="utf-8")).get("endpoint") == "")
apps_script = (ROOT / "scripts/google-apps-script-alertas.gs").read_text(encoding="utf-8")
check(63, "central possui leitura GET", "function doGet" in apps_script and "readAlerts_" in apps_script)
check(64, "central possui gravação POST", "function doPost" in apps_script and "writeAlerts_" in apps_script)
check(65, "JavaScript sincroniza alertas", "syncProductionAlerts" in js and "alerts" in js)
check(66, "Visão geral não renderiza tabela de atenção", "overview-attention-table" not in js)
check(67, "Visão geral exibe Plano Mês", "planMonthPanel" in js and "PLANO MES" in js)
check(68, "filtro de demanda exibe meses anteriores", "month.replace('DEM ', '')" in js)
check(69, "tabelas têm cabeçalho fixo", "position: sticky" in css and ".data-table thead th" in css)
check(70, "gráfico de pedidos explica a unidade", "Quantidade de itens/unidades" in js)
check(71, "Visão geral remove os cartões redundantes", "executive-summary-grid" not in js)
check(72, "Follow-up aparece abaixo do Processo de compra", "data-view=\"purchaseProcess\"" in html and "data-view=\"followup\"" in html and html.index('data-view="purchaseProcess"') < html.index('data-view="followup"'))
check(73, "gráfico normaliza totais acima de 100 mil", "function orderGraphValue" in js and "total / 10" in js)
check(74, "adição não recarrega nenhuma tabela filtrada", "addToPurchaseProcess(item, kind, { refresh: false })" in js and "refresh: view !== 'simulation'" not in js and "preserva filtros" in js)
check(75, "conversor identifica a coluna movimentação", "movement_i = idx_any" in converter and "lastMovement" in converter)
check(76, "tabelas exibem última movimentação", "Última movimentação" in js and "movementDate(item.lastMovement)" in js)
check(77, "ausência de movimentação mostra não tem", "return 'não tem'" in js and "or 'nao tem'" in converter)
check(78, "tabelas usam carregamento progressivo", "TABLE_CHUNK_SIZE = 250" in js and "bindProgressiveTables" in js)
check(79, "linhas adicionais são inseridas em blocos", "insertAdjacentHTML('beforeend'" in js and "end - start" in js)
check(80, "botão de carregar mais existe", "table-more-btn" in js and "Carregar mais" in js)
check(81, "conversor principal chama Plano Mês", "extrair_plano_mes(SOURCE, PLANO_OUTPUT)" in converter)
check(82, "conversor define o destino do Plano Mês", "PLANO_OUTPUT = PROJECT_ROOT / 'data' / 'plano-mes.json'" in converter)
check(83, "arranque informa os cinco snapshots", "data\\explosao.json, data\\plano-mes.json, data\\pinos.json, data\\cilindros.json e data\\historico-estoque.json" in atualizar_bat)
check(84, "itens da Explosão têm estoque máximo", all("stockMax" in item for item in data.get("items", [])))
check(85, "conversor identifica estoque máximo", "stock_max_i = idx_any" in converter and "'stockMax'" in converter)
check(86, "Consumíveis mantém processamento separado", "consumableStatus" in js and "consumiveis.json" in js)

# Testes específicos da análise mensal de pedidos em excesso.
check(87, "menu de pedidos em excesso", 'data-view="excess"' in html)
check(88, "pares mensais de pedido e demanda", "function excessMonthPairs" in js and "const demandMonth" in js)
check(89, "regra compara pedido e demanda do mesmo mês", "order > demand" in js)
check(90, "detalhe dos pedidos em excesso", "function openExcessDetail" in js and "Pedidos em excesso" in js)
check(91, "destaque vermelho no mês excedente", "detail-overdue" in js and "status red" in js)
check(92, "filtros da análise de excesso", "excess-month" in js and "excess-search" in js)
check(93, "menu de Pedidos e Modelos fundido em Estoque/NIGURI", 'data-view="orders"' not in html and 'data-view="models"' not in html)
check(94, "NIGURI lista as estruturas da aba Modelo", "Object.keys(DATA?.models || {}).sort" in js and "DATA?.planAnnual?.models" not in js[js.find("function modelNiguriView") : js.find("function pinsSimulationView")])
check(95, "procura de estoque calculada pelas estruturas e Plano Mês", "function syncPlanMonthDemands" in js and "planModelStructureRows(modelEntry.modelo)" in js and "syncPlanMonthDemands();" in js)
check(96, "aliases de guindastes e mapeamento ausente visível", "guindaste16" in js and "guindaste75" in js and "planMonthUnmatchedModels" in js)
check(97, "pedido e demanda mensal mostrados na mesma tabela", 'id="stock-plan-month"' in js and "orderQuantityForPeriod(item, stockPeriod)" in js and "Demanda PLANO MES" in js)
check(98, "parser lê todas as colunas e modelos reconhecidos", len(plano.get("periods", [])) == len(plano.get("months", [])) and len(plano.get("models", [])) >= 21)
annual = json.loads((ROOT / "data/plano-anual.json").read_text(encoding="utf-8"))
niguri_plan = js[js.find("function modelNiguriPlanEntries") : js.find("function modelNiguriRows")]
check(99, "Plano Anual preserva data diária e estrutura de cada EN", bool(annual.get("rows")) and all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", row.get("data", "")) and row.get("estrutura") for row in annual["rows"]))
check(100, "Plano Anual inclui guindastes com estrutura compatível", all(any(row.get("estrutura") == model for row in annual.get("rows", [])) for model in ("guin-16T", "guin-25T", "21T", "30-T", "7T")))
check(101, "Plano Anual sinaliza variante 45.5T sem BOM exacta", any("45.5T TRAVE 4H 3M" in entry.get("produto", "") for entry in annual.get("unmatchedCraneProducts", [])) and "modelNiguriUnmatchedCraneProducts(model)" in js)
check(102, "NIGURI usa ENs e datas do Plano Anual, mapeadas por estrutura", "DATA?.planAnnual?.rows" in niguri_plan and "DATA?.planMonth?.models" not in niguri_plan and "modelNiguriStructureName(plannedStructure) === structureName" in niguri_plan)
check(103, "parser PLANO MES reconhece colunas e linhas acrescentadas", run([sys.executable, "-B", "scripts/testes_plano_mes_dinamico.py"]))
check(104, "testes de integração do NIGURI por data e guindaste passam", run(["node", "scripts/testes_model_niguri_v9.js"]))
check(105, "teste de integração de demanda PLANO MES no Estoque passa", run(["node", "scripts/testes_demanda_plano_mes.js"]))
check(106, "conversor anual marca a coluna D como data prevista", annual.get("columns", {}).get("date") == "D")
check(107, "Carros a liberar usa EN, modelo, cliente e semana do Plano Anual", "DATA?.planAnnual?.rows" in js[js.find("function releaseRowsForWeek") : js.find("function releaseWeekOptions")] and all(field in js for field in ("entry.pedido", "entry.modelo", "entry.cliente", "entry.data")))
check(108, "Carros a liberar filtra uma semana e exporta Excel formatado", 'id="release-week-filter"' in js and 'id="export-release-week"' in js and "workbook.addWorksheet('Carros a liberar'" in js and "sheet.autoFilter" in js)
critical_export = js[js.find("async function exportReleaseWeekXlsx") : js.find("function programacaoAlertPanel")]
check(109, "exportação mantém todas as ENs e marca as sem crítico", "const exportRows = rows" in critical_export and "|| 'Sem crítico'" in critical_export and "'Itens críticos'" in critical_export and "Itens em atenção" not in critical_export)
check(110, "Excel local para exportação XLSX está empacotado", (ROOT / "assets/exceljs.min.js").is_file() and 'assets/exceljs.min.js' in html and 'assets/EXCELJS-LICENSE.txt' in str((ROOT / "assets/EXCELJS-LICENSE.txt")))
check(111, "teste integrado de carros a liberar por semana passa", run(["node", "scripts/testes_carros_liberar_semanal.js"]))
check(112, "CSS móvel cobre navegação, controles e lista de liberação", "@media (max-width: 760px)" in css and ".release-mobile-list { display:grid" in css and ".topbar-content { display:grid" in css)

print(f"\nResultado: {passed} verificações aprovadas; {len(failed)} falhas.")
if failed:
    print("Falhas encontradas:")
    print("\n".join(failed))
    raise SystemExit(1)
