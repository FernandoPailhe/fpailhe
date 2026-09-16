# Project media

Media assets for project detail pages (`/projects/<id>`), referenced from
`apps/web/public/data/project-details.json`.

## Layout

- `project-media/<projectId>/<file>` — one subfolder per project id
  (e.g. `project-media/tune-up/weekly-summary.png`).

## Recommended workflow (Google Drive)

Google Drive folders can't be listed or hot-linked reliably from a static
site. Download the assets from Drive, optimize them, and commit them here:

- Images: WebP/JPG/PNG, max ~1600px wide.
- Videos: MP4 (H.264), short clips preferred. Large videos can instead be
  embedded from Drive/YouTube with `type: "embed"` (see below).

## Referencing from `project-details.json`

```json
{ "type": "image", "src": "/project-media/tune-up/weekly-summary.png", "alt": "Weekly summary screen" }
{ "type": "video", "src": "/project-media/tune-up/demo.mp4", "poster": "/project-media/tune-up/demo-poster.jpg", "caption": "30s demo" }
{ "type": "embed", "src": "https://drive.google.com/file/d/<FILE_ID>/preview", "title": "Tune-Up demo", "caption": "Demo hosted on Drive" }
```

For Drive embeds the file must be shared "Anyone with the link"; use the
`/preview` URL (right-click file → Preview → ⋮ → Share → copy link, then
replace `/view` with `/preview`).
