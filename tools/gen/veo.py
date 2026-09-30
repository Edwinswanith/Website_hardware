"""Veo image-to-video with a first and a last frame.

Usage: python3 veo.py <out.mp4> <prompt-file> <first.jpg> <last.jpg> [model]

Reads no API key: authentication is injected by the environment's proxy. Never add a key here.
Submits one predictLongRunning job, polls it, downloads the single result. One call = one paid clip.
"""
import base64, json, sys, time, urllib.request

API = "https://generativelanguage.googleapis.com/v1beta"
out, prompt_file, first, last = sys.argv[1:5]
model = sys.argv[5] if len(sys.argv) > 5 else "veo-3.1-generate-preview"

def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def call(url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers={"Content-Type": "application/json"}, method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

body = {
    "instances": [{
        "prompt": open(prompt_file).read().strip(),
        "image": {"bytesBase64Encoded": b64(first), "mimeType": "image/jpeg"},
        "lastFrame": {"bytesBase64Encoded": b64(last), "mimeType": "image/jpeg"},
    }],
    "parameters": {
        "aspectRatio": "16:9",
        "resolution": "1080p",
        "durationSeconds": 8,
        "negativePrompt": "text, letters, numbers, logos, watermark, people, human hands, screens, holograms, neon, blue glow, camera cut, morphing objects",
    },
}
try:
    op = call(f"{API}/models/{model}:predictLongRunning", body)
except urllib.error.HTTPError as e:
    print("submit failed:", e.code, e.read().decode()[:600]); sys.exit(1)
name = op["name"]
print("submitted", name, flush=True)

t0 = time.time()
while not op.get("done"):
    if time.time() - t0 > 900:
        print("still running after 15 min; operation", name); sys.exit(2)
    time.sleep(10)
    op = call(f"{API}/{name}")
    print(f"  {int(time.time() - t0)}s", flush=True)

if "error" in op:
    print("failed:", json.dumps(op["error"])[:600]); sys.exit(1)
resp = op.get("response", {}).get("generateVideoResponse", {})
samples = resp.get("generatedSamples") or []
if not samples:
    print("no video returned:", json.dumps(resp)[:600]); sys.exit(1)
uri = samples[0]["video"]["uri"]
with urllib.request.urlopen(urllib.request.Request(uri), timeout=300) as r, open(out, "wb") as f:
    f.write(r.read())
print("saved", out, f"{int(time.time() - t0)}s")
