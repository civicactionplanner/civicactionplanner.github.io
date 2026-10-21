#!/usr/bin/env python3
"""Lay narration clips on the schedule, pad with silence, write track.wav."""
import json, os, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sched = json.load(open(os.path.join(HERE, "schedule.json")))
lead = float(sys.argv[1])  # seconds of video before scene timeline t0
SR = json.load(open(os.path.join(HERE, "schedule.json"))).get("sr", 24000)

def read_wav(p):
    with wave.open(p, "rb") as w:
        assert w.getframerate() == SR and w.getnchannels() == 1, (w.getframerate(), w.getnchannels())
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)

total_s = lead + sched["total"] + 1.0
track = np.zeros(int(total_s * SR), dtype=np.int16)
for sc in sched["scenes"]:
    clip = read_wav(os.path.join(HERE, f"narr_{sc['id']}.wav"))
    start = int((lead + sc["start"]) * SR)
    track[start:start + len(clip)] = clip[: len(track) - start]

# soft synthesized pad under the voice (C, G, Am, F at 72 bpm), very quiet
def music(n):
    t = np.arange(n) / SR
    out = np.zeros(n)
    chords = [[261.63, 329.63, 392.0], [196.0, 246.94, 392.0], [220.0, 261.63, 329.63], [174.61, 261.63, 349.23]]
    bar = 4 * 60 / 72
    seg = int(bar * SR)
    for i in range(0, n, seg):
        ch = chords[(i // seg) % 4]
        tt = t[i:i+seg] - t[i]
        envl = np.minimum(tt / 0.9, 1) * np.exp(-tt / (bar * 1.2))
        for fq in ch:
            out[i:i+seg] += 0.3 * np.sin(2 * np.pi * fq * tt) * envl + 0.1 * np.sin(2 * np.pi * fq * 2 * tt) * envl
    fi = int(2 * SR); out[:fi] *= np.linspace(0, 1, fi)
    fo = int(2.5 * SR); out[-fo:] *= np.linspace(1, 0, fo)
    return out * 0.09

tf = track.astype(np.float64) + music(len(track)) * 32767
track = np.clip(tf, -32767, 32767).astype(np.int16)

peak = np.abs(track).max()
if peak > 0:
    gain = min(3.0, 0.89 * 32767 / peak)
    track = np.clip(track.astype(np.float64) * gain, -32767, 32767).astype(np.int16)
    print(f"normalized, gain x{gain:.2f}")

out = os.path.join(HERE, "track.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(track.tobytes())
print("track:", out, f"{total_s:.1f}s, lead {lead:.2f}s")
