#!/usr/bin/env python3
"""Synthesize scene narration with Microsoft Edge neural voices."""
import asyncio, json, os, sys
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(HERE, "scenes.json")))
only = sys.argv[1] if len(sys.argv) > 1 else None

async def main():
    for sc in cfg["scenes"]:
        if only and sc["id"] != only: continue
        for attempt in range(4):
            try:
                tts = edge_tts.Communicate(sc["text"], cfg["voice"], rate=cfg.get("rate", "+0%"), pitch=cfg.get("pitch", "+0Hz"))
                await tts.save(os.path.join(HERE, f"narr_{sc['id']}.mp3"))
                print(sc["id"], "ok")
                break
            except Exception as e:
                if attempt == 3: raise
                print(sc["id"], "retry", attempt + 1, str(e)[:60])
                await asyncio.sleep(2 + attempt * 3)
asyncio.run(main())
