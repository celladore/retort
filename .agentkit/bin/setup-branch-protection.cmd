@echo off
REM Thin wrapper — delegates to PowerShell
powershell -ExecutionPolicy Bypass -File "%~dp0setup-branch-protection.ps1" %*
