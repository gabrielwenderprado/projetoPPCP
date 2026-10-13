@echo off
setlocal
cd /d "%~dp0"
if "%~1"=="" (
  echo Arraste a planilha planejamento_produtivo.xlsx sobre este arquivo.
  pause
  exit /b 1
)
where py >nul 2>nul
if not errorlevel 1 (
  py scripts\convert_mapa_produtivo.py "%~1"
  goto :done
)
where python >nul 2>nul
if not errorlevel 1 (
  python scripts\convert_mapa_produtivo.py "%~1"
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
  echo ERRO: a atualizacao do mapa produtivo falhou.
  pause
  exit /b 1
)
echo.
echo Mapa produtivo atualizado com sucesso.
echo Arquivo gerado: data\mapa-produtivo.json
echo.
echo Feche e abra o sistema novamente e pressione Ctrl+F5.
pause
