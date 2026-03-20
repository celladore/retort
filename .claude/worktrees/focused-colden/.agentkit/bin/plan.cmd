@echo off
setlocal
set ROOT=%~dp0..
node "%ROOT%\engines\node\src\cli.mjs" plan %*
endlocal
