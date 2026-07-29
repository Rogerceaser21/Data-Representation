#!/usr/bin/env python3
"""Pull every scene to the same timbre.

The single take fixed the scene-to-scene jumping (adjacent scenes now measure
closer than the phonetic floor) but Gemini drifts slowly across a long take:
spectral distance correlates +0.85 with how far apart two scenes are, so the
open and the close no longer match.

The drift is a slow change in spectral balance, which is exactly what an EQ can
undo. For each scene we measure its long-term average spectrum, compare it with
the average across the whole take, and apply a gentle corrective filter (capped,
smoothed) so every scene sits on the take's average colour. This is linear
filtering: it changes tone, never timing, so it cannot smear the voice the way
time-stretching did.

Run after split.mjs. Durations and timings.json are unchanged.
"""
import json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = f"{ROOT}/assets/narration.wav"
WORK = f"{ROOT}/audio/.eq"
MAX_CORRECTION_DB = 2.5      # least intervention that achieves the flattening
BANDS = np.geomspace(120, 7800, 22)

def sh(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("ffmpeg failed: " + r.stderr[-400:])
    return r

def read(path):
    with wave.open(path, 'rb') as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
    return x, sr

def band_levels(x, sr, nfft=1024):
    """Mean level in each analysis band, dB, voiced frames only, level-normalised."""
    hop = nfft // 2
    frames = [x[i:i + nfft] for i in range(0, max(1, len(x) - nfft), hop)]
    frames = [f for f in frames if len(f) == nfft]
    E = np.array([np.sqrt(np.mean(f ** 2)) for f in frames]) if frames else np.array([])
    if E.size == 0: return None
    frames = [f for f, k in zip(frames, E > max(E.max() * 0.08, 1e-4)) if k]
    if len(frames) < 8: return None
    win = np.hanning(nfft)
    S = np.array([np.abs(np.fft.rfft(f * win)) for f in frames])
    S = S / (S.sum(axis=1, keepdims=True) + 1e-12)
    m = S.mean(axis=0)
    freqs = np.fft.rfftfreq(nfft, 1 / sr)
    out = []
    for i, fc in enumerate(BANDS):
        lo = BANDS[i - 1] if i else fc / 1.3
        hi = BANDS[i + 1] if i + 1 < len(BANDS) else fc * 1.3
        sel = (freqs >= lo) & (freqs < hi)
        out.append(20 * np.log10(m[sel].mean() + 1e-12) if sel.any() else np.nan)
    out = np.array(out)
    return out - np.nanmean(out)

tim = json.load(open(f"{ROOT}/timings.json"))
scenes = tim["scenes"]
os.makedirs(WORK, exist_ok=True)

# 1. cut each scene out of the master and measure it
levels = []
for i, s in enumerate(scenes):
    f = f"{WORK}/s{i:02d}.wav"
    sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", MASTER,
        "-ss", f"{s['start']:.3f}", "-t", f"{s['dur']:.3f}", "-ac", "1", "-ar", "24000", f])
    x, sr = read(f)
    levels.append(band_levels(x, sr))
levels = np.array([l if l is not None else np.zeros(len(BANDS)) for l in levels])

# 2. the take's own average colour is the target
target = np.nanmean(levels, axis=0)

# 3. correct each scene toward it, capped and smoothed so nothing sounds filtered
corr = np.clip(target[None, :] - levels, -MAX_CORRECTION_DB, MAX_CORRECTION_DB)
k = np.array([0.25, 0.5, 0.25])
corr = np.array([np.convolve(c, k, mode='same') for c in corr])

print(f"drift correction across {len(scenes)} scenes")
print(f"  largest single band move : {np.abs(corr).max():.2f} dB")
print(f"  mean move per scene      : {np.abs(corr).mean(axis=1).mean():.2f} dB")

# 4. apply, then rebuild the master with the same lead / gaps / tail
parts = []
lead = f"{WORK}/lead.wav"
sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
    "-i", "anullsrc=r=24000:cl=mono", "-t", str(tim["lead"]), lead])
gap = f"{WORK}/gap.wav"
sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
    "-i", "anullsrc=r=24000:cl=mono", "-t", str(tim["gap"]), gap])
parts.append(lead)
for i, s in enumerate(scenes):
    entries = ";".join(f"entry({fc:.0f},{g:.2f})" for fc, g in zip(BANDS, corr[i]))
    out = f"{WORK}/e{i:02d}.wav"
    sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", f"{WORK}/s{i:02d}.wav",
        "-af", f"firequalizer=gain_entry='{entries}'", "-ar", "24000", "-ac", "1", out])
    parts.append(out)
    if i < len(scenes) - 1: parts.append(gap)
tail = f"{WORK}/tail.wav"
tail_len = max(0.1, tim["total"] - (scenes[-1]["start"] + scenes[-1]["dur"]))
sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
    "-i", "anullsrc=r=24000:cl=mono", "-t", f"{tail_len:.3f}", tail])
parts.append(tail)

lst = f"{WORK}/cat.txt"
open(lst, "w").write("\n".join(f"file '{p}'" for p in parts))
sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
    "-i", lst, "-c", "copy", MASTER])
sh(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", MASTER, "-b:a", "128k",
    f"{ROOT}/assets/narration.mp3"])
subprocess.run(["rm", "-rf", WORK])
print(f"  rewrote assets/narration.wav + .mp3")
