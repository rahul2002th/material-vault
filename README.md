# Material Vault | PBR Texture Library

A responsive, local-first material catalogue for 3D artists. Track PBR map availability, preview texture images, search your collection, and move material metadata between browsers with JSON export/import.

**Live demo:** Add your GitHub Pages URL here after publishing.

## Features

- Add, edit, and delete material records.
- Organize materials by category, resolution, tags, and notes.
- Track Base Color, Roughness, Normal, and Height/Displacement maps.
- Preview JPG, PNG, and WebP images (up to 3 MB per preview).
- Search by material name, category, tags, and notes.
- Filter by category and PBR completeness.
- View library totals, complete sets, missing maps, and a completeness score.
- Export and import material metadata as JSON.
- Responsive layout for desktop, tablet, and mobile.

## Run locally

No build tools, package manager, API key, or backend are required.

1. Download or clone this repository.
2. Open `index.html` in a modern browser.
3. Add a material to get started.

For a local web server, run this from the project directory:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish with GitHub Pages

1. Create a public repository named `material-vault` on GitHub.
2. Upload the contents of this project folder to the repository root. Keep `index.html`, `style.css`, and `app.js` at the root level.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)` folder, then save.
6. Wait for the Pages deployment to finish. Copy the published URL into the Live demo line above.

## Data and privacy

Material records and preview image blobs are stored in the browser's IndexedDB database on the device where the app is used. Nothing is uploaded to a server. Clearing site data or changing browsers/devices can remove access to that local data, so export the JSON library periodically. JSON export includes metadata and map flags, but not preview image files.

## Current limitations

- The app tracks whether a map exists; it does not inspect or validate the actual texture file.
- Preview images are stored locally and are not included in JSON export/import.
- It does not generate, convert, or edit PBR maps.
- Renderer-specific settings, colour space, bit depth, and real-world texture scale are not validated.

## Suggested next improvements

- Add drag-and-drop texture folder import.
- Add per-map file attachments and a downloadable material package.
- Add renderer presets for 3ds Max with V-Ray and Corona.
- Add optional local backup/restore of preview images.

## Tech stack

HTML, CSS, and vanilla JavaScript. IndexedDB is used for local material records and image blobs.

## License

MIT. See [LICENSE](LICENSE).
