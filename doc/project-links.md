# Project links — pending verification

Only verified public links go into `apps/web/public/data/projects.json`.
As of the v0.2.0 release, **no public link could be verified** for any
project, so none of them declare `links` or `screenshot` yet:

- EQM: internal Techint app; no public link expected.
- Tune-Up: live on Google Play (link added in `projects.json`); add App Store / website if published there.
- HangApp: add public store links if available.
- Be Soul: add public store links if available.
- PassApp: add public store links if available.
- El Puma Contigo: add public store links if available.

Checked: `github.com/FernandoPailhe` public repositories (AndroidChallenge,
ArgentinaCampeon, ArgentinaCampeonServer, MachineStock, 100Bubbles,
react-navigation fork, OT306-client fork) — none correspond to the projects
listed on the site, so no GitHub links were added.

When a link is verified, add a `ProjectLink` entry to `projects.json`:

```json
"links": [{ "type": "github", "url": "https://github.com/..." }]
```

Valid `type` values: `appStore`, `playStore`, `github`, `website`.
Optional `label` overrides the default label per type.

Screenshots are also optional: place the file under
`apps/web/public/project-screenshots/<id>.png` and set
`"screenshot": "/project-screenshots/<id>.png"` on the project.
