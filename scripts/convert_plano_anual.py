#!/usr/bin/env python3
"""Converte a aba planoAnual preservando a data prevista e a estrutura do modelo."""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/home/ubuntu/upload/CópiadeEXPLOSAO_02.10.xlsm')
OUTPUT = ROOT / 'data' / 'plano-anual.json'

MODEL_NAMES = list(dict.fromkeys([
    '18LDDI', '15LDDI', '13LDDI', '10S', '13AT', '10L', '13LDI',
    '10HDOC', '13-69kv', '13ldi-46kv', '18lddi',
    'guin-16T', 'guin-25T', 'guin-45', '21T', '30-T', '7T',
]))


def normalize(value: object) -> str:
    raw = unicodedata.normalize('NFKD', str(value or ''))
    raw = ''.join(char for char in raw if not unicodedata.combining(char))
    return re.sub(r'\s+', ' ', raw).strip().upper()


def model_and_structure_for_product(product: object) -> tuple[str | None, str | None]:
    name = normalize(product)
    if not name:
        return None, None
    # Descrições comerciais do Plano Anual -> nome usado pelo plano e aba de estrutura.
    if 'SKYCITY 10 HDOC' in name:
        return '10HDOC', '10HDOC'
    if 'SKYCITY 10 S' in name:
        return '10S', '10S'
    if 'SKYCITY 10 L' in name:
        return '10L', '10L'
    if 'SKYCITY 13,5 AT' in name or 'SKYCITY 13.5 AT' in name or 'SKYCITY 13 AT' in name:
        return '13AT', '13AT'
    if 'SKYCITY 13 LDDI' in name:
        return '13LDDI', '13-69kv'
    if 'SKYCITY 13 LDI' in name:
        return '13LDI', '13ldi-46kv'
    if 'SKYCITY 15 LDDI' in name:
        return '15LDDI', '15LDDI'
    if 'SKYCITY 18 LDDI' in name:
        return '18LDDI', '18lddi'
    if 'GUINDASTE' in name and 'NX 16.5T' in name and '3H 2M' in name:
        return 'guin-16T', 'guin-16T'
    if 'GUINDASTE' in name and 'NX 25.5T' in name:
        return 'guin-25T', 'guin-25T'
    if 'GUINDASTE' in name and 'NX 45.5T' in name and '5H 3M' in name:
        return 'guin-45', 'guin-45'
    if 'GUINDASTE' in name and 'NX 21.5T' in name:
        return '21T', '21T'
    if 'GUINDASTE' in name and 'NX 30.5T' in name:
        return '30-T', '30-T'
    if 'GUINDASTE' in name and 'NX 7.5T' in name:
        return '7T', '7T'
    return None, None


def model_for_product(product: object) -> str | None:
    """Compatibilidade com consumidores legados do conversor."""
    return model_and_structure_for_product(product)[0]


def month_value(value: object) -> tuple[int, int] | None:
    if isinstance(value, (datetime, date)):
        return value.year, value.month
    text = str(value or '').strip()
    match = re.search(r'(\d{1,2})[/-](\d{4})', text)
    if match:
        month, year = int(match.group(1)), int(match.group(2))
        return (year, month) if 1 <= month <= 12 else None
    return None


def exact_date_value(value: object) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return None


def main() -> int:
    if not SOURCE.exists():
        raise SystemExit(f'Planilha não encontrada: {SOURCE}')
    wb = load_workbook(SOURCE, read_only=True, data_only=True, keep_vba=True)
    sheet_name = next((name for name in wb.sheetnames if normalize(name) == 'PLANOANUAL'), None)
    if not sheet_name:
        raise SystemExit('Aba planoAnual não encontrada')
    ws = wb[sheet_name]
    models = {name: defaultdict(int) for name in MODEL_NAMES}
    products = Counter()
    unmatched_cranes = Counter()
    rows = []
    for row in ws.iter_rows(min_row=2, max_col=4, values_only=True):
        pedido, cliente, product, month = (list(row) + [None] * 4)[:4]
        model, structure = model_and_structure_for_product(product)
        parsed = month_value(month)
        if not structure and parsed and 'GUINDASTE' in normalize(product):
            unmatched_cranes[str(product).strip()] += 1
        if not model or not parsed:
            continue
        year, month_number = parsed
        month_key = f'{month_number:02d}/{year}'
        models[model][month_key] += 1
        products[str(product).strip()] += 1
        rows.append({
            'pedido': str(pedido or '').strip(),
            'cliente': str(cliente or '').strip(),
            'produto': str(product or '').strip(),
            'modelo': model,
            'estrutura': structure,
            'mes': month_key,
            'data': exact_date_value(month),
        })
    payload = {
        'sourceFile': SOURCE.name,
        'sourceSheet': sheet_name,
        'generatedAt': date.today().isoformat(),
        'columns': {'model': 'C', 'date': 'D'},
        'models': {model: dict(sorted(months.items())) for model, months in models.items()},
        'products': dict(products),
        'unmatchedCraneProducts': [{'produto': product, 'quantidade': count} for product, count in sorted(unmatched_cranes.items())],
        'rows': rows,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'PLANO_ANUAL_OK modelos={sum(bool(v) for v in models.values())} linhas={len(rows)} output={OUTPUT}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
