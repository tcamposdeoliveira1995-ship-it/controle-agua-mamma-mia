@echo off
title Mamma Mia - Controle de Agua Server
echo Iniciando o servidor do Sistema de Controle de Agua Mamma Mia...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
pause
