# GutCore GitHub Pages Draft

This folder contains a static GitHub Pages project page for GutCore.
The layout follows the familiar Nerfies-style academic project-page format and keeps
template attribution in the footer.

The page includes a static case-level explorer. It currently supports cancer
detection and EGC-vs-AGC classification. Each task includes two positive-label
cases and two negative-label cases, and lets visitors click or drag frames into
the model box.

The explorer also includes an attention-analysis panel. For each selected case,
it shows the model-exported top-5 ABMIL image scores and corresponding spatial
attention heatmaps used in the qualitative case-review analysis.

## Local preview

Open `index.html` directly in a browser, or run:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## GitHub Pages deployment

For a private test under a personal GitHub account:

1. Create a new private GitHub repository, for example `gutcore-project-page`.
2. Copy the contents of this `github_pages/` folder to that repository root.
3. Commit and push to the `main` branch.
4. In GitHub, open `Settings -> Pages`.
5. Choose `Deploy from a branch`, then select `main` and `/root`.
6. If the repository is private, confirm that your GitHub plan supports Pages for private repositories.

If GitHub Pages is not available for the private repository under the account plan,
keep the repository private and preview locally until the public release is ready.

## Release notes to update later

- Replace the preprint status after medRxiv posts the manuscript.
- Add the final medRxiv DOI.
- Add the public repository URL when the code and model resources are ready.
- Confirm whether the de-identified case-explorer images can remain on the public
  project page before making the repository public.

## Template attribution

This page is adapted from the Nerfies project page style:
https://nerfies.github.io/

Keep the footer attribution unless the design is substantially rewritten.
