# Tutorial video source

docs/planner-tutorial.mp4 is built from these files, fully offline on a Mac
with the Kokoro voice venv (~/.claude/voice/venv) and Playwright.

1. `jaw.py` cuts the official MDC mascot art (used with the college's
   permission) into finn_0/1/2.png: closed, half open, and open mouth,
   via a translated lower-jaw layer over a dark mouth interior.
2. `synth.py` reads scenes.json, writes one narration wav per scene
   (voice am_puck, speed 1.08), detects the speech envelope, and writes
   schedule.json with per-scene talk segments.
3. `record.mjs` (run from the repo root with TUTDIR pointing here) drives
   the live site inside stage.html and records 1920x1080 webm; the mouth
   flaps only inside the talk segments, captions can differ from the
   spoken text, and a blackout layer drops at the schedule's time zero.
4. The first bright frame marks time zero: trim the video there (ffmpeg
   -ss), build the track with `mix.py 0`, then mux with
   -c:v libx264 -crf 20 -c:a aac.
