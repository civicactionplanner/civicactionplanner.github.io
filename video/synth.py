#!/usr/bin/env python3
"""Synthesize per-scene narration WAVs with kokoro_onnx and write a schedule."""
import json, os, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE_DIR = os.path.expanduser("~/.claude/voice")
cfg = json.load(open(os.path.join(HERE, "scenes.json")))

from kokoro_onnx import Kokoro
k = Kokoro(os.path.join(VOICE_DIR, "kokoro-v1.0.onnx"), os.path.join(VOICE_DIR, "voices-v1.0.bin"))

schedule = []
t = 0.0
for sc in cfg["scenes"]:
    samples, sr = k.create(sc["text"], voice=cfg["voice"], speed=cfg["speed"])
    samples = np.asarray(samples, dtype=np.float32)
    path = os.path.join(HERE, f"narr_{sc['id']}.wav")
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    audio_len = len(samples) / sr
    dur = audio_len + sc["pad"]
    # speech envelope -> talk segments so the mouth only moves with the voice
    win = int(sr * 0.03)
    n = len(samples) // win
    rms = np.sqrt((samples[: n * win].reshape(n, win) ** 2).mean(axis=1))
    on = rms > (rms.max() * 0.05)
    segs, cur = [], None
    for i, v in enumerate(on):
        ts = i * win / sr
        if v and cur is None: cur = ts
        if not v and cur is not None:
            segs.append([cur, ts]); cur = None
    if cur is not None: segs.append([cur, n * win / sr])
    merged = []
    for a, b in segs:
        if merged and a - merged[-1][1] < 0.28: merged[-1][1] = b
        else: merged.append([a, b])
    talk = [[round(a, 2), round(b, 2)] for a, b in merged if b - a > 0.12]
    schedule.append({"id": sc["id"], "text": sc["text"], "start": round(t, 3), "audio": round(audio_len, 3), "dur": round(dur, 3), "sr": sr, "talk": talk, "caption": sc.get("caption", sc["text"])})
    t += dur
    print(f"{sc['id']}: audio {audio_len:.1f}s, scene {dur:.1f}s")

json.dump({"scenes": schedule, "total": round(t, 3)}, open(os.path.join(HERE, "schedule.json"), "w"), indent=1)
print("total timeline:", round(t, 1), "s")
