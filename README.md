# RM202 Website (local draft)

Single-page site for RM202 · Nude Painting Session. Static HTML/CSS/JS, no build step.

- `index.html`, `styles.css`, `script.js` — the page (18+ gate, About, Sessions, Gallery, Hire us).
- `assets/photos/` — 73 Top Tier photos from the Room 202 session (17 Oct 2026): `full/` 1600px, `thumb/` 640px, EXIF stripped, plus `photos.json`.
- `scripts/develop.py` + `scripts/blur_regions.json` — rebuild the photos from `/Volumes/TRANSCEND/ROOM 202/Room 202 Top Tier/`. The 17 `model_nude` photos get the model's face and sensitive parts blurred; the boxes (percent of frame) are in `blur_regions.json`.

```
python3 scripts/develop.py assets/photos
```

## Still needed from you
- [ ] Review the draft copy in About and Hire us (marked `DRAFT COPY` in index.html).
- [ ] Confirm what `forms.gle/GmzRPuW8spEYPsAs5` is for (it's used for "Send an inquiry"); add the second bio link if needed.
- [ ] Next session date, venue and sign-up link (currently "To be announced").
- [ ] A higher-resolution logo (the current one is cropped from a 712px screenshot).
- [ ] Confirm the venue/city line ("Metro Manila") in the hero.
- [ ] Hosting/domain: parked (tagpuan.art preferred).
