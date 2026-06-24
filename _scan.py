import re, json

AR = re.compile(r'[؀-ۿ]')
SQ = re.compile(r"'((?:[^'\\]|\\.)*)'")
DQ = re.compile(r'"((?:[^"\\]|\\.)*)"')
BT = re.compile(r'`((?:[^`\\]|\\.)*)`', re.S)

def per_line_quotes(src):
    out = []
    for line in src.splitlines():
        # strip // line comments crudely (avoid cutting inside strings is imperfect but per-line)
        for rx in (SQ, DQ):
            for m in rx.finditer(line):
                v = m.group(1)
                if AR.search(v):
                    out.append(v)
    return out

def clean_tpl(chunk):
    out = []
    s = chunk.replace('\\n', '\n').replace('\\t', '\t').replace("\\'", "'").replace('\\"', '"').replace('\\`', '`')
    s = re.sub(r'\$\{[^}]*\}', '\n', s)        # drop simple ${...} (no nested braces)
    s = re.sub(r'<[^>]*>', '\n', s)            # tags -> boundary
    s = re.sub(r'&[a-zA-Z#0-9]+;', ' ', s)     # entities
    for line in re.split(r'[\n\r]+', s):
        seg = line.strip().strip(' \t:|·•—،,"\'')
        seg = seg.strip()
        if seg and AR.search(seg):
            out.append(seg)
    return out

cand = set()
for fn in ['app.js', 'driver.js', 'ai.js']:
    src = open(fn, encoding='utf-8').read()
    for v in per_line_quotes(src):
        v = v.replace("\\'", "'").replace('\\"', '"').strip()
        if v and AR.search(v) and len(v) <= 90 and '${' not in v:
            cand.add(v)
    for m in BT.finditer(src):
        for seg in clean_tpl(m.group(1)):
            if len(seg) <= 90:
                cand.add(seg)

seed   = json.load(open('_seed.json', encoding='utf-8'))
manual = json.load(open('_manual.json', encoding='utf-8'))
drv    = json.load(open('_manual_driver.json', encoding='utf-8'))
have = set(seed) | set(manual) | set(drv)

def junk(s):
    if re.search(r'===|!==|=>|logAudit|\$\{|function|return |=\s*$', s): return True
    if s and s[0] in ':)]}>=': return True
    return False

need = sorted(s for s in cand if s not in have and not junk(s))
json.dump(need, open('_scan_need.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

checks = ['المركبات','عرض المركبات','إجمالي الوحدات','نشط اليوم','صيانة معلقة','معاملات الشهر','حوادث مفتوحة','صيانة عاجلة']
rep = ['%s %s' % ('YES' if w in cand else 'NO ', w) for w in checks]
open('_scan_chk.txt','w',encoding='utf-8').write('\n'.join(rep))
print('candidates=%d  have=%d  NEED=%d' % (len(cand), len(have), len(need)))
