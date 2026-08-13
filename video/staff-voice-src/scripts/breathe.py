#!/usr/bin/env python3
"""breathe.py - slow a scene's FELT pace by inserting real silence at its own
sentence gaps, never by stretching the voice.

Born 2026-08-12 (staff-voice v1.8): 55+ takes proved Gemini sprints short punchy
scenes (200-260 SPEECH wpm) regardless of director note or mild rewording, and
the pace brake beyond ~5 percent atempo is audible as a computerized tone (the
v1.7 lesson). This tool is the third way: find the deepest internal silences in
the target scenes (they sit at full stops), widen each by a fixed amount, and
remap timings.json + narration.srt. The voiced audio is untouched, so the take's
voice score and natural delivery survive verbatim.

Usage, from the project root, AFTER split/tighten/deflutter:
  python3 scripts/breathe.py s06_gap:0.40 s11_middle:0.40 s12_plp:0.45
Each arg is scene_id:seconds_to_insert_per_gap (up to 3 gaps per scene).
Then re-run: node scripts/pacecurve.mjs to verify, node scripts/build.mjs,
node scripts/finish-audio.mjs (TOTAL changed).
"""
import json, re, subprocess, sys, wave
import numpy as np

ROOT = "."
MAX_GAPS_PER_SCENE = 3
EDGE_KEEPOUT_HEAD = 0.5   # never widen a gap this close to the scene start
EDGE_KEEPOUT_TAIL = 0.4   # ...or this close to its end

def main():
    targets = {}
    for a in sys.argv[1:]:
        sid, _, amt = a.partition(":")
        targets[sid] = float(amt or 0.4)
    if not targets:
        sys.exit("usage: breathe.py <scene_id:seconds> [...]")

    t = json.load(open(f"{ROOT}/timings.json"))
    w = wave.open(f"{ROOT}/assets/narration.wav")
    sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, ch)

    insertions = []  # (absolute_time_s, insert_dur_s, scene_id)
    for s in t["scenes"]:
        if s["id"] not in targets:
            continue
        out = subprocess.run(
            ["ffmpeg", "-hide_banner", "-nostats", "-ss", str(s["start"]), "-t", str(s["dur"]),
             "-i", f"{ROOT}/assets/narration.wav", "-af", "silencedetect=noise=-35dB:d=0.12",
             "-f", "null", "-"], capture_output=True, text=True).stderr
        sils = [(float(a), float(b)) for a, b in zip(
            re.findall(r"silence_start: ([\d.]+)", out),
            re.findall(r"silence_end: ([\d.]+)", out))]
        internal = [(a, b) for a, b in sils
                    if a > EDGE_KEEPOUT_HEAD and b < s["dur"] - EDGE_KEEPOUT_TAIL]
        internal.sort(key=lambda p: p[1] - p[0], reverse=True)
        for a, b in internal[:MAX_GAPS_PER_SCENE]:
            insertions.append((s["start"] + (a + b) / 2, targets[s["id"]], s["id"]))
    insertions.sort()
    if not insertions:
        sys.exit("no internal gaps found in the target scenes")

    pieces, last = [], 0
    for tm, d, sid in insertions:
        idx = int(tm * sr)
        pieces.append(x[last:idx])
        pieces.append(np.zeros((int(d * sr), ch), dtype=np.int16))
        last = idx
        print(f"  {sid:14s} +{d}s at {tm:7.2f}s")
    pieces.append(x[last:])
    y = np.vstack(pieces)

    shift_map = [(tm, d) for tm, d, _ in insertions]
    def shifted(v): return v + sum(d for tm, d in shift_map if tm < v)

    for s in t["scenes"]:
        end = s["start"] + s["dur"]
        ns, ne = shifted(s["start"]), shifted(end - 1e-6)
        s["start"], s["dur"] = round(ns, 3), round(ne - ns + 1e-6, 3)
    t["total"] = round(t["total"] + sum(d for _, d in shift_map), 3)
    json.dump(t, open(f"{ROOT}/timings.json", "w"), indent=2)

    ww = wave.open(f"{ROOT}/assets/narration.wav", "wb")
    ww.setnchannels(ch); ww.setsampwidth(sw); ww.setframerate(sr)
    ww.writeframes(y.tobytes()); ww.close()
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-i", f"{ROOT}/assets/narration.wav",
                    "-codec:a", "libmp3lame", "-b:a", "192k",
                    f"{ROOT}/assets/narration.mp3"], check=True)

    def ts2s(h, m, sec, ms): return int(h)*3600 + int(m)*60 + int(sec) + int(ms)/1000
    def s2ts(v):
        h = int(v // 3600); v -= h*3600; m = int(v // 60); v -= m*60
        sec = int(v); ms = int(round((v - sec)*1000))
        return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"
    srt = open(f"{ROOT}/narration.srt").read()
    srt = re.sub(r"(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)",
                 lambda m: f"{s2ts(shifted(ts2s(*m.group(1,2,3,4))))} --> {s2ts(shifted(ts2s(*m.group(5,6,7,8))))}",
                 srt)
    open(f"{ROOT}/narration.srt", "w").write(srt)
    print(f"new total {t['total']}s  next: node scripts/pacecurve.mjs, build, finish-audio")

if __name__ == "__main__":
    main()
