#!/usr/bin/env python3
"""Testes do fluxo completo de atualização dos dados."""
from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
DATA = ROOT / "data"
SOURCE = Path("/home/ubuntu/upload/CópiadeEXPLOSAO_25.08.xlsm")


class TestOrquestrador(unittest.TestCase):
    def test_orchestrator_exists(self):
        self.assertTrue((SCRIPTS / "atualizar_todos_dados.py").exists())

    def test_orchestrator_compiles(self):
        result = subprocess.run([sys.executable, "-m", "py_compile", str(SCRIPTS / "atualizar_todos_dados.py")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_orchestrator_calls_main_converter(self):
        source = (SCRIPTS / "atualizar_todos_dados.py").read_text(encoding="utf-8")
        self.assertIn("convert_excel.py", source)

    def test_orchestrator_calls_consumables_converter(self):
        source = (SCRIPTS / "atualizar_todos_dados.py").read_text(encoding="utf-8")
        self.assertIn("convert_consumiveis.py", source)

    def test_orchestrator_verifies_all_explosion_snapshots(self):
        source = (SCRIPTS / "atualizar_todos_dados.py").read_text(encoding="utf-8")
        for filename in ("explosao.json", "plano-mes.json", "pinos.json", "cilindros.json", "historico-estoque.json"):
            self.assertIn(filename, source)

    def test_linux_script_calls_orchestrator(self):
        source = (ROOT / "atualizar-dados.sh").read_text(encoding="utf-8")
        self.assertIn("atualizar_todos_dados.py", source)
        self.assertIn("set -euo pipefail", source)

    def test_windows_script_calls_orchestrator(self):
        source = (ROOT / "atualizar-dados.bat").read_text(encoding="utf-8")
        self.assertIn("atualizar_todos_dados.py", source)
        self.assertIn("%~2", source)

    def test_missing_source_fails_clearly(self):
        result = subprocess.run([sys.executable, str(SCRIPTS / "atualizar_todos_dados.py"), "/tmp/ficheiro-inexistente.xlsm"], cwd=ROOT, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("planilha de Explosão não encontrada", result.stdout + result.stderr)


class TestAtualizacaoReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SOURCE.exists():
            raise unittest.SkipTest(f"Fonte real não disponível: {SOURCE}")
        result = subprocess.run([sys.executable, str(SCRIPTS / "atualizar_todos_dados.py"), str(SOURCE)], cwd=ROOT, capture_output=True, text=True)
        cls.result = result
        cls.output = result.stdout + result.stderr

    def test_real_update_succeeds(self):
        self.assertEqual(self.result.returncode, 0, self.output)
        self.assertIn("ATUALIZAÇÃO_COMPLETA_OK", self.output)

    def test_real_update_reports_warning_only_for_separate_consumables(self):
        self.assertIn("Consumíveis não atualizado", self.output)

    def test_explosion_snapshot_was_verified(self):
        self.assertIn("OK explosao.json", self.output)

    def test_plan_snapshot_was_verified(self):
        self.assertIn("OK plano-mes.json", self.output)

    def test_pins_snapshot_was_verified(self):
        self.assertIn("OK pinos.json", self.output)

    def test_cylinders_snapshot_was_verified(self):
        self.assertIn("OK cilindros.json", self.output)

    def test_history_snapshot_was_verified(self):
        self.assertIn("OK historico-estoque.json", self.output)

    def test_all_required_snapshots_are_valid_json(self):
        required = {
            "explosao.json": ("items", "models"),
            "plano-mes.json": ("months", "models"),
            "pinos.json": ("items", "models"),
            "cilindros.json": ("items", "models"),
            "historico-estoque.json": ("records",),
        }
        for filename, keys in required.items():
            payload = json.loads((DATA / filename).read_text(encoding="utf-8"))
            self.assertTrue(all(key in payload for key in keys), filename)

    def test_real_counts_are_present(self):
        explosao = json.loads((DATA / "explosao.json").read_text(encoding="utf-8"))
        plano = json.loads((DATA / "plano-mes.json").read_text(encoding="utf-8"))
        pinos = json.loads((DATA / "pinos.json").read_text(encoding="utf-8"))
        cilindros = json.loads((DATA / "cilindros.json").read_text(encoding="utf-8"))
        self.assertGreater(len(explosao["items"]), 0)
        self.assertGreater(len(plano["models"]), 0)
        self.assertGreater(len(pinos["items"]), 0)
        self.assertGreater(len(cilindros["models"]), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
