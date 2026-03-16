# Speed Trap AI

Speed Trap AI is an entertainment demo that estimates vehicle speed from recorded road video.

It detects vehicles, tracks them across frames, measures the time needed to travel between two virtual lines, renders an annotated overlay video, and shows results in a local dashboard.

> Doar pentru divertisment. Nu este masurare legala.

This project is for demos, storytelling, and educational explainers. It is not a police radar, not a certified measuring tool, and not legal proof of speed.

## What It Does

- Processes recorded video files offline
- Detects vehicles with `yolo26n.pt`
- Falls back to `yolo11n.pt` if needed
- Tracks vehicles with `ByteTrack`
- Uses a configurable two-line speed gate: `Linia A` -> `Linia B`
- Restricts analysis to an optional `roi_polygon`
- Blurs vehicles by default for safer sharing
- Exports overlay video, CSV, JSONL, and metadata artifacts
- Stores job history and leaderboard data in SQLite
- Provides a React dashboard for upload, status, preview, and calibration

## How Speed Is Estimated

The core method stays intentionally simple and easy to explain:

1. A vehicle crosses `Linia A` at `t1`
2. The same tracked vehicle crosses `Linia B` at `t2`
3. Speed is estimated with:

```text
speed_kmh = distance_meters / (t2 - t1) * 3.6
```

Important notes:

- `distance_meters` is the real-world distance between the two virtual lines
- crossing time comes from the tracked vehicle anchor point
- only valid A -> B crossings in the expected direction produce a final speed
- results can be wrong if calibration, tracking, or camera stability are poor

## Why A Vehicle May Have No Final Speed

A vehicle can appear in the video and still not receive a speed if:

- it never crosses both lines in the valid order
- it moves in the opposite configured direction
- it stays outside the ROI
- the tracker loses the object and assigns a new ID
- the anchor point never truly crosses the line even if the box looks close

## Architecture

- `engine/python`
  Python pipeline for detection, tracking, two-line speed gating, privacy blur, and overlay export
- `apps/api`
  Node/Express API that runs jobs and exposes history, job status, and leaderboard data
- `apps/dashboard`
  React dashboard for upload, preview, calibration, and result browsing
- `docs`
  Supporting Romanian docs and presentation notes

## Defaults

- Primary model: `yolo26n.pt`
- Fallback model: `yolo11n.pt`
- Tracker: `ByteTrack`
- Privacy blur: enabled by default
- Anchor point: `bottom_center`

Main scene config:

- `engine/python/configs/camera.default.yaml`

Important config fields:

- `line_a`
- `line_b`
- `distance_meters`
- `roi_polygon`
- `direction`
- `anchor_point`
- `privacy_blur`
- `trail_enabled`

## Prerequisites

- Node.js `22+`
- `pnpm` `9+`
- Python `3.11+`
- `ffmpeg` available in `PATH`

## Setup

### 1. Install JavaScript dependencies

```bash
pnpm install
```

### 2. Create the Python environment

```bash
cd engine/python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run The App

### Start API + dashboard

From the project root:

```bash
./scripts/run-api-dashboard.sh
```

This starts:

- API on `http://localhost:8787`
- dashboard dev server through Vite

### Run one offline job from terminal

```bash
./scripts/run-offline.sh data/input/sample.mp4
```

The script creates a timestamped job folder in `data/output/` and runs the Python pipeline with the default camera config.

You can also create jobs from the dashboard UI.

## Typical Workflow

1. Put a video in `data/input/`
2. Start the API and dashboard
3. Open the dashboard in your browser
4. Run a job or select an older one
5. Review the overlay, leaderboard, and per-vehicle details
6. Use the calibration tool to adjust lines or ROI
7. Re-run the job after calibration updates

## Dashboard Features

- Recent job history backed by SQLite
- Processing status for each job
- Overlay video preview
- Valid-speed leaderboard
- Per-vehicle detail panel
- Calibration helper for line points and ROI polygon
- YAML snippet generation for easy config updates

## Output Files

Each job writes artifacts to:

```text
data/output/<jobId>/
```

Typical files include:

- `overlay.mp4`
- `summary.csv`
- `events.jsonl`
- `metadata.json`

SQLite index file:

- `data/speed-trap.sqlite`

## Accuracy Notes

This demo works best when:

- the camera is fixed
- the road perspective is stable
- the two lines are placed carefully
- `distance_meters` is measured correctly
- ROI matches the intended carriageway
- vehicle movement direction matches the configured direction

This demo works badly when:

- the camera shakes or pans
- the scene changes during recording
- vehicles are heavily occluded
- IDs switch often during tracking
- distance calibration is guessed instead of measured

## Current Stack

- Frontend: React + Vite + TypeScript
- API: Node.js + Express + SQLite
- Engine: Python + OpenCV + Ultralytics YOLO + ByteTrack

## Useful Docs

- `docs/ghid-viteza-ai-ro.md`
- `docs/video-production-playbook-ro.md`

## Current MVP Limits

- offline-first
- one scene configuration at a time
- two-line gate estimation, not homography-based speed measurement
- optimized for explainability and fast iteration

Not implemented yet:

- true live phone ingest
- homography-based continuous speed estimation
- per-lane calibration
- per-vehicle snapshot export
- legal-grade validation
