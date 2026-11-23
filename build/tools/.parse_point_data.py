from pathlib import Path
import json, re

ROOT=Path('crates')
files=list((ROOT/'mod-shared'/'src').rglob('*.rs'))+list((ROOT/'mod-win'/'src').rglob('*.rs'))

def match_block(s, start):
    i=s.find('{', start)
    if i<0: return None
    depth=0; in_str=False; esc=False; in_char=False
    for j in range(i, len(s)):
        c=s[j]
        if in_str:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c=='"': in_str=False
            continue
        if in_char:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c=="'": in_char=False
            continue
        if c=='"': in_str=True
        elif c=="'": in_char=True
        elif c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0: return s[i:j+1]
    return None

def match_bracket(s, start):
    i=s.find('[', start)
    if i<0: return None
    depth=0; in_str=False; esc=False
    for j in range(i, len(s)):
        c=s[j]
        if in_str:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c=='"': in_str=False
            continue
        if c=='"': in_str=True
        elif c=='[': depth+=1
        elif c==']':
            depth-=1
            if depth==0: return s[i:j+1]
    return None

def first_str(block, key):
    m=re.search(r'\b'+re.escape(key)+r'\s*:\s*"([^"]*)"', block)
    return m.group(1) if m else ''

def parse_params(block, which):
    m=re.search(r'\b'+which+r'\s*:\s*vec!\s*\[', block)
    if not m: return []
    arr=match_bracket(block, m.start())
    if not arr: return []
    # split top-level ParamSpec calls
    specs=[]
    for mm in re.finditer(r'ParamSpec::(required|optional|choice|choice_opt)\s*\(', arr):
        kind=mm.group(1)
        # find matching ) for call
        start=mm.end()-1
        depth=0; in_str=False; esc=False
        end=None
        for j in range(start, len(arr)):
            c=arr[j]
            if in_str:
                if esc: esc=False
                elif c=='\\': esc=True
                elif c=='"': in_str=False
                continue
            if c=='"': in_str=True
            elif c=='(': depth+=1
            elif c==')':
                depth-=1
                if depth==0:
                    end=j+1; break
        if end is None: continue
        call=arr[start:end]
        strs=re.findall(r'"((?:\\.|[^"\\])*)"', call)
        key=strs[0] if strs else ''
        label=strs[1] if len(strs)>1 else ''
        ty='text'
        tm=re.search(r'ParamType::(\w+)', call)
        if tm: ty=tm.group(1).lower()
        if kind.startswith('choice'): ty='enum'
        options=[]
        om=re.search(r'&\s*\[', call)
        if om:
            optarr=match_bracket(call, om.start())
            if optarr: options=[x.replace('\\"','"') for x in re.findall(r'"((?:\\.|[^"\\])*)"', optarr)]
        required = kind in ('required','choice')
        default=None
        dm=re.search(r'json!\s*\((.*)\)\s*$', call, re.S)
        if dm: default=dm.group(1).strip()
        specs.append({'key':key,'label':label,'type':ty,'required':required,'options':options,'default':default})
    return specs

modules={}
for p in files:
    s=p.read_text(encoding='utf-8')
    for m in re.finditer(r'ModuleManifest\s*\{', s):
        b=match_block(s, m.start())
        if not b: continue
        mid=first_str(b,'id')
        if not mid: continue
        modules[mid]={
            'id':mid,
            'name':first_str(b,'name'),
            'version':first_str(b,'version'),
            'effect':(re.search(r'effect\s*:\s*EffectLevel::(\w+)', b).group(1) if re.search(r'effect\s*:\s*EffectLevel::(\w+)', b) else 'ReadOnly'),
            'idempotent': bool(re.search(r'idempotent\s*:\s*true', b)),
            'permissions': re.findall(r'Permission::(\w+)', b),
            'inputs': parse_params(b,'inputs'),
            'outputs': parse_params(b,'outputs'),
            'source': str(p),
        }
print('modules',len(modules))
for k in sorted(modules):
    m=modules[k]
    print(f"{k:18} {m['name']:12} {m['effect']:12} idem={m['idempotent']} perms={','.join(m['permissions']) or '-'} inputs={[(x['key'],x['type'],x['required']) for x in m['inputs']]}")
Path('.point-modules.json').write_text(json.dumps(modules, ensure_ascii=False, indent=2), encoding='utf-8')
