# Repository Guidelines

## Project Structure

This is a dependency-free, static Delhi Clinic website. `index.html` contains semantic content, `styles.css` defines the visual and responsive system, `app.js` connects native scrolling and navigation, `scene3d.js` builds the procedural WebGL scene, and `assets/` holds clinic photos and the logo.

## Development

Open `index.html` or run `python -m http.server 8000` from the repository root. No build or package installation is configured. The 3D scene uses browser WebGL APIs directly; keep its image fallback usable when WebGL is unavailable.

## Style and Content

Use two-space indentation in HTML and JavaScript, semantic elements and useful image descriptions, `camelCase` JavaScript names, and descriptive kebab-case CSS classes. Keep responsive rules in the existing media queries and respect `prefers-reduced-motion`. Use only verified clinic details from the supplied project materials; do not invent staff credentials, services, hours, reviews, or medical claims.

## Verification

There are no automated tests or lint commands. Check JavaScript syntax, local asset paths, anchor targets, and local serving after edits. In a browser, check scroll-driven camera changes and reversal, mobile layout, and reduced-motion/WebGL fallbacks.
