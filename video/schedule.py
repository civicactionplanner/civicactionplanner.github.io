#!/usr/bin/env python3
"""Build schedule.json (timing, talk segments, mouth envelope) from existing narr_*.wav."""
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(HERE, "scenes.json")))

schedule, t = [], 0.0
sr_global = None
for sc in cfg["scenes"]:
    path = os.path.join(HERE, f"narr_{sc['id']}.wav")
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        if w.getnchannels() == 2:
            pcm = pcm.reshape(-1, 2).mean(axis=1).astype(np.int16)
    sr_global = sr
    samples = pcm.astype(np.float32) / 32767.0
    audio_len = len(samples) / sr
    dur = audio_len + sc["pad"]

    win = int(sr * 0.03)
    n = len(samples) // win
    rms = np.sqrt((samples[: n * win].reshape(n, win) ** 2).mean(axis=1))
    on = rms > (rms.max() * 0.05)
    segs, cur = [], None
    for i, v in enumerate(on):
        ts = i * win / sr
        if v and cur is None: cur = ts
        if not v and cur is not None: segs.append([cur, ts]); cur = None
    if cur is not None: segs.append([cur, n * win / sr])
    merged = []
    for a, b in segs:
        if merged and a - merged[-1][1] < 0.28: merged[-1][1] = b
        else: merged.append([a, b])
    talk = [[round(a, 2), round(b, 2)] for a, b in merged if b - a > 0.12]

    hop = int(sr * 0.08)
    m = len(samples) // hop
    levs = [float(np.sqrt((samples[i*hop:(i+1)*hop] ** 2).mean())) for i in range(m)]
    mx = max(levs) or 1.0
    q = [0 if r < mx * 0.07 else (1 if r < mx * 0.42 else 2) for r in levs]
    for i in range(1, len(q) - 1):
        if q[i] == 0 and q[i-1] > 0 and q[i+1] > 0: q[i] = 1
    env = "".join(map(str, q))

    schedule.append({"id": sc["id"], "text": sc["text"], "caption": sc.get("caption", sc["text"]),
                     "start": round(t, 3), "audio": round(audio_len, 3), "dur": round(dur, 3),
                     "sr": sr, "talk": talk, "env": env})
    t += dur
    print(f"{sc['id']}: {audio_len:.1f}s audio, {len(talk)} segs")

json.dump({"scenes": schedule, "total": round(t, 3), "sr": sr_global}, open(os.path.join(HERE, "schedule.json"), "w"), indent=1)
print("total:", round(t, 1), "s @", sr_global, "Hz")
