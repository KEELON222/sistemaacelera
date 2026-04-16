
import os
import re

filepath = r'd:\lipplead\Clientes LP Códigos\Acelarai\sistemaacelera\src\pages\CRM.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find words that might be "fo" or contain "fo" as a standalone-ish entity
# and look for typos
words = re.findall(r'\w+', content)
fo_words = [w for w in words if 'fo' in w.lower()]

# Filter out common legitimate words
uncommon_fo = []
for w in fo_words:
    low = w.lower()
    if low in ['form', 'formData', 'format', 'font', 'focus', 'folder', 'follows', 'found', 'inform', 'information', 'performed', 'performance', 'before', 'force', 'platform', 'footer', 'formdata', 'transform', 'formatfilesize', 'fetchmetadata', 'concluido', 'concluida', 'confort', 'confortável', 'confortavel', 'conforme', 'conformidade', 'fornecedor', 'fornecedores', 'foto', 'fotos', 'fonte', 'fontes', 'fom']:
        continue
    # Many common words have 'fo' like 'info', 'dashboard', 'activeBoardId' (no), 'profiles' (no)
    # Let's just print anything that isn't extremely common
    uncommon_fo.append(w)

for w in set(uncommon_fo):
    # check occurrences
    indices = [m.start() for m in re.finditer(r'\b' + re.escape(w) + r'\b', content)]
    if indices:
        print(f"Word: {w}, Count: {len(indices)}")
