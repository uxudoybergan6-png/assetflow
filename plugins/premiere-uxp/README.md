# Premiere Pro UXP Plugin

## Build

```bash
npm run build -w @creative-tools/premiere-uxp
```

Output in `plugins/premiere-uxp/dist/`

## Load in Premiere Pro

1. Install [UXP Developer Tool](https://developer.adobe.com/photoshop/uxp/2022/guides/devtool/)
2. Add plugin → select `dist` folder (contains manifest.json)
3. Load into Premiere Pro
4. Window → Extensions → CreativeTools

## Configure API URL

Edit `src/api.ts` `API_URL` for production, or use env injection in webpack.

## Token

Generate from web dashboard → paste in plugin settings.
