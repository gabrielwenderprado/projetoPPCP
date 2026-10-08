from pathlib import Path
import json
import re
import sys
import unicodedata
from datetime import date

from openpyxl import load_workbook

OUTPUT_DEFAULT = Path(__file__).resolve().parents[1] / "data" / "pinos.json"


def text(value):
    return "" if value is None else str(value).strip()


def header_key(value):
    raw = unicodedata.normalize("NFKD", text(value))
    return "".join(char for char in raw if not unicodedata.combining(char)).lower().replace(" ", "")


def number(value):
    if isinstance(value, (int, float)):
        return float(value or 0)
    raw = text(value).replace(".", "").replace(",", ".")
    try:
        return float(raw) if raw else 0
    except ValueError:
        return 0


def compact(value):
    value = float(value or 0)
    return int(value) if value.is_integer() else round(value, 4)


def unique_name(name, used):
    base = re.sub(r"^PINOS\s*", "", text(name), flags=re.I).strip() or "Modelo"
    result = base
    index = 2
    while result in used:
        result = f"{base} ({index})"
        index += 1
    return result


def extrair_pinos_anual(ws, origem: Path, destino: Path) -> None:
    headers = [text(ws.cell(1, col).value) for col in range(1, ws.max_column + 1)]
    normalized = {header_key(value): index + 1 for index, value in enumerate(headers) if value}
    required = {"codigo", "descricao", "qtpormod", "modelo", "estoqueatual"}
    if not required.issubset(normalized):
        raise ValueError("A aba PinosAnual não contém as colunas esperadas.")

    code_col = normalized["codigo"]
    desc_col = normalized["descricao"]
    need_col = normalized["qtpormod"]
    model_col = normalized["modelo"]
    stock_col = normalized["estoqueatual"]
    week_columns = []
    for col in range(1, ws.max_column + 1):
        header = text(ws.cell(1, col).value).upper().replace(" ", "")
        match = re.fullmatch(r"S(4[1-9]|5[0-2])", header)
        if match:
            week_columns.append((int(match.group(1)), col))
    if not week_columns:
        raise ValueError("Nenhuma coluna semanal S41 a S52 foi encontrada em PinosAnual.")

    models = []
    items = {}
    for row in range(2, ws.max_row + 1):
        code = text(ws.cell(row, code_col).value)
        model = text(ws.cell(row, model_col).value)
        if not code or not model:
            continue
        if model not in models:
            models.append(model)
        item = items.setdefault(code, {
            "code": code,
            "description": text(ws.cell(row, desc_col).value),
            "unit": "UN",
            "stock": compact(number(ws.cell(row, stock_col).value)),
            "modelNeeds": {name: 0 for name in models},
            "weeklyDemand": {name: {} for name in models},
        })
        if not item["description"]:
            item["description"] = text(ws.cell(row, desc_col).value)
        item["stock"] = compact(number(ws.cell(row, stock_col).value))
        item["modelNeeds"].setdefault(model, 0)
        item["weeklyDemand"].setdefault(model, {})
        item["modelNeeds"][model] = compact(number(item["modelNeeds"].get(model)) + number(ws.cell(row, need_col).value))
        for week, col in week_columns:
            key = f"S{week}"
            item["weeklyDemand"][model][key] = compact(number(item["weeklyDemand"][model].get(key)) + number(ws.cell(row, col).value))

    for item in items.values():
        for model in models:
            item["modelNeeds"].setdefault(model, 0)
            item["weeklyDemand"].setdefault(model, {f"S{week}": 0 for week, _ in week_columns})
            for week, _ in week_columns:
                item["weeklyDemand"][model].setdefault(f"S{week}", 0)
        item["totalNeed"] = compact(sum(number(value) for value in item["modelNeeds"].values()))
        item["modelCount"] = sum(1 for value in item["modelNeeds"].values() if number(value) > 0)
    output_items = sorted(items.values(), key=lambda item: (-number(item["totalNeed"]), item["code"]))
    weekly_totals = {model: {f"S{week}": compact(sum(number(item["weeklyDemand"].get(model, {}).get(f"S{week}")) for item in output_items)) for week, _ in week_columns} for model in models}
    payload = {
        "sourceFile": origem.name,
        "sourceSheet": "PinosAnual",
        "generatedAt": date.today().isoformat(),
        "models": models,
        "weekYear": date.today().year,
        "weeks": [week for week, _ in week_columns],
        "weeklyTotals": weekly_totals,
        "items": output_items,
        "meta": {"headerRow": 1, "firstDataRow": 2, "weeklySource": True, "weekColumns": {f"S{week}": col for week, col in week_columns}},
    }
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PINOS_ANUAL_OK {len(output_items)} itens | {len(models)} modelos | semanas S{week_columns[0][0]}-S{week_columns[-1][0]} | {destino}")


def extrair_pinos_legado(ws, origem: Path, destino: Path) -> None:
    header_row, model_row, first_data_row = 3, 2, 4
    code_columns, used_models = [], set()
    for col in range(1, ws.max_column + 1):
        if text(ws.cell(header_row, col).value).lower() != "código":
            continue
        model = ""
        for candidate_col in range(col, min(ws.max_column, col + 8) + 1):
            candidate = text(ws.cell(model_row, candidate_col).value)
            if candidate:
                model = unique_name(candidate, used_models)
                break
        model = model or unique_name(f"Modelo {len(code_columns) + 1}", used_models)
        used_models.add(model)
        code_columns.append({"model": model, "code": col, "description": col + 1, "stock": col + 3, "need": col + 4})
    models = [block["model"] for block in code_columns]
    items = {}
    for block in code_columns:
        for row in range(first_data_row, ws.max_row + 1):
            code = text(ws.cell(row, block["code"]).value)
            if not code or code.lower() in {"código", "codigo"}:
                continue
            item = items.setdefault(code, {"code": code, "description": text(ws.cell(row, block["description"]).value), "unit": text(ws.cell(row, block["description"] + 1).value) or "UN", "stock": 0, "modelNeeds": {name: 0 for name in models}})
            stock = compact(number(ws.cell(row, block["stock"]).value))
            if item["stock"] == 0 and stock:
                item["stock"] = stock
            item["modelNeeds"][block["model"]] = compact(number(item["modelNeeds"].get(block["model"])) + number(ws.cell(row, block["need"]).value))
    for item in items.values():
        item["totalNeed"] = compact(sum(number(value) for value in item["modelNeeds"].values()))
        item["modelCount"] = sum(1 for value in item["modelNeeds"].values() if number(value) > 0)
    payload = {"sourceFile": origem.name, "sourceSheet": "Pinos", "generatedAt": date.today().isoformat(), "models": models, "items": sorted(items.values(), key=lambda item: (-number(item["totalNeed"]), item["code"])), "meta": {"headerRow": header_row, "firstDataRow": first_data_row, "weeklySource": False}}
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PINOS_OK {len(items)} itens | {len(models)} modelos | {destino}")


def extrair(origem: Path, destino: Path) -> None:
    wb = load_workbook(origem, read_only=True, data_only=True, keep_vba=True)
    try:
        if "PinosAnual" in wb.sheetnames:
            extrair_pinos_anual(wb["PinosAnual"], origem, destino)
        else:
            sheet_name = next((name for name in ("Pinos", "pinos") if name in wb.sheetnames), None)
            if not sheet_name:
                raise ValueError("As abas PinosAnual e Pinos não foram encontradas na planilha.")
            extrair_pinos_legado(wb[sheet_name], origem, destino)
    finally:
        wb.close()


if __name__ == "__main__":
    if len(sys.argv) not in {2, 3}:
        raise SystemExit("Uso: python convert_pinos.py origem.xlsm [destino.json]")
    extrair(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) == 3 else OUTPUT_DEFAULT)
