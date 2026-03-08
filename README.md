# Speed Trap AI MVP

Speed Trap AI is an entertainment-first traffic analysis app for offline video processing.

It takes a recorded road video, detects and tracks vehicles, estimates speed with a two-line A -> B gate, renders an overlay video, and shows the results in a dashboard.

This project is built for demos, storytelling, and educational content. It is **not** a legal enforcement system.

## What The App Does

The app currently does all of this:

- Runs on a recorded video file from your computer.
- Detects vehicles with `YOLO26n`.
- Tracks each vehicle with `ByteTrack`.
- Uses a configurable `line_a` and `line_b` speed gate.
- Measures estimated km/h only when a tracked vehicle crosses A and then B in the expected direction.
- Restricts detection logic to an optional `roi_polygon`.
- Draws an overlay video with:
  - bounding boxes
  - track IDs
  - speed/status labels
  - A/B lines
  - ROI outline
  - movement trails
  - anchor point dot
- Blurs vehicles by default for safer publishing.
- Writes job results to disk and indexes them in SQLite.
- Shows a React dashboard with:
  - recent jobs
  - processing status
  - overlay preview
  - valid speed leaderboard
  - per-vehicle details
  - calibration helper for lines and ROI

## Important Disclaimer

This app gives an **AI estimate** for entertainment and explanation.

It is **not**:

- a police radar
- a certified measurement tool
- legal proof of speed

If the camera moves, calibration is wrong, tracking breaks, or lines are placed badly, the reading can be wrong.

## How The Speed Estimate Works

The current method is intentionally simple:

1. Define `line_a` and `line_b` in video pixel coordinates.
2. Define the real `distance_meters` between those two lines.
3. Track a vehicle over time.
4. Use the vehicle anchor point, currently `bottom_center` of the bounding box.
5. Save `t1` when that anchor crosses line A.
6. Save `t2` when the same tracked vehicle crosses line B.
7. Compute:

```text
speed_mps = distance_meters / (t2 - t1)
speed_kmh = speed_mps * 3.6
```

Only vehicles with a valid final speed are shown in the leaderboard.

## Why Some Vehicles Do Not Receive A Speed

A vehicle may appear on screen and still get no final km/h if:

- it never crosses line A and line B in a valid order
- it is outside the ROI
- it is moving in the opposite configured direction
- the tracker changes its ID mid-run
- the anchor point does not actually cross the line even if the box seems to

That is why the overlay uses status labels like:

- `Estimare AI: XX km/h`
- `asteapta linia A`
- `asteapta linia B`
- `in afara ROI`
- `sens opus`
- `fara crossing valid`

## Current Dashboard Features

The dashboard is built to make calibration and presentation easier.

### Main result view

- Shows recent jobs from SQLite-backed history.
- Survives refresh and restores the last selected job.
- Displays only tracks with valid final speed in `Top viteze detectate`.
- Clicking a leaderboard row:
  - selects that vehicle
  - loads its details
  - jumps the overlay video to the most relevant moment for that car

### Calibration tool

The calibration tool is below the main dashboard and supports:

- local video path input, for example:

```text
/Users/ayar/Personal Dev/speed-trap-ai/data/input/sample.mp4
```

- manual `Load Video`
- paused-by-default preview
- live cursor `x/y`
- click-to-place points
- manual coordinate editing
- collapsible `Line points` section
- collapsible `ROI polygon` section
- optional ROI overlay toggle
- YAML snippet generation for easy copy into config

## Project Structure

- `apps/api`
  - Node.js API for job creation, job history, leaderboard data, and local preview serving
- `apps/dashboard`
  - React/Vite dashboard for upload, preview, calibration, and results
- `engine/python`
  - Python detection/tracking/speed engine
- `engine/python/configs/camera.default.yaml`
  - main scene config for lines, ROI, direction, blur, trails, and distance
- `data/input`
  - input videos
- `data/output`
  - generated job artifacts
- `data/speed-trap.sqlite`
  - local app/job index database
- `docs`
  - Romanian simple explanation docs and production notes

## What Gets Saved Where

### SQLite

SQLite is used as the app index.

It stores:

- jobs
- status/progress
- artifact paths
- per-track summary rows

This is what makes the dashboard history survive refresh.

### JSON / CSV / Video

Each job writes artifacts to `data/output/<jobId>/`.

Typical files:

- `overlay.mp4`
- `summary.csv`
- `events.jsonl`
- `metadata.json`

These files are the detailed outputs of one run.

## Prerequisites

- Node.js `22+`
- `pnpm` `9+`
- Python `3.11+`
- `ffmpeg` in `PATH`

## Setup

### 1. Install Node dependencies

```bash
pnpm install
```

### 2. Create Python environment

```bash
cd engine/python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Start API and dashboard

From the project root:

```bash
./scripts/run-api-dashboard.sh
```

This starts:

- API on `http://localhost:8787`
- dashboard dev server

### 4. Run an offline job from terminal

```bash
./scripts/run-offline.sh data/input/sample.mp4
```

You can also create jobs from the dashboard UI.

## Typical Workflow

1. Put a video into `data/input/`.
2. Open the dashboard.
3. Start a job or pick an existing one.
4. Wait for processing to finish.
5. Open the calibration tool if you need to refine lines or ROI.
6. Re-run the job after calibration changes.
7. Review:
  - overlay video
  - valid-speed leaderboard
  - individual vehicle details

## Scene Configuration

Main config file:

- [camera.default.yaml](/Users/ayar/Personal%20Dev/speed-trap-ai/engine/python/configs/camera.default.yaml)

Important fields:

- `line_a`
- `line_b`
- `distance_meters`
- `roi_polygon`
- `direction`
- `anchor_point`
- `privacy_blur`
- `trail_enabled`
- `show_anchor_point`

## Notes About Accuracy

This setup works best when:

- the camera is fixed
- the road perspective is stable
- A/B lines are placed carefully
- `distance_meters` is measured correctly
- ROI matches the target carriageway
- direction matches the flow you want to measure

This setup works badly when:

- the camera shakes or pans
- the scene changes during recording
- vehicles are heavily occluded
- the tracker keeps switching IDs
- the distance calibration is guessed badly

## Current Stack

- Frontend: React + Vite + TypeScript
- API: Node.js + Express + SQLite
- Engine: Python + OpenCV + Ultralytics YOLO + ByteTrack

## Useful Docs In This Repo

- [docs/ghid-viteza-ai-ro.md](/Users/ayar/Personal%20Dev/speed-trap-ai/docs/ghid-viteza-ai-ro.md)
- [docs/video-production-playbook-ro.md](/Users/ayar/Personal%20Dev/speed-trap-ai/docs/video-production-playbook-ro.md)

## Current MVP Limits

This MVP is currently:

- offline-first
- based on one scene config at a time
- using a two-line gate, not homography calibration
- optimized for easy explanation and iteration

Not implemented yet:

- true live phone ingest pipeline
- homography-based continuous speed estimation
- per-lane calibration
- snapshot export per vehicle
- legal-grade validation
