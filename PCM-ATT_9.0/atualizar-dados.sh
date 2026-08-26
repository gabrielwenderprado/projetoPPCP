#!/usr/bin/env bash
set -euo pipefail
if [ -z "${1:-}" ]; then
  echo "Uso: ./atualizar-dados.sh /caminho/para/explosao.xlsm [/caminho/para/consumiveis.xlsx]"
  exit 1
fi
python3 scripts/atualizar_todos_dados.py "$@"
echo "Atualizados e verificados: data/explosao.json, data/plano-mes.json, data/pinos.json, data/cilindros.json e data/historico-estoque.json."
