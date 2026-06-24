import re, json

AR = re.compile(r'[؀-ۿ]')
seed = {}   # ar -> en

# 1) L('ar','en') pairs across JS files
Lpat = re.compile(r"\bL\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)")
Lpat2 = re.compile(r'\bL\(\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\)')
for fn in ['app.js','driver.js','ai.js','translations.js']:
    s=open(fn,encoding='utf-8').read()
    for pat in (Lpat,Lpat2):
        for m in pat.finditer(s):
            ar,en=m.group(1),m.group(2)
            if AR.search(ar) and ar.strip() and en.strip():
                seed.setdefault(ar.strip().replace("\\'","'"), en.strip().replace("\\'","'"))

# 2) translations.js  ar{} / en{} aligned by key
ts=open('translations.js',encoding='utf-8').read()
def block(name):
    m=re.search(name+r'\s*:\s*\{', ts)
    if not m: return {}
    i=m.end(); depth=1; out=''
    while i<len(ts) and depth>0:
        c=ts[i]
        if c=='{':depth+=1
        elif c=='}':depth-=1
        if depth>0: out+=c
        i+=1
    d={}
    for km in re.finditer(r"(\w+)\s*:\s*'((?:[^'\\]|\\.)*)'", out):
        d[km.group(1)]=km.group(2).replace("\\'","'")
    return d
ar_d=block('ar'); en_d=block('en')
for k,v in ar_d.items():
    if k in en_d and AR.search(v):
        seed.setdefault(v.strip(), en_d[k].strip())

# load unique strings, find which still need translation
data=json.load(open('_strings.json',encoding='utf-8'))
uniq=data['unique_all']
need=[u for u in uniq if u not in seed]
have=[u for u in uniq if u in seed]

json.dump(seed, open('_seed.json','w',encoding='utf-8'), ensure_ascii=False, indent=0)
json.dump(need, open('_need.json','w',encoding='utf-8'), ensure_ascii=False, indent=0)
print('seed_pairs=%d  unique=%d  already_have=%d  NEED_TRANSLATION=%d'%(len(seed),len(uniq),len(have),len(need)))
