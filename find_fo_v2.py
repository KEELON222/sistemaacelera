
import os
import re

filepath = r'd:\lipplead\Clientes LP Códigos\Acelarai\sistemaacelera\src\pages\CRM.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    # Search for standalone 'fo'
    if re.search(r'\bfo\b', line):
        print(f"Line {i+1}: {line.strip()}")
    # Search for 'fo.' (common typo for formData.)
    if 'fo.' in line:
         print(f"Line {i+1} (dots): {line.strip()}")
