@echo off
node api/main.js -timeout 120000 -threads 1 -debug_mode true -db formjs
pause