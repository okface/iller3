# MedQ Trainer

Mobile-first progressive web app for practicing multiple-choice medical questions. Uses `data/questions.yaml` and filters only questions with `uses_image: false`.

## Features
- Mobile friendly (Android vertical focus)
- Quick sessions: 5 or 10 questions
- Custom session with category selection
- Weak category focus (accuracy <60% with >=3 attempts)
- Per-category, daily, and overall stats (stored locally)
- Resume unfinished session
- Immediate feedback with explanation
- Offline capable (PWA) after first load
- Light minimal design with purple accents

## Data
Questions are loaded from `data/questions.yaml` client-side. Only entries where `uses_image` is `false` are included.

## Local Development
Open `index.html` in a local server (to allow fetch of YAML). For example:

```
# Python 3
python -m http.server 8000
```
Then visit http://localhost:8000/

## GitHub Pages Deployment
1. Ensure repository is on GitHub.
2. Add GitHub Action workflow (not yet added if you clone manually) or enable Pages from `Settings > Pages` selecting branch `main` root.
3. After enabling, your URL will be: `https://<username>.github.io/<repo>/`.

App assets are relative paths so it works under a project subpath.

## PWA Install
On Android Chrome: 1) Visit page 2) Add to Home Screen.

## Clearing Progress
Clear site data / localStorage for the domain to reset stats.

## License
MIT (add a LICENSE file if you need one).
