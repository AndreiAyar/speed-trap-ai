#!/usr/bin/env bash

# We stop on first failure for safer startup behavior.
set -euo pipefail

# We compute script directory for stable root resolution.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# We compute workspace root from script directory.
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# We move to workspace root before running pnpm scripts.
cd "$WORKSPACE_ROOT"

# We launch API and dashboard in parallel using workspace script.
pnpm dev
