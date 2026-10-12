#!/bin/bash
set -e

npm install --no-fund --no-audit
node scripts/setup-name-requests.mjs --development
