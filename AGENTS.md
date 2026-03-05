# AGENTS.md - Speed Trap AI Project Notes

## Purpose

This project is an entertainment demo that estimates traffic speed from video.
It is not a legal enforcement system.

## Architecture quick map

- `engine/python`: detection + tracking + two-line speed gate + overlay output
- `apps/api`: Node API that runs jobs and exposes leaderboard data
- `apps/dashboard`: React UI for upload, status, and speed ranking

## Core method (must stay clear in UI/docs)

1. Vehicle crosses Linia A at `t1`
2. Vehicle crosses Linia B at `t2`
3. `speed_kmh = distance_meters / (t2 - t1) * 3.6`

## Defaults

- model primary: `yolo26n.pt`
- model fallback: `yolo11n.pt`
- tracker: `ByteTrack`
- privacy blur: enabled by default

## Safety language

Always keep disclaimer visible in output and UI:

`Doar pentru divertisment. Nu este masurare legala.`

## Commenting style

Code in this repo should stay heavily commented and beginner-friendly.
