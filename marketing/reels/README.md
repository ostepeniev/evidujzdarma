# Rilsy EvidujZdarma (S7, 28. 10. 2026)

Rilsy bez obličeje: animovaný text a grafika (Remotion) → český AI hlas a karaoke titulky (montáž Holos) → Instagram, Facebook, Threads.
Pravidla obsahu: DECISIONS Ф15 a project doc `claude/CONTENT-plan-EET-2026-10-28.md` (ostře, ale poctivě: každé číslo se zdrojem).

## Postup

1. Scénář do `scripts/reels.json`: `{id, scenes: [{type, voice, …props}]}`.
   - Typy scén: `title`, `number` (countdown / counter / value), `list`, `bars`, `timeline`, `cta`.
   - `[[slovo]]` = žlutý marker. `seconds` dopočítá skript (≈ 14 znaků hlasu za sekundu + 0,8 s).
2. `npm i` a pak `scripts/render_all.sh`: každá scéna se renderuje jako samostatný klip `out/<id>/sNN.mp4` (1080×1920, 30 fps).
   - Spodních ~700 px nechávají scény volných pro titulky.
3. Nahrání do Holos (kabinet „Eviduj Zdarma“, `e963aa59`):
   - `media_upload_link` → stáhnout skript, přečíst ho → `sh holos-upload.sh <složka s mp4>`.
4. `montage_video` s těmito parametry:
   - `format: reel`, `voice: tts`, `speech: cs`;
   - `clips: [{id, from: 0, to: seconds, text: voice}]`, `smart_cut: false`, `hook: off`;
   - `transition: slide`, `subtitles: karaoke`, `subtitle_style: box`, `subtitle_position: low`;
   - `color: #ffdf73`, `end_card: "EvidujZdarma.cz\nEET 2.0 bez stresu"`, `subtitle_langs: {}`.
   - Hudba: klíč ElevenLabs zatím nemá Music Generation, proto rilsy zatím běží bez hudby.
5. Pro každou síť zvlášť: `create_draft` (jedna síť → text jde doslova) → `attach_media` → `schedule_post`.
   - Časy (Europe/Kyiv): IG 13:15, FB 19:30, Threads 10:00.
   - `first_comment` s UTM `utm_campaign=reel-<id>`.
