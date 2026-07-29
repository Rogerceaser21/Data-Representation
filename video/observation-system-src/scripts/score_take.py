#!/usr/bin/env python3
"""Score the current master's scene-to-scene voice consistency (voiceconsist metric).
Prints one JSON line: {"adj_mean":..,"adj_max":..,"between":..,"ratio":..}
Run from the project dir after deflutter.py."""
import sys, os, json
import numpy as np

src = open("scripts/voiceconsist.py").read()
ns = {}
exec(compile(src.split("def analyse")[0], "vc", "exec"), ns)
read_wav, ltas = ns["read_wav"], ns["ltas"]

tim = json.load(open("timings.json"))
specs, within = [], []
for s in tim["scenes"]:
    x, sr = read_wav("assets/narration.wav", s["start"], s["start"] + s["dur"])
    db, c = ltas(x, sr)
    half = len(x) // 2
    a, _ = ltas(x[:half], sr)
    b, _ = ltas(x[half:], sr)
    if a is not None and b is not None:
        within.append(float(np.mean(np.abs(a - b))))
    specs.append(db)
specs = np.array(specs)
n = len(specs)
adj = [float(np.mean(np.abs(specs[i] - specs[i + 1]))) for i in range(n - 1)]
allp = [float(np.mean(np.abs(specs[i] - specs[j]))) for i in range(n) for j in range(i + 1, n)]
out = {"adj_mean": round(float(np.mean(adj)), 3), "adj_max": round(float(np.max(adj)), 3),
       "between": round(float(np.mean(allp)), 3),
       "ratio": round(float(np.mean(allp) / np.mean(within)), 3),
       "total": tim["total"]}
print(json.dumps(out))
