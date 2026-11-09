"""Extrai dinamicamente o quadro mensal da aba PLANO MES para o dashboard."""
from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import json
import re
import sys

from openpyxl import load_workbook


HEADER_ROW = 15
FIRST_MODEL_ROW = HEADER_ROW + 1
FIRST_MONTH_COLUMN = 2


def valor(value):
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def numero_mes(value):
    if isinstance(value, (datetime, date)):
        return value.month
    if isinstance(value, (int, float)) and float(value).is_integer():
        month = int(value)
        return month if 1 <= month <= 12 else None
    match = re.fullmatch(r"\s*(?:M[EÊ]S\s*)?(\d{1,2})(?:/\d{2,4})?\s*", str(value or ""), re.IGNORECASE)
    if not match:
        return None
    month = int(match.group(1))
    return month if 1 <= month <= 12 else None


def periodos_com_ano(month_numbers: list[int], today: date | None = None) -> list[dict[str, str]]:
    """Resolve anos em cabeçalhos que contêm só MM, usando o mês corrente como âncora."""
    if not month_numbers:
        return []
    today = today or date.today()
    candidates = []
    for start_year in range(today.year - 2, today.year + 3):
        periods = []
        year = start_year
        previous = None
        for month in month_numbers:
            if previous is not None and month < previous:
                year += 1
            periods.append((year, month))
            previous = month
        if any(year == today.year and month == today.month for year, month in periods):
            score = (0, 0 if periods[-1] >= (today.year, today.month) else 1)
        else:
            distances = [abs((date(year, month, 1) - today.replace(day=1)).days) for year, month in periods]
            nearest = min(distances)
            nearest_periods = [periods[index] for index, distance in enumerate(distances) if distance == nearest]
            future_penalty = 0 if any(period >= (today.year, today.month) for period in nearest_periods) else 1
            score = (nearest, future_penalty)
        candidates.append((score, periods))
    _, chosen = min(candidates, key=lambda candidate: candidate[0])
    return [
        {"key": f"{month:02d}/{year}", "month": f"{month:02d}", "year": str(year)}
        for year, month in chosen
    ]


def extrair(origem: Path, destino: Path) -> None:
    wb = load_workbook(origem, read_only=True, data_only=True, keep_vba=True)
    try:
        if "PLANO MES" not in wb.sheetnames:
            raise ValueError("A aba PLANO MES não foi encontrada na planilha.")
        ws = wb["PLANO MES"]

        month_columns: list[tuple[int, int]] = []
        for column in range(FIRST_MONTH_COLUMN, ws.max_column + 1):
            month = numero_mes(ws.cell(HEADER_ROW, column).value)
            if month is not None:
                month_columns.append((column, month))
        periods = periodos_com_ano([month for _, month in month_columns])

        models = []
        last_model_row = HEADER_ROW
        for row in range(FIRST_MODEL_ROW, ws.max_row + 1):
            raw_model = valor(ws.cell(row, 1).value)
            if raw_model is None or not str(raw_model).strip():
                continue
            model_name = str(raw_model).strip()
            if model_name.upper().startswith("TOTAL"):
                continue
            quantities: dict[str, int | float] = {}
            for (column, _), period in zip(month_columns, periods):
                quantity = valor(ws.cell(row, column).value) or 0
                key = period["key"]
                quantities[key] = valor((quantities.get(key) or 0) + quantity)
            models.append({"modelo": model_name, "quantidades": quantities})
            last_model_row = row

        releases = []
        for row in range(3, ws.max_row + 1):
            values = [valor(ws.cell(row, column).value) for column in range(27, 33)]
            if not any(value not in (None, "") for value in values):
                continue
            releases.append({
                "en": values[0],
                "cliente": values[1],
                "modelo": values[2],
                "pl": values[3],
                "nome": values[4],
                "data": values[5].isoformat() if hasattr(values[5], "isoformat") else values[5],
            })

        last_month_column = month_columns[-1][0] if month_columns else FIRST_MONTH_COLUMN
        payload = {
            "sourceSheet": "PLANO MES",
            "sourceRange": f"A{HEADER_ROW}:{ws.cell(HEADER_ROW, last_month_column).column_letter}{last_model_row}",
            "months": [period["key"] for period in periods],
            "monthNumbers": [period["month"] for period in periods],
            "periods": periods,
            "models": models,
            "liberacoes": releases,
            "liberacoesRange": "AA2:AF" + str(ws.max_row),
        }
    finally:
        wb.close()

    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Uso: python convert_plano_mes.py origem.xlsm destino.json")
    extrair(Path(sys.argv[1]), Path(sys.argv[2]))
    print("PLANO_MES_OK")
