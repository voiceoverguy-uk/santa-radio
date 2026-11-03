#!/bin/bash
set -e

pnpm install --frozen-lockfile
node scripts/setup-name-requests.mjs --development
node scripts/setup-studio-generation.mjs --development
node scripts/setup-workshop-usage.mjs --development
node scripts/setup-santa-mobile.mjs --development
