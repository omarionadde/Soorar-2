#!/usr/bin/env python3
"""
Deploy the SOORAR app to Vercel production straight from this folder (no GitHub).

Usage:   python3 deploy.py            # build API bundle + deploy production
         python3 deploy.py --no-build # skip the local esbuild step

Auth: the Vercel token is injected on the wire for api.vercel.com in the Hark
sandbox; elsewhere set VERCEL_TOKEN in the environment.
Never prints secrets.
"""
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT_ID = "prj_JsCmKI3c9otYSXbnzHJs3naVfuWI"
API = "https://api.vercel.com"
SKIP_DIRS = {"node_modules", "dist", ".vercel", ".git", ".preview", "doc-previews"}
SKIP_FILES = {".env", ".env.local", "deploy.py", ".backup_token"}


def req(method, path, body=None, headers=None, raw=None):
    h = {"Content-Type": "application/json"}
    tok = os.environ.get("VERCEL_TOKEN")
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    h.update(headers or {})
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r = urllib.request.Request(API + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            txt = resp.read().decode()
            return resp.status, (json.loads(txt) if txt else {})
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, {"raw": txt[:500]}


def collect():
    files = []
    for base, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for n in names:
            if n in SKIP_FILES:
                continue
            full = os.path.join(base, n)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            files.append((rel, full))
    return files


def main():
    if "--no-build" not in sys.argv:
        print("Building API bundle (esbuild)…")
        subprocess.run(["sh", "build-api.sh"], cwd=ROOT, check=True)

    files = collect()
    print(f"Uploading {len(files)} files…")
    manifest = []
    for rel, full in files:
        data = open(full, "rb").read()
        sha = hashlib.sha1(data).hexdigest()
        st, res = req("POST", "/v2/files", raw=data, headers={
            "Content-Type": "application/octet-stream",
            "x-vercel-digest": sha,
            "Content-Length": str(len(data)),
        })
        if st not in (200, 201):
            print("Upload failed", rel, st, res)
            sys.exit(1)
        manifest.append({"file": rel, "sha": sha, "size": len(data)})

    body = {
        "name": "soorar",
        "project": PROJECT_ID,
        "target": "production",
        "files": manifest,
        "projectSettings": {
            "framework": "vite",
            "buildCommand": "vite build",
            "outputDirectory": "dist",
            "installCommand": "npm install",
        },
    }
    st, dep = req("POST", "/v13/deployments?skipAutoDetectionConfirmation=1", body)
    if st not in (200, 201):
        print("Deployment create failed", st, json.dumps(dep)[:800])
        sys.exit(1)
    dep_id = dep["id"]
    print("Deployment", dep_id, dep.get("url"))

    for _ in range(120):
        time.sleep(5)
        st, d = req("GET", f"/v13/deployments/{dep_id}")
        state = d.get("readyState") or d.get("status")
        print("  state:", state)
        if state == "READY":
            print("READY. Aliases:", d.get("alias"))
            break
        if state in ("ERROR", "CANCELED"):
            st, ev = req("GET", f"/v2/deployments/{dep_id}/events?limit=200")
            items = ev if isinstance(ev, list) else ev.get("events", [])
            for e in items[-60:]:
                txt = (e.get("payload") or {}).get("text") or e.get("text") or ""
                if txt:
                    print("   |", txt[:300])
            sys.exit(2)
    else:
        print("Timed out waiting for deployment")
        sys.exit(3)

    with open(os.path.join(ROOT, ".vercel", "last-deploy.json"), "w") as f:
        json.dump({"id": dep_id, "url": d.get("url"), "alias": d.get("alias"), "at": time.strftime("%Y-%m-%d %H:%M:%S")}, f, indent=2)


if __name__ == "__main__":
    main()
