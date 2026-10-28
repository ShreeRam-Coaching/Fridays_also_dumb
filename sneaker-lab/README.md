# Delhi Clinic — Scroll Scene

A static clinic website built around a custom WebGL medical sculpture. The 3D scene uses a procedural heart surface, curved vessel geometry, lit materials, and a perspective camera whose position and object transforms follow the visitor's scroll position through four scenes.

## Run locally

Open `index.html` in a browser, or run `python -m http.server 8000` from this folder and visit `http://localhost:8000`. No package install or build step is required.

## Experience and fallbacks

`scene3d.js` creates the WebGL geometry, shaders, lights, camera, and scroll-controlled scene state. `app.js` connects page scroll to the scene and handles navigation. Low-power devices, mobile screens, reduced-motion settings, or unavailable WebGL use the clinic-photo fallback while preserving the four-part story. Clinic photographs and logo are local in `assets/`; fonts load from Google Fonts.

## Verified clinic details

Services, phone/WhatsApp contact, address, hours, and directions were taken from the supplied clinic project archive. Do not add unverified staff credentials, services, reviews, or medical claims.
