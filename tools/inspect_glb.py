#!/usr/bin/env python3
"""Check whether a .glb is a usable rigged character: python3 tools/inspect_glb.py assets/models/elf.glb"""
import json, struct, sys

def main(path):
    b = open(path, 'rb').read()
    clen, _ = struct.unpack('<II', b[12:20])
    j = json.loads(b[20:20 + clen])
    ok = True
    print(f'{path}: {len(b)//1024} KB, generator: {j["asset"].get("generator")}')
    verts = 0; skinned = False
    for m in j.get('meshes', []):
        for p in m['primitives']:
            n = j['accessors'][p['attributes']['POSITION']]['count']; verts += n
            has = 'JOINTS_0' in p['attributes'] and 'WEIGHTS_0' in p['attributes']
            skinned = skinned or has
            print(f'  mesh "{m.get("name")}": {n} vertices, skin weights: {"yes" if has else "NO"}')
    bound = [n.get('name') for n in j.get('nodes', []) if 'skin' in n and 'mesh' in n]
    print(f'  skeleton joints: {sum(len(s["joints"]) for s in j.get("skins", []))}, meshes bound to a skin: {len(bound)}')
    if verts < 2000: print(f'  PROBLEM: only {verts} vertices - a real character needs thousands'); ok = False
    if not skinned: print('  PROBLEM: no JOINTS_0/WEIGHTS_0 - the mesh does not follow the skeleton'); ok = False
    for a in j.get('animations', []):
        bones = {j['nodes'][c['target']['node']].get('name') for c in a['channels']}
        print(f'  clip "{a.get("name")}": {len(a["channels"])} channels on {len(bones)} bones')
        if len(bones) < 6: print('    PROBLEM: animates fewer than 6 bones - not a real body animation'); ok = False
    if not j.get('animations'): print('  PROBLEM: no animation clips'); ok = False
    print('RESULT:', 'usable rigged character' if ok else 'NOT a usable rigged character')

main(sys.argv[1])
