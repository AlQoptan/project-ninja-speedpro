import re, json
need = json.load(open('_scan_need.json', encoding='utf-8'))
AR = re.compile(r'[؀-ۿ]')
BLACK = {'غير','و','أح','أر','إث','ثل','جم','خم','سب','ساع','د','س','ي','ه','اجمالي'}

def keep(s):
    if len(s) < 3: return False
    if s in BLACK: return False
    if re.search(r'[<>{}\\]', s): return False
    if re.search(r'===|=>|return |function|\$\{|logAudit', s): return False
    if s[0] in '-.+("،؛=>0123456789': return False
    if s[0].isdigit(): return False
    if s[-1] in '(:؛—,-=)': return False
    if s.startswith('- '): return False
    if not AR.search(s): return False
    # drop fragments that are obviously mid-sentence money/unit tails
    if s.startswith('ر.س') or s.startswith('ريال (') or s.startswith('ريال —'): return False
    return True

kept = sorted(s for s in need if keep(s))
json.dump(kept, open('_keep.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print('kept=%d (from %d)' % (len(kept), len(need)))
