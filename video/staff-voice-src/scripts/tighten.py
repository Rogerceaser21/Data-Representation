#!/usr/bin/env python3
"""Shrink the long intra-scene pauses. Run after split.mjs, before deflutter.py.

The take was asked for as a measured read, so the model leaves generous pauses
inside scenes (measured on v1.2: 19 pauses averaging 1.43s, plus 39 between 0.30
and 0.55s). This trims each one to a fixed length by cutting the MIDDLE of the
silence and keeping its edges, so breath decay and attack are untouched and no
synthetic silence is inserted. It removes samples of silence only: it never
resamples, stretches or re-requests speech, so it cannot reintroduce the
two-narrators bug (that came from per-scene time-stretching).

The 13 inter-scene gaps written by split.mjs are the scene markers and are left
alone, as are the lead and tail. timings.json and narration.srt are recomputed
from the new segment lengths; never hand-edit either.
"""
import json, os, re, subprocess, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = f"{ROOT}/assets/narration.wav"
WORK = f"{ROOT}/audio/.tighten"

LONG_TO = 0.45    # a pause over THRESH becomes this
SHORT_TO = 0.22   # a pause between DETECT and THRESH becomes this
THRESH = 0.55
DETECT = 0.30     # silencedetect floor
EDGE = 0.05       # silences touching a segment edge are the cut slack; skip them

def sh(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("ffmpeg failed: " + r.stderr[-400:])
    return r

def read_wav(path):
    with wave.open(path, 'rb') as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return x, sr

def write_wav(path, x, sr):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(x.astype(np.int16).tobytes())

def silences(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path,
                        "-af", f"silencedetect=noise=-35dB:d={DETECT}", "-f", "null", "-"],
                       capture_output=True, text=True)
    out = r.stderr or ""
    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", out)]
    return list(zip(starts, ends))

tim = json.load(open(f"{ROOT}/timings.json"))
if tim.get("tightened"):
    sys.exit("timings.json says the master is already tightened; re-run split.mjs first")
os.makedirs(WORK, exist_ok=True)

x, sr = read_wav(MASTER)

new_scenes, parts = [], []
lead_n = int(round(tim["lead"] * sr))
gap_n = int(round(tim["gap"] * sr))
parts.append(np.zeros(lead_n, dtype=np.int16))
t = tim["lead"]
saved_total, n_long, n_short = 0.0, 0, 0

for i, s in enumerate(tim["scenes"]):
    a = int(round(s["start"] * sr))
    b = int(round((s["start"] + s["dur"]) * sr))
    seg = x[a:b]
    f = f"{WORK}/s{i:02d}.wav"
    write_wav(f, seg, sr)
    keep = []          # (from, to) sample ranges to keep
    cur = 0
    seg_dur = len(seg) / sr
    for ss, se in silences(f):
        ln = se - ss
        if ss <= EDGE or se >= seg_dur - EDGE:      # edge slack from split.mjs, leave it
            continue
        target = LONG_TO if ln > THRESH else SHORT_TO
        if ln <= target:
            continue
        if ln > THRESH: n_long += 1
        else: n_short += 1
        saved_total += ln - target
        # keep the head and tail of the silence, drop the middle
        h0 = int(round((ss + target / 2) * sr))
        h1 = int(round((se - target / 2) * sr))
        keep.append((cur, h0)); cur = h1
    keep.append((cur, len(seg)))
    out = np.concatenate([seg[f0:t0] for f0, t0 in keep])
    parts.append(out)
    new_dur = len(out) / sr
    new_scenes.append({"id": s["id"], "title": s["title"], "text": s["text"],
                       "start": round(t, 3), "dur": round(new_dur, 3)})
    t += new_dur
    if i < len(tim["scenes"]) - 1:
        # v2.2: act-turn holds from split.mjs must survive tightening (they are the
        # music-only moments, not model hesitation); per-boundary gap, default KEEP_GAP
        g = tim.get("holds", {}).get(s["id"], tim["gap"])
        g_n = int(round(g * sr))
        parts.append(np.zeros(g_n, dtype=np.int16))
        t += g_n / sr

tail = max(0.1, tim["total"] - (tim["scenes"][-1]["start"] + tim["scenes"][-1]["dur"]))
parts.append(np.zeros(int(round(tail * sr)), dtype=np.int16))
t += tail

write_wav(MASTER, np.concatenate(parts), sr)
sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", MASTER,
    "-b:a", "128k", f"{ROOT}/assets/narration.mp3"])

tim_out = {"total": round(t, 3), "gap": tim["gap"], "lead": tim["lead"],
           "source": tim["source"], "tempo": tim["tempo"],
           "holds": tim.get("holds", {}),
           "tightened": {"long_to": LONG_TO, "short_to": SHORT_TO, "thresh": THRESH},
           "scenes": new_scenes}
json.dump(tim_out, open(f"{ROOT}/timings.json", "w"), indent=2)

# subtitles, same per-sentence share logic as split.mjs
def fmt(x):
    h, m = int(x // 3600), int(x % 3600 // 60)
    s, ms = int(x % 60), round((x % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

srt, n = [], 0
for sc in new_scenes:
    sentences = re.findall(r"[^.!?]+[.!?]+", sc["text"]) or [sc["text"]]
    tot = sum(len(sen.split()) for sen in sentences)
    cur = sc["start"]
    for sen in sentences:
        share = len(sen.split()) / tot * sc["dur"]
        n += 1
        srt.append(f"{n}\n{fmt(cur)} --> {fmt(cur + share)}\n{sen.strip()}\n")
        cur += share
open(f"{ROOT}/narration.srt", "w").write("\n".join(srt))

subprocess.run(["rm", "-rf", WORK])
print(f"tightened {n_long} long + {n_short} short pauses, saved {saved_total:.1f}s")
print(f"master {t:.1f}s ({t / 60:.2f} min); timings.json + narration.srt rewritten")
