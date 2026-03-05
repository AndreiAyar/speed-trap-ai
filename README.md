# Speed Trap AI MVP

Speed Trap AI is an entertainment-first project that estimates vehicle speed from video using a **two-line gate**.

## What this project does

- Detects and tracks vehicles with YOLO + ByteTrack.
- Measures estimated speed when a tracked vehicle crosses line A and then line B.
- Blurs vehicle regions by default for safer publishing.
- Produces an overlay video, CSV summary, JSONL events, and a dashboard leaderboard.

## Important disclaimer

This is **not** a legal speed enforcement system. The output is an AI estimate made for education and entertainment.

## Monorepo layout

- `apps/api`: Node.js API for jobs and leaderboard data.
- `apps/dashboard`: React dashboard for upload, job status, and results.
- `engine/python`: Python engine for detection, tracking, and speed gate logic.
- `docs`: Romanian beginner-friendly explanation docs.
- `data/input`: Place source videos here.
- `data/output`: Generated artifacts per job.

## Prerequisites

- Node.js 22+
- pnpm 9+
- Python 3.11+
- FFmpeg installed and available in `PATH`

## Quick start

1. Install Node dependencies:

```bash
pnpm install
```

2. Create Python virtual environment and install engine dependencies:

```bash
cd engine/python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Run API and dashboard:

```bash
cd .
pnpm dev
```

4. Run an offline analysis job:

```bash
./scripts/run-offline.sh data/input/sample.mp4
```

## Default speed method

The engine uses a **two-line gate**:

- We define `line_a` and `line_b` in frame coordinates.
- We set real `distance_meters` between the two lines.
- For each tracked vehicle, speed is `distance / (t2 - t1) * 3.6`.

## Where to configure your scene

Edit camera config file:

- `engine/python/configs/camera.default.yaml`

You should update line coordinates and `distance_meters` per filming location.
