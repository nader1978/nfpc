#!/usr/bin/env python3
"""Bundle index.html + css/*.css + js/*.js back into ONE standalone HTML file (handy for e-mailing or offline use).
Usage:  python build.py [output.html]      (default: dist/SC_Mngt_single.html)"""
import re, sys, os
root = os.path.dirname(os.path.abspath(__file__)); out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist', 'SC_Mngt_single.html')
h = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
h = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', lambda m: '<style>\n' + open(os.path.join(root, m.group(1)), encoding='utf-8').read() + '</style>', h)
js = re.findall(r'<script src="(js/[^"]+)"></script>', h)
body = '\n'.join(open(os.path.join(root, f), encoding='utf-8').read()[:-1] for f in js)
h = re.sub(r'(?:<script src="js/[^"]+"></script>\n?)+', lambda m: '<script>\n' + body + '\n</script>\n', h, count=1)
os.makedirs(os.path.dirname(out), exist_ok=True); open(out, 'w', encoding='utf-8').write(h); print('written', out, len(h) // 1024, 'KB')
