#!/usr/bin/env bash

# We stop on first failing command to avoid partial outputs.
set -euo pipefail

# We compute script directory for stable relative path handling.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# We compute workspace root from script location.
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# We read first argument as input video path.
INPUT_PATH="${1:-}"

# We enforce required input argument.
if [[ -z "$INPUT_PATH" ]]; then
  echo "Usage: ./scripts/run-offline.sh /absolute/or/relative/path/to/video.mp4"
  exit 1
fi

# We normalize input path to absolute path.
if [[ "$INPUT_PATH" = /* ]]; then
  INPUT_ABS="$INPUT_PATH"
else
  INPUT_ABS="$WORKSPACE_ROOT/$INPUT_PATH"
fi

# We build timestamp-based job folder name for easy history tracking.
JOB_ID="manual_$(date +%Y%m%d_%H%M%S)"

# We build output folder path for this run.
OUT_DIR="$WORKSPACE_ROOT/data/output/$JOB_ID"

# We ensure output folder exists.
mkdir -p "$OUT_DIR"

# We choose python executable (venv first, fallback to python3).
if [[ -x "$WORKSPACE_ROOT/engine/python/.venv/bin/python" ]]; then
  PYTHON_BIN="$WORKSPACE_ROOT/engine/python/.venv/bin/python"
else
  PYTHON_BIN="python3"
fi

# We run engine pipeline with default camera config.
"$PYTHON_BIN" "$WORKSPACE_ROOT/engine/python/run_pipeline.py" \
  --input "$INPUT_ABS" \
  --config "$WORKSPACE_ROOT/engine/python/configs/camera.default.yaml" \
  --out "$OUT_DIR"

# We print final output location for quick access.
echo "Job finished. Artifacts in: $OUT_DIR"
