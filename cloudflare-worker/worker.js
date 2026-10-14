/**
 * CASA0014 Urban Tech Observatory — Submission Intake Worker
 * Cloudflare Worker that commits student observations & photos directly to GitHub.
 *
 * Environment Secrets / Variables required:
 * - GITHUB_TOKEN (Secret): GitHub Personal Access Token (Fine-grained or Classic) with 'Contents: Read and write'
 * - REPO_OWNER (Variable): "ucl-casa-ce" (defaults to ucl-casa-ce if omitted)
 * - REPO_NAME (Variable): "casa0014-urbantech" (defaults to casa0014-urbantech if omitted)
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Content-Type": "application/json",
    };

    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST." }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const payload = await request.json();
      const {
        title,
        category,
        categorySlug,
        description,
        parameters,
        questions,
        location,
        contributor,
        imageData
      } = payload;

      if (!title || !description || !location || isNaN(parseFloat(location.lat)) || isNaN(parseFloat(location.lng))) {
        return new Response(JSON.stringify({ error: "Missing required fields (title, description, valid lat/lng)." }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const owner = env.REPO_OWNER || "ucl-casa-ce";
      const repo = env.REPO_NAME || "casa0014-urbantech";
      const token = env.GITHUB_TOKEN;

      if (!token) {
        return new Response(JSON.stringify({
          error: "GITHUB_TOKEN secret is not configured in Cloudflare Worker settings."
        }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      const ghHeaders = {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "CASA0014-Observatory-Worker",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      };

      // 2. Generate slug ID from title
      const slug = title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || `sensor-${Date.now()}`;

      // 3. Commit Image if provided
      let imageRelativePath = "assets/images/marylebone-station.png"; // Fallback default

      if (imageData && typeof imageData === "string" && imageData.includes("base64,")) {
        const parts = imageData.split("base64,");
        const mimeMatch = parts[0].match(/:(image\/[a-zA-Z0-9.+]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const rawBase64 = parts[1].replace(/\s/g, '');

        let ext = ".jpg";
        if (mimeType.includes("png")) ext = ".png";
        else if (mimeType.includes("webp")) ext = ".webp";

        imageRelativePath = `assets/images/${slug}${ext}`;

        // Check if image already exists to get sha if updating
        let existingImgSha = null;
        try {
          const checkImgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${imageRelativePath}?ref=main`, {
            headers: ghHeaders
          });
          if (checkImgRes.ok) {
            const checkData = await checkImgRes.json();
            existingImgSha = checkData.sha;
          }
        } catch (_) {}

        const imgCommitPayload = {
          message: `feat(observatory): upload sensor image '${title}'`,
          content: rawBase64,
          branch: "main",
        };
        if (existingImgSha) {
          imgCommitPayload.sha = existingImgSha;
        }

        const imgRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${imageRelativePath}`, {
          method: "PUT",
          headers: ghHeaders,
          body: JSON.stringify(imgCommitPayload)
        });

        if (!imgRes.ok) {
          console.warn("Image upload failed, falling back to default:", await imgRes.text());
          imageRelativePath = "assets/images/marylebone-station.png";
        }
      }

      // 4. Construct Sensor Record
      const newSensor = {
        id: slug,
        title,
        category: category || "Urban Sensor",
        categorySlug: categorySlug || "infrastructure",
        description,
        parameters: Array.isArray(parameters) ? parameters : [],
        questions: Array.isArray(questions) ? questions : [],
        location: {
          address: location.address || "",
          lat: parseFloat(location.lat),
          lng: parseFloat(location.lng),
          googleMapsUrl: location.googleMapsUrl || `https://maps.google.com/?q=${location.lat},${location.lng}`,
          what3words: location.what3words || "",
          area: location.area || (location.address ? location.address.split(',')[0].trim() : "London")
        },
        contributor: {
          name: contributor?.name || "CASA Student",
          affiliation: contributor?.affiliation || "UCL CASA Connected Environments",
          date: contributor?.date || new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
          cohort: contributor?.cohort || "2024/25"
        },
        image: imageRelativePath
      };

      // 5. Update data/sensors.json with conflict retry logic
      let success = false;
      let attempts = 0;
      let lastError = null;

      while (!success && attempts < 3) {
        attempts++;
        const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/data/sensors.json?ref=main`, {
          headers: ghHeaders
        });

        if (!getRes.ok) {
          lastError = `Failed to read data/sensors.json: ${await getRes.text()}`;
          break;
        }

        const getData = await getRes.json();
        const currentJsonStr = base64ToUtf8(getData.content);
        let sensors = [];
        try {
          sensors = JSON.parse(currentJsonStr);
        } catch (parseErr) {
          sensors = [];
        }

        // Prepend new sensor (replacing any with same ID)
        sensors = [newSensor, ...sensors.filter(s => s.id !== slug)];

        const updatedBase64 = utf8ToBase64(JSON.stringify(sensors, null, 2));

        const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/data/sensors.json`, {
          method: "PUT",
          headers: ghHeaders,
          body: JSON.stringify({
            message: `feat(observatory): add sensor observation '${title}' [skip ci]`,
            content: updatedBase64,
            sha: getData.sha,
            branch: "main"
          })
        });

        if (putRes.ok) {
          success = true;
        } else if (putRes.status === 409) {
          // Concurrent commit conflict, wait 500ms and retry
          await new Promise(r => setTimeout(r, 500));
        } else {
          lastError = `Failed to commit sensors.json: ${await putRes.text()}`;
          break;
        }
      }

      if (!success) {
        throw new Error(lastError || "Could not commit sensor observation after 3 attempts.");
      }

      const liveUrl = `https://${owner}.github.io/${repo}/sensor.html?id=${slug}`;

      return new Response(JSON.stringify({
        success: true,
        id: slug,
        title: title,
        url: liveUrl
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

/**
 * UTF-8 safe base64 decoding (supports non-Latin characters, Chinese, emoji)
 */
function base64ToUtf8(base64Str) {
  const clean = base64Str.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * UTF-8 safe base64 encoding (supports non-Latin characters, Chinese, emoji)
 */
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
