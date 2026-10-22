#!/usr/bin/env python3
"""Synthesize the scene narration with Chatterbox, cloning the am_puck timbre."""
import json, os, sys, time
import torch, torchaudio

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "sample_am_puck.wav")
cfg = json.load(open(os.path.join(HERE, "scenes.json")))

from chatterbox.tts import ChatterboxTTS
device = "mps" if torch.backends.mps.is_available() else "cpu"
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
try:
    model = ChatterboxTTS.from_pretrained(device=device)
except Exception as e:
    print("mps load failed, falling back to cpu:", str(e)[:120])
    device = "cpu"
    model = ChatterboxTTS.from_pretrained(device=device)
print("device:", device, "sr:", model.sr)

only = sys.argv[1] if len(sys.argv) > 1 else None
for sc in cfg["scenes"]:
    if only and sc["id"] != only:
        continue
    t0 = time.time()
    wav = model.generate(sc["text"], audio_prompt_path=REF, exaggeration=0.7, cfg_weight=0.35)
    out = os.path.join(HERE, f"narr_{sc['id']}.wav")
    torchaudio.save(out, wav, model.sr)
    print(f"{sc['id']}: {wav.shape[-1]/model.sr:.1f}s audio in {time.time()-t0:.0f}s")
print("done")
