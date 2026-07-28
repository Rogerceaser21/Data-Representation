#!/usr/bin/env python3
"""Measure how much the narrator's voice changes between scenes.

Timbre lives in the long-term average spectrum. For each scene we take the
average magnitude spectrum over its voiced frames, normalise for loudness (so
this measures colour, not level), and then compare scenes to each other.

Reported: mean pairwise spectral distance in dB across 100 Hz - 8 kHz, and the
spread of the spectral centroid. Lower = the scenes sound more like one person.
A per-line version and a single-take version can be compared directly.

Run it from the project directory after any narration change:  python3 scripts/voiceconsist.py
The v1.2 baseline to beat (see README): BETWEEN 1.82 dB, WITHIN 1.62 dB, ratio 1.13x,
centroid spread 65 Hz, and adjacent scenes 1.08 dB. If BETWEEN climbs toward 2.0 dB with
a flat ratio, per-line drift is back and the take was not generated in one request.
"""
import sys, wave, json, subprocess, os
import numpy as np

def read_wav(path, t0=None, t1=None):
    # always go through ffmpeg, so this works on the committed .mp3 as well as a .wav
    tmp = "/tmp/_vc.wav"
    args = ["ffmpeg","-hide_banner","-loglevel","error","-y","-i",path]
    if t0 is not None: args += ["-ss",f"{t0:.3f}","-to",f"{t1:.3f}"]
    subprocess.run(args + ["-ac","1","-ar","24000",tmp], check=True)
    path = tmp
    with wave.open(path,'rb') as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64)/32768.0
    return x, sr

def ltas(x, sr, nfft=1024):
    """Loudness-normalised long-term average spectrum, dB, voiced frames only."""
    hop = nfft//2
    frames = [x[i:i+nfft] for i in range(0, max(1,len(x)-nfft), hop)]
    frames = [f for f in frames if len(f)==nfft]
    if not frames: return None, None
    E = np.array([np.sqrt(np.mean(f**2)) for f in frames])
    keep = E > max(E.max()*0.08, 1e-4)          # drop silence/breath
    frames = [f for f,k in zip(frames,keep) if k]
    if len(frames) < 8: return None, None
    win = np.hanning(nfft)
    S = np.array([np.abs(np.fft.rfft(f*win)) for f in frames])
    S = S / (S.sum(axis=1, keepdims=True) + 1e-12)   # per-frame level-normalise
    m = S.mean(axis=0)
    freqs = np.fft.rfftfreq(nfft, 1/sr)
    band = (freqs>=100)&(freqs<=8000)
    db = 20*np.log10(m[band]+1e-12)
    db = db - db.mean()                               # remove any residual tilt in level
    centroid = float((freqs[band]*m[band]).sum()/(m[band].sum()+1e-12))
    return db, centroid

def analyse(name, segments):
    """BETWEEN = scene i vs scene j (different words, and possibly a different take).
    WITHIN  = first half vs second half of the SAME scene (different words, same take).

    The control matters. Two scenes always differ phonetically, so a raw between-
    scene number cannot be read on its own. WITHIN is the floor that phonetic
    difference alone produces. BETWEEN minus WITHIN is what is left over for
    speaker drift. If the ratio is ~1.0 the metric cannot see any drift at all."""
    specs, cents, within = [], [], []
    for label, path, t0, t1 in segments:
        x, sr = read_wav(path, t0, t1)
        db, c = ltas(x, sr)
        if db is None: continue
        specs.append(db); cents.append(c)
        half = len(x)//2
        a, _ = ltas(x[:half], sr); b, _ = ltas(x[half:], sr)
        if a is not None and b is not None:
            within.append(float(np.mean(np.abs(a-b))))
    specs = np.array(specs)
    n = len(specs)
    d = [float(np.mean(np.abs(specs[i]-specs[j]))) for i in range(n) for j in range(i+1,n)]
    ratio = np.mean(d)/np.mean(within) if within else float('nan')
    print(f"\n{name}: {n} scenes")
    print(f"  BETWEEN scenes  {np.mean(d):5.2f} dB   (max pair {np.max(d):5.2f})")
    print(f"  WITHIN a scene  {np.mean(within):5.2f} dB   <- phonetic floor, same take by definition")
    print(f"  ratio           {ratio:5.2f}x   (1.0 = no measurable drift beyond wording)")
    print(f"  centroid spread {np.std(cents):5.0f} Hz  (mean {np.mean(cents):.0f})")
    return float(np.mean(d)), float(np.std(cents))

root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(f"{root}/scenes.json"))

old = [(s["id"], f"{root}/audio/norm/{s['id']}.wav", None, None)
       for s in cfg["scenes"] if os.path.exists(f"{root}/audio/norm/{s['id']}.wav")]
tim = json.load(open(f"{root}/timings.json"))
master = f"{root}/assets/narration.wav"
if not os.path.exists(master): master = f"{root}/assets/narration.mp3"
new = [(s["id"], master, s["start"], s["start"]+s["dur"]) for s in tim["scenes"]]

a = analyse("PER-LINE takes (v1.1, one request per scene)", old) if old else None
b = analyse("SINGLE take (v1.2, one request, split locally)", new)
if a:
    print(f"\nspectral distance {a[0]:.2f} -> {b[0]:.2f} dB  ({(1-b[0]/a[0])*100:.0f}% closer)")
    print(f"centroid spread   {a[1]:.0f} -> {b[1]:.0f} Hz  ({(1-b[1]/a[1])*100:.0f}% tighter)")
