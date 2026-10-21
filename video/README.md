# Tutorial video source

planner-tutorial.mp4 (in docs/) is built from these files, fully offline:

1. `synth.py` (run with the Kokoro venv at ~/.claude/voice/venv) reads
   scenes.json, writes one narration wav per scene and schedule.json.
2. `record.mjs` (run from the repo root, TUTDIR pointing at this folder)
   drives the live site inside stage.html with Playwright and records
   1920x1080 webm on the schedule's timeline.
3. `mix.py <lead seconds>` lays the narration on the timeline;
   lead = video duration - schedule total - 0.8.
4. ffmpeg muxes: -c:v libx264 -crf 20 -c:a aac.

Sharky is an original cartoon shark in MDC blue, not the college's
official mascot art; swap the SVG in stage.html if MDC grants use of Finn.
