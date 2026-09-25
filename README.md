# postal-mime documentation

The documentation site for [postal-mime](https://github.com/postalsys/postal-mime), published at [postal-mime.postalsys.com](https://postal-mime.postalsys.com/). Built with [Docusaurus](https://docusaurus.io/).

## Local development

```bash
npm install
npm start
```

This starts a local development server at http://localhost:3000 and opens it in a browser. Most changes are reflected live without restarting the server.

## Build

```bash
npm run build
```

This generates the static site into the `build` directory. `npm run serve` serves that build locally.

## Deployment

Every push to `master` builds the site and deploys it to GitHub Pages through `.github/workflows/deploy.yml`. There is no manual deploy step.

## Keeping the docs current

The library lives in the [postal-mime](https://github.com/postalsys/postal-mime) repository. Its README and CHANGELOG describe the current behavior and are the source of truth; update the pages under `docs/` whenever an option, a type or a documented behavior changes there. The live demo on the site parses messages with the `postal-mime` package listed in `package.json`, so bump that dependency after a release.
