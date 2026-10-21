#!/usr/bin/env python3
"""Lay narration clips on the schedule, pad with silence, write track.wav."""
import json, os, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sched = json.load(open(os.path.join(HERE, "schedule.json")))
lead = float(sys.argv[1])  # seconds of video before scene timeline t0
SR = 24000

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

out = os.path.join(HERE, "track.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(track.tobytes())
print("track:", out, f"{total_s:.1f}s, lead {lead:.2f}s")
