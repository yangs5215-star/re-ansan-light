#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
print 'RE:ANSAN 2.0 — http://127.0.0.1:8000'
print '按 Ctrl+C 关闭本地服务器。 / Ctrl+C로 종료합니다.'
python3 -m http.server 8000 --bind 127.0.0.1
