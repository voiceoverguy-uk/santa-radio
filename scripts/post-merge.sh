#!/bin/bash
set -e

npm install --no-fund --no-audit
node scripts/setup-name-requests.mjs --development
node scripts/setup-studio-generation.mjs --development
