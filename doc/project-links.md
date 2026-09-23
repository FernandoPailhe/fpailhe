# Project links — pending verification

Only verified public links go into `apps/web/public/data/projects.json`.
As of the v0.2.0 release, **no public link could be verified** for any
project, so none of them declare `links` or `screenshot` yet:

- EQM: internal Techint app; no public link expected.
- Tune-Up: live on Google Play (link added in `projects.json`); add App Store / website if published there.
- HangApp: add public store links if available.
- Be Soul: Play Store + App Store links added.
- PassApp: Play Store links for the User and Security apps added.
- El Puma Contigo: Play Store + App Store links added.

Checked: `github.com/FernandoPailhe` public repositories (AndroidChallenge,
ArgentinaCampeon, ArgentinaCampeonServer, MachineStock, 100Bubbles,
react-navigation fork, OT306-client fork) — none correspond to the projects
listed on the site, so no GitHub links were added.

When a link is verified, add a `ProjectLink` entry to `projects.json`:

```json
"links": [{ "type": "github", "url": "https://github.com/..." }]
```

Valid `type` values: `appStore`, `playStore`, `github`, `website`, `youtube`.
Optional `label` overrides the default label per type.

Screenshots are also optional: place the file under
`apps/web/public/project-screenshots/<id>.png` and set
`"screenshot": "/project-screenshots/<id>.png"` on the project.

## More projects (archive list, 2026-09-23)

- Argentina Campeón del Mundo: still on Google Play but its backend is offline, so it links only to the GitHub repos (status `discontinued`).
- Machine Stock, 100 Bubbles: GitHub repos (100 Bubbles was published on Google Play in 2020; store link not verified).
- Stadium platform: platform no longer active (status `discontinued`), no public links.
- Wao, Dalto Ambassadors: never released (status `unreleased`).
