# CASA0014 Sensor Intake Cloudflare Worker

A serverless Cloudflare Worker that enables **direct, seamless in-form submissions** for the CASA0014 Urban Tech Observatory.

Students upload photos and observation data directly on `submit.html` without needing GitHub accounts or touching the GitHub issue tracker.

---

## Architecture

1. Student fills form on `submit.html` and drops a field photo.
2. Form sends a `POST` request to this Cloudflare Worker with JSON + Base64 JPEG.
3. The Worker:
   - Commits the photo to `assets/images/<sensor-slug>.jpg` via GitHub REST API.
   - Reads `data/sensors.json`, prepends the new sensor entry, and commits the update to `main`.
4. Returns the live URL to `submit.html` which immediately presents a success screen to the student.

---

## Setup in Cloudflare Dashboard (5 Minutes)

### 1. Create the Worker
1. In the Cloudflare Dashboard, go to **Workers & Pages** -> **Create an app**.
2. Under "Make something new", click **"Start with Hello World!"**.
3. Name your worker (e.g. `casa0014-sensor-intake`) and click **Deploy**.
4. Click **Edit code**.
5. Replace the contents of `worker.js` with the code in `cloudflare-worker/worker.js`.
6. Click **Save and deploy**.

### 2. Configure Environment Variables & Secrets
In your worker's settings in Cloudflare Dashboard:
1. Go to **Settings** -> **Variables and Secrets**.
2. Under **Variables**, add:
   - `REPO_OWNER` = `ucl-casa-ce`
   - `REPO_NAME` = `casa0014-urbantech`
3. Under **Secrets**, click **Add** and create:
   - `GITHUB_TOKEN`: A GitHub Personal Access Token (PAT).

#### How to create the GitHub Token:
1. Go to GitHub -> **Settings** (your user settings) -> **Developer Settings** -> **Personal Access Tokens**.
2. Select **Fine-grained tokens** -> **Generate new token**.
3. Name it: `CASA0014 Cloudflare Intake`.
4. Resource owner: `ucl-casa-ce`.
5. Repository access: **Only select repositories** -> `ucl-casa-ce/casa0014-urbantech`.
6. Permissions:
   - **Repository permissions** -> **Contents**: Read and write.
7. Click **Generate token** and copy the value into the Cloudflare `GITHUB_TOKEN` secret.

### 3. Copy Your Worker URL
Copy your public worker URL (e.g. `https://casa0014-sensor-intake.<your-subdomain>.workers.dev`).
Paste it into `js/submit.js` under `WORKER_ENDPOINT`.
