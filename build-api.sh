#!/bin/sh
set -e
npx esbuild server.ts --bundle --platform=node --format=esm --target=node20 --outfile=api/_lib/server.mjs --external:pg-native --external:vite --external:@google/genai --log-level=warning --banner:js="import { createRequire as __cr } from 'module'; import { fileURLToPath as __fu } from 'url'; import __p from 'path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __p.dirname(__filename);"
