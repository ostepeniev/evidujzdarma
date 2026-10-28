#!/bin/bash
cd "$(dirname "$0")/.."
python3 - <<'PY'
import json,os
R=json.load(open('scripts/reels.json'))
for r in R:
    os.makedirs(f"out/{r['id']}",exist_ok=True)
    for i,s in enumerate(r['scenes']):
        json.dump(s,open(f"out/{r['id']}/s{i+1:02d}.json",'w'),ensure_ascii=False)
PY
for d in out/r0*; do
  for j in $d/s*.json; do
    b=${j%.json}
    [ -f "$b.mp4" ] && continue
    npx remotion render src/index.ts Scene "$b.mp4" --props="$j" --codec=h264 --crf=18 >> out/render.log 2>&1 || echo "FAIL $j" >> out/render.log
    echo "done $b" >> out/render.log
  done
done
echo ALLDONE >> out/render.log
