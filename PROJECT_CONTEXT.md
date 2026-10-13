# CASA0014 Urban Tech Observatory — Project Context & State

## Origin & Pedagogical Goals
- **Course**: CASA0014: Connected Environments (MSc at UCL CASA).
- **Instructor**: Duncan Wilson.
- **Goal**: Replace an existing PowerPoint slide assignment where students observe an urban sensor in London (photo + metadata: lat/long, what3words, address, Google Maps link, title, "what is being sensed", and "questions raised").
- **Solution**: A collaborative web platform where students submit via an online form, individual sensor dossier pages are automatically generated, and an interactive landing map displays all student observations.

## Architectural Decision
- **Repo**: Standalone repository at `ucl-casa-ce/casa0014-urbantech` (decoupled from `casa0014` to prevent image asset bloat and keep GitHub Issues clean).
- **Intake Pipeline (Option A)**:
  - Form at `submit.html` (or `.github/ISSUE_TEMPLATE/sensor_submission.yml`) creates a GitHub Issue labeled `sensor-submission`.
  - GitHub Action (`.github/workflows/process-submission.yml`) parses the issue, saves the attached photo to `assets/images/`, updates `data/sensors.json`, commits to `main`, and closes the issue with a link to the published sensor.
  - Hosted directly on GitHub Pages (`https://ucl-casa-ce.github.io/casa0014-urbantech/`).

## Initial Dataset
- Seeded with Duncan Wilson's Marylebone Road Air Quality Station (from original slide) + Queen Elizabeth Olympic Park walkshop sensor sites.

## Immediate Next Steps
1. Enable GitHub Pages in repository settings (`Settings` -> `Pages` -> branch: `main`, folder: `/`).
2. Grant GitHub Actions write permissions (`Settings` -> `Actions` -> `General` -> `Read and write permissions`).
3. Run local preview with `npx serve .` or `python3 -m http.server 8000`.
4. Test the submission flow with a mock sensor.
