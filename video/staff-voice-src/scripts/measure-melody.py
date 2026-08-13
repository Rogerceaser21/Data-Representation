#!/usr/bin/env python3
# Melody-variance meter for narration takes. Born 2026-08-07 (focus-os-promo rc1
# rejection: "sounds AI narrated"), graduated into the factory 2026-08-08.
#
# WHY IT EXISTS: the consistency scorer (voiceconsist.py / score_take.py) measures
# TIMBRE drift between scenes, and it is DEAF TO MELODY. rc1 scored 1.06, a clean
# pass, and still sounded robotic. A robotic read gives every sentence the same
# falling contour: low variance of pitch, both inside phrases and between them. A
# human read varies. This prints proxies for that.
#
# WHAT IT DOES NOT MEASURE: ENERGY. Calm versus excited does not show up in these
# numbers at all. Energy register stays Igor's ear gate (the ~18s snippet before
# any full build). See knowledge/tts-voice-law.md, section 2026-08-08.
#
# Method: frame-level f0 by autocorrelation (70-320 Hz, 30 ms window, 10 ms hop),
# octave-error trim against the take median, then three proxies in semitones
# relative to that median.
#
# Usage: python3 scripts/measure-melody.py audio/a.wav [audio/b.wav ...]
# Higher f0_std, phrase_spread and drop_var = livelier. Compare takes of the
# SAME script only; absolute numbers mean nothing across scripts.
#
# Field reference (focus-os-promo, identical text, same note): Charon 4.3 st
# f0_std read flat, Umbriel 6.3 st read alive. The meter separated them; only
# the ear separated the energy.
import sys, wave, numpy as np

def load(path):
    w = wave.open(path, 'rb')
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64)
    if w.getnchannels() == 2: x = x[::2]
    w.close()
    return x / 32768.0, sr

def f0_track(x, sr, lo=70, hi=320, win_ms=30, hop_ms=10):
    win, hop = int(sr*win_ms/1000), int(sr*hop_ms/1000)
    lag_lo, lag_hi = int(sr/hi), int(sr/lo)
    e_thr = 0.008
    f0s, times = [], []
    for i in range(0, len(x)-win, hop):
        fr = x[i:i+win]
        if np.sqrt(np.mean(fr**2)) < e_thr: continue          # unvoiced/silence
        fr = fr - fr.mean()
        ac = np.correlate(fr, fr, 'full')[win-1:]
        if ac[0] <= 0: continue
        ac /= ac[0]
        seg = ac[lag_lo:lag_hi]
        if not len(seg): continue
        pk = np.argmax(seg)
        if seg[pk] < 0.30: continue                            # weak periodicity
        f0s.append(sr/(lag_lo+pk)); times.append(i/sr)
    return np.array(f0s), np.array(times)

for path in sys.argv[1:]:
    x, sr = load(path)
    f0, t = f0_track(x, sr)
    if len(f0) < 50:
        print(f"{path}: too few voiced frames"); continue
    med = np.median(f0)
    keep = (f0 > med*0.5) & (f0 < med*2.0)                     # octave-error trim
    f0, t = f0[keep], t[keep]
    st = np.log2(f0/med)*12                                    # semitones vs take median
    # phrase-level: median pitch per 1s block, spread across blocks
    blocks = [np.median(st[(t >= s) & (t < s+1)]) for s in range(int(t[-1])) if ((t >= s) & (t < s+1)).sum() > 5]
    # sentence-final falls: distribution of last-300ms slope before each gap
    gaps = np.where(np.diff(t) > 0.35)[0]
    drops = []
    for g in gaps:
        m = (t > t[g]-0.3) & (t <= t[g])
        if m.sum() >= 4:
            tt, ss = t[m], st[m]
            drops.append(np.polyfit(tt-tt[0], ss, 1)[0])
    print(f"{path}")
    print(f"  voiced {len(f0)} frames . median f0 {med:.0f} Hz")
    print(f"  f0_std        {np.std(st):5.2f} st   (frame-level melody movement)")
    print(f"  phrase_spread {np.std(blocks):5.2f} st   (how much phrases differ from each other)")
    print(f"  drop_var      {np.std(drops):5.2f}      (variety of sentence endings; robotic = all identical falls)")
    print(f"  energy register is NOT measured here: send Igor the 18s snippet")
