#!/usr/bin/env python3
"""Regressão automatizada para a área Cilindros por modelo.

A suíte valida o contrato real do snapshot gerado pela planilha fornecida,
a integração do conversor principal e os contratos estáticos da interface.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SCRIPTS = ROOT / "scripts"
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
JS = (ROOT / "assets/app.js").read_text(encoding="utf-8")
CSS = (ROOT / "assets/styles.css").read_text(encoding="utf-8")
CYLINDER_JSON = json.loads((DATA / "cilindros.json").read_text(encoding="utf-8"))
PINS_JSON = json.loads((DATA / "pinos.json").read_text(encoding="utf-8"))


class TestCilindrosSnapshot(unittest.TestCase):
    def test_snapshot_exists_and_is_object(self):
        self.assertIsInstance(CYLINDER_JSON, dict)

    def test_snapshot_has_required_schema(self):
        self.assertTrue({"sourceFile", "sourceSheet", "generatedAt", "models", "items", "meta"} <= CYLINDER_JSON.keys())

    def test_snapshot_sheet_is_cilindros(self):
        self.assertEqual(CYLINDER_JSON["sourceSheet"].lower(), "cilindros")

    def test_snapshot_models_are_non_empty(self):
        self.assertGreaterEqual(len(CYLINDER_JSON["models"]), 1)
        self.assertEqual(CYLINDER_JSON["models"], ["18LDDI", "13", "13AT", "10S"])

    def test_snapshot_items_is_list(self):
        self.assertIsInstance(CYLINDER_JSON["items"], list)

    def test_snapshot_meta_has_rows(self):
        self.assertGreaterEqual(CYLINDER_JSON["meta"]["headerRow"], 1)
        self.assertGreaterEqual(CYLINDER_JSON["meta"]["firstDataRow"], 1)

    def test_real_source_snapshot_is_currently_empty_or_structured(self):
        # A aba sem linhas de componentes deve mostrar empty-state, sem quebrar a UI.
        for item in CYLINDER_JSON["items"]:
            self.assertTrue({"code", "description", "stock", "needByModel"} <= item.keys())

    def test_pins_snapshot_remains_available(self):
        self.assertGreater(len(PINS_JSON["items"]), 0)
        self.assertGreater(len(PINS_JSON["models"]), 0)


class TestConversor(unittest.TestCase):
    def test_cylinder_converter_compiles(self):
        result = subprocess.run([sys.executable, "-m", "py_compile", str(SCRIPTS / "convert_cilindros.py")], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_main_converter_compiles(self):
        result = subprocess.run([sys.executable, "-m", "py_compile", str(SCRIPTS / "convert_excel.py")], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_main_pipeline_references_cylinder_converter(self):
        source = (SCRIPTS / "convert_excel.py").read_text(encoding="utf-8")
        self.assertIn("convert_cilindros", source)
        self.assertIn("cilindros.json", source)

    def test_cylinder_converter_reads_expected_sheet(self):
        source = (SCRIPTS / "convert_cilindros.py").read_text(encoding="utf-8").lower()
        self.assertIn("cilindros", source)
        self.assertIn("openpyxl", source)

    def test_update_scripts_mention_cylinder_snapshot(self):
        for filename in ("atualizar-dados.bat", "atualizar-dados.sh"):
            self.assertIn("cilindros.json", (ROOT / filename).read_text(encoding="utf-8").lower())


class TestCilindrosInterface(unittest.TestCase):
    def test_navigation_entry_exists_below_pins(self):
        pins_pos = HTML.find('data-view="pins"')
        cylinders_pos = HTML.find('data-view="cylinders"')
        self.assertGreaterEqual(pins_pos, 0)
        self.assertGreater(cylinders_pos, pins_pos)

    def test_cylinder_data_is_loaded(self):
        self.assertRegex(JS, r"fetch\(['\"]data/cilindros\.json['\"]\)")
        self.assertIn("let CYLINDERS", JS)

    def test_cylinders_view_exists(self):
        self.assertIn("function cylindersView", JS)
        self.assertIn("cylindersView", JS)

    def test_cylinder_simulation_renderer_exists(self):
        self.assertIn("function renderCylinderSimulation", JS)
        self.assertIn("cylinderSimulationRows", JS)

    def test_cylinder_model_selection_is_bound(self):
        self.assertIn("data-cylinder-model", JS)
        self.assertIn("selectedCylinderModel", JS)

    def test_machine_multiplier_is_present(self):
        self.assertIn("cylinders-cars", JS)
        self.assertIn("unitNeed * cars", JS)

    def test_cylinder_risk_statuses_are_present(self):
        for label in ("Regular", "Em atenção", "Crítico"):
            self.assertIn(label, JS)

    def test_cylinder_search_is_present(self):
        self.assertIn("cylinders-search", JS)
        self.assertIn("query.trim().toLowerCase()", JS)

    def test_cylinder_status_filter_is_present(self):
        self.assertIn("cylinders-coverage", JS)
        self.assertIn("statusFilter", JS)

    def test_cylinder_stock_filter_is_present(self):
        self.assertIn("cylinders-stock-filter", JS)
        self.assertIn("selectedStockFilter", JS)

    def test_cylinder_last_movement_is_rendered(self):
        self.assertIn("Última movimentação", JS)
        self.assertIn("item.lastMovement", JS)

    def test_cylinder_need_and_balance_are_rendered(self):
        self.assertIn("modelNeeds", JS)
        self.assertIn("n(item.stock) - required", JS)
        self.assertIn("Cilindros por modelo", JS)

    def test_empty_state_is_safe(self):
        self.assertIn("Nenhum cilindro corresponde aos filtros", JS)
        self.assertIn("cylinders-empty", CSS)


class TestExplosaoRegression(unittest.TestCase):
    def test_generic_table_has_last_movement_column(self):
        self.assertIn("<th>Última movimentação</th>", JS)

    def test_generic_table_has_procurement_column(self):
        self.assertIn("<th>Processo de compra</th>", JS)

    def test_zero_stock_follow_up_logic_remains(self):
        self.assertIn("hasOrderInMonth", JS)
        self.assertIn("Follow-up", JS)
        self.assertIn("stock <= 0", JS)

    def test_global_stock_filter_remains(self):
        self.assertIn("stock-filter", JS)
        self.assertIn("stockFilter", JS)

    def test_progressive_table_remains(self):
        self.assertIn("TABLE_CHUNK_SIZE", JS)
        self.assertIn("Carregar mais", JS)

    def test_material_detail_binding_remains(self):
        self.assertIn("bindMaterialButtons", JS)
        self.assertIn("data-code", JS)

    def test_css_prevents_content_overflow(self):
        self.assertIn(".main-content { min-width: 0; overflow-x: hidden; }", CSS)
        self.assertIn(".content { width: 100%; max-width: none;", CSS)

    def test_css_keeps_final_action_visible(self):
        self.assertIn(".progressive-table .data-table td:last-child", CSS)
        self.assertIn("position: sticky", CSS)

    def test_css_has_mobile_fallback(self):
        self.assertIn("@media (max-width: 760px)", CSS)
        self.assertIn("position: static", CSS)

    def test_js_compiles(self):
        result = subprocess.run(["node", "--check", str(ROOT / "assets/app.js")], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_html_has_no_duplicate_cylinder_nav_entries(self):
        self.assertEqual(len(re.findall(r'data-view="cylinders"', HTML)), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
