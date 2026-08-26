@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Uso: arraste a planilha de Explosao sobre este arquivo.
  echo Opcionalmente, informe a planilha de Consumiveis como segundo argumento.
  pause
  exit /b 1
)
where py >nul 2>nul
if not errorlevel 1 (
  if "%~2"=="" (py scripts\atualizar_todos_dados.py "%~1") else (py scripts\atualizar_todos_dados.py "%~1" "%~2")
  goto :done
)
where python >nul 2>nul
if not errorlevel 1 (
  if "%~2"=="" (python scripts\atualizar_todos_dados.py "%~1") else (python scripts\atualizar_todos_dados.py "%~1" "%~2")
  goto :done
)
echo.
echo ERRO: Python nao foi encontrado neste computador.
echo Instale Python em https://www.python.org/downloads/ e marque "Add Python to PATH".
pause
exit /b 1
:done
if errorlevel 1 (
  echo.
  echo ERRO: a atualizacao falhou. Verifique a mensagem acima.
  pause
  exit /b 1
)
echo.
echo Atualizados e verificados: data\explosao.json, data\plano-mes.json, data\pinos.json, data\cilindros.json e data\historico-estoque.json.
pause
