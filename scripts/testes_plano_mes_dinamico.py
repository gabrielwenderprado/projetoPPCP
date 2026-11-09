"""Teste de regressão para períodos/linhas dinâmicos da aba PLANO MES."""
from __future__ import annotations

from datetime import date
import json
from pathlib import Path
import tempfile

from openpyxl import Workbook

from convert_plano_mes import extrair


def main() -> None:
    today = date.today()
    months = [((today.month - 1 + offset) % 12) + 1 for offset in range(8)]
    with tempfile.TemporaryDirectory() as temp_dir:
        source = Path(temp_dir) / "plano-dinamico.xlsx"
        target = Path(temp_dir) / "plano-dinamico.json"
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "PLANO MES"
        sheet.cell(15, 1, "TOTAL MES")
        for offset, month in enumerate(months, start=2):
            sheet.cell(15, offset, month)
        sheet.cell(16, 1, "Modelo Inicial")
        sheet.cell(16, 2, 3)
        sheet.cell(18, 1, "Modelo abaixo da linha 17")
        sheet.cell(18, 2, 2)
        sheet.cell(20, 1, "Modelo abaixo da antiga linha 30")
        sheet.cell(20, 9, 7)
        workbook.save(source)
        workbook.close()

        extrair(source, target)
        payload = json.loads(target.read_text(encoding="utf-8"))
        assert len(payload["periods"]) == 8, payload["periods"]
        assert payload["periods"][0]["key"] == f"{today.month:02d}/{today.year}"
        assert payload["periods"][-1]["month"] == f"{months[-1]:02d}"
        assert payload["models"][-1]["modelo"] == "Modelo abaixo da antiga linha 30"
        assert payload["models"][-1]["quantidades"][payload["periods"][7]["key"]] == 7
        assert payload["sourceRange"].endswith(":I20"), payload["sourceRange"]
        print("PLANO_MES_DINAMICO_OK: 8 meses e modelos até à linha 20 reconhecidos")


if __name__ == "__main__":
    main()
