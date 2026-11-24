import json, re, collections, pathlib

cat = json.load(open('src/shared/generatedFullCatalogs.json', encoding='utf-8'))
LAYERS = ['point','line','surface','body','field']
CN = {'point':'点层','line':'线层','surface':'面层','body':'体层','field':'场层'}
OWN = {'point':None,'line':'flow','surface':'surface','body':'body','field':'field'}

def flat(n):
    s = re.sub(r'[.\-\s]+', '_', str(n).strip())
    return re.sub('_+', '_', s).strip('_').lower()

def cls_seg(layer, cid):
    p = cid.split('.')
    if len(p) > 1 and (p[0] == layer or p[0] == OWN[layer]):
        p = p[1:]
    # point：win 是平台前缀（所有点能力都是 Windows），去掉；其余命名空间承载领域含义，保留
    if layer == 'point' and len(p) > 1 and p[0] == 'win':
        p = p[1:]
    return flat('_'.join(p))

def inst_seg(layer, cid, iid):
    b = re.sub(r'@r\d+$', '', iid)
    if b.startswith(cid + '.'): b = b[len(cid)+1:]
    elif b.startswith(layer + '.'): b = b[len(layer)+1:]
    for m in ('inst.', 'i-'):
        if b.startswith(m):
            b = b[len(m):]
            break
    b = flat(b)
    cs = cls_seg(layer, cid)
    ctoks = cs.split('_')
    ttoks = b.split('_')
    # 去掉与类名重复的前导词（含缩写：类词以实例词开头且实例词≥5字符）
    def common(a, b):
        n = 0
        for x, y in zip(a, b):
            if x != y: break
            n += 1
        return n
    while ttoks:
        t = ttoks[0]
        # 与类名某词相同，或公共前缀 ≥5（抓 notify / notification 这类缩写）
        dup = any(t == c or (len(t) >= 5 and common(t, c) >= 5) for c in ctoks)
        if not dup: break
        ttoks = ttoks[1:]
    joined = '_'.join(ttoks)
    # 剥离后若太短或只是数字（如 bright_60 -> 60），就保留原名，别丢语义
    if len(joined) < 3 or joined.isdigit():
        return b or 'default'
    return joined

plan = []
ids = []
for layer in LAYERS:
    for c in cat[layer]:
        cs = cls_seg(layer, c['id'])
        new_cls = f'{layer}.{cs}'
        insts = []
        for i in c['instances']:
            rev = int(i.get('rev', 1) or 1)
            isg = inst_seg(layer, c['id'], i['id'])
            new_id = f'{new_cls}.{isg}@r{rev}'
            ids.append(new_id)
            insts.append({'old': i['id'], 'new': new_id, 'seg': isg, 'name': i['name'], 'rev': rev})
        plan.append({'layer': layer, 'oldClass': c['id'], 'newClass': new_cls,
                     'name': c['name'], 'family': c.get('family',''), 'instances': insts})

dups = [k for k,v in collections.Counter(ids).items() if v > 1]
print(f'实例 id 总数 {len(ids)} · 冲突 {len(dups)}: {dups[:5] or "无"}')
print(f'类总数 {len(plan)} · 平均 id 长度 {sum(len(x) for x in ids)//len(ids)} 字符')
print(f'最长 {max(len(x) for x in ids)} 字符')

# 写 JSON（供迁移脚本用）
pathlib.Path('.tmp/atom-rename-plan.json').write_text(
    json.dumps({'generatedAt': __import__('datetime').datetime.now().isoformat(),
                'collisions': dups, 'layers': plan}, ensure_ascii=False, indent=2), encoding='utf-8')

# 写 markdown 清单
out = ['# Atom 命名全量清单', '',
       '> 由 `scripts/gen-atom-inventory.py` 生成。规则见 `design/overview/NAMING-CONVENTIONS.md` 与 `atomId.ts`。',
       '> 格式：`层名.类名.实例名@rN`（3 段定长，全小写，段内不许有点）', '',
       f'共 **5 层 / {len(plan)} 类 / {len(ids)} 实例**，新 id 冲突 **{len(dups)}**。', '']

for layer in LAYERS:
    rows = [p for p in plan if p['layer'] == layer]
    n_inst = sum(len(r['instances']) for r in rows)
    out += [f'## {CN[layer]} `{layer}`（{len(rows)} 类 / {n_inst} 实例）', '']
    out += ['| 现在类 id | 统一后 | family | 实例（统一后） |', '|---|---|---|---|']
    for r in rows:
        segs = ' · '.join(i['seg'] for i in r['instances'])
        out.append(f"| `{r['oldClass']}` | `{r['newClass']}` | {r['family']} | {segs} |")
    out.append('')

out += ['## 完整实例清单', '', '| 现在 | 统一后 | 名称 |', '|---|---|---|']
for r in plan:
    for i in r['instances']:
        out.append(f"| `{i['old']}` | `{i['new']}` | {i['name']} |")

pathlib.Path('design/overview/ATOM-ID-INVENTORY.md').write_text('\n'.join(out) + '\n', encoding='utf-8')
print('已写入 design/overview/ATOM-ID-INVENTORY.md 与 .tmp/atom-rename-plan.json')
