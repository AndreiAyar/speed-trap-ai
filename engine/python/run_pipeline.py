"""Offline video pipeline for detection, tracking, two-line speed gate, and overlay export."""

# argparse provides a simple CLI interface.
import argparse

# json is used for serializing progress and final metadata.
import json

# os/pathlib support filesystem operations.
import os
from pathlib import Path
import shutil
import subprocess

# typing clarifies in-memory data structures.
from typing import Dict, List

# cv2 handles video writing and frame drawing.
import cv2

# numpy supports geometry calculations for drawing and center computations.
import numpy as np

# yaml reads camera calibration/configuration.
import yaml

# We import engine modules for pipeline tasks.
from modules.detect_track import iter_tracked_frames, read_video_fps
from modules.exporters import build_artifact_paths, ensure_dir, write_events_jsonl, write_metadata_json, write_summary_csv
from modules.privacy_blur import blur_bbox_region
from modules.speed_gate import TwoLineSpeedGate


# This helper converts bbox to anchor point used for line crossing logic.
def bbox_anchor_point(bbox: List[float], anchor_mode: str = "bottom_center") -> tuple:
    # We unpack coordinates from xyxy format.
    x1, y1, x2, y2 = bbox

    # We compute anchor x as horizontal midpoint.
    cx = (x1 + x2) / 2.0

    # We use bottom-center by default because it follows road contact point.
    if anchor_mode == "bottom_center":
        cy = y2
    # We keep center option for experimentation/debug.
    else:
        cy = (y1 + y2) / 2.0

    # We return center as float tuple.
    return float(cx), float(cy)


# This helper draws speed gate lines and labels on frame.
def draw_speed_gate_overlay(frame, line_a, line_b, disclaimer_text):
    # We convert line points to integer tuples for OpenCV drawing.
    a1, a2 = tuple(map(int, line_a[0])), tuple(map(int, line_a[1]))
    b1, b2 = tuple(map(int, line_b[0])), tuple(map(int, line_b[1]))

    # We draw line A using cyan for high visibility.
    cv2.line(frame, a1, a2, (255, 255, 0), 3)

    # We draw line B using orange for contrast.
    cv2.line(frame, b1, b2, (0, 165, 255), 3)

    # We label line A for audience clarity.
    cv2.putText(frame, "Linia A", (a1[0] + 10, a1[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)

    # We label line B for audience clarity.
    cv2.putText(frame, "Linia B", (b1[0] + 10, b1[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 165, 255), 2)

    # We draw entertainment disclaimer on every frame.
    cv2.putText(frame, disclaimer_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (20, 20, 255), 2)


# This helper draws ROI polygon when configured.
def draw_roi(frame, roi_polygon):
    # We skip drawing if ROI is empty.
    if not roi_polygon:
        return

    # We convert polygon list to OpenCV point array.
    pts = np.array(roi_polygon, dtype=np.int32)

    # We draw the ROI polygon border.
    cv2.polylines(frame, [pts], isClosed=True, color=(80, 255, 80), thickness=2)


# This helper computes and aggregates track-level summary rows.
def build_track_summary(track_samples: Dict[int, Dict]) -> List[Dict]:
    # We accumulate resulting summary rows here.
    rows = []

    # We process each track entry from in-memory aggregation.
    for track_id, sample in track_samples.items():
        # We gather all speed samples that are numeric.
        speeds = [v for v in sample["speed_samples"] if v is not None]

        # We compute max speed when at least one value exists.
        max_speed = max(speeds) if speeds else None

        # We compute average speed when at least one value exists.
        avg_speed = sum(speeds) / len(speeds) if speeds else None

        # We append normalized output row.
        rows.append(
            {
                "trackId": track_id,
                "classId": sample["class_id"],
                "maxSpeedKmh": round(max_speed, 2) if max_speed is not None else None,
                "avgSpeedKmh": round(avg_speed, 2) if avg_speed is not None else None,
                "firstSeenMs": sample["first_seen_ms"],
                "lastSeenMs": sample["last_seen_ms"],
                "crossedAms": sample.get("crossed_a_ms"),
                "crossedBms": sample.get("crossed_b_ms"),
                "numSamples": len(sample["speed_samples"]),
            }
        )

    # We sort rows by max speed descending for leaderboard friendliness.
    rows.sort(key=lambda x: x["maxSpeedKmh"] if x["maxSpeedKmh"] is not None else -1, reverse=True)

    # We return sorted summary rows.
    return rows


# This helper transcodes raw OpenCV MP4 to browser-friendly H.264 output.
def transcode_overlay_for_web(raw_path: str, final_path: str) -> Dict[str, str]:
    # We return early when raw file is missing.
    if not os.path.exists(raw_path):
        return {"status": "missing_raw", "message": "Raw overlay file not found."}

    # We detect ffmpeg availability before trying to transcode.
    ffmpeg_bin = shutil.which("ffmpeg")

    # If ffmpeg is unavailable, we fallback to raw file rename/copy.
    if not ffmpeg_bin:
        # We replace existing final file first to keep output deterministic.
        if os.path.exists(final_path):
            os.remove(final_path)
        # We move raw file to final path.
        os.replace(raw_path, final_path)
        return {"status": "fallback_raw", "message": "ffmpeg not found; raw MP4 kept as final output."}

    # We build ffmpeg command for web-compatible MP4 encoding.
    command = [
        ffmpeg_bin,
        "-y",
        "-i",
        raw_path,
        "-an",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        final_path,
    ]

    # We execute ffmpeg and capture output for debugging metadata.
    result = subprocess.run(command, capture_output=True, text=True)

    # We return success info and cleanup raw file when transcode succeeds.
    if result.returncode == 0 and os.path.exists(final_path):
        if os.path.exists(raw_path):
            os.remove(raw_path)
        return {"status": "transcoded", "message": "Overlay transcoded to H.264 for browser playback."}

    # We fallback to raw file when ffmpeg command failed for any reason.
    if os.path.exists(final_path):
        os.remove(final_path)
    os.replace(raw_path, final_path)
    return {
        "status": "ffmpeg_failed_fallback_raw",
        "message": f"ffmpeg failed; raw MP4 kept. Details: {result.stderr[:400]}",
    }


# Main CLI entrypoint.
def main():
    # We define CLI arguments for input, config, and output location.
    parser = argparse.ArgumentParser(description="Speed Trap AI offline pipeline")
    parser.add_argument("--input", required=True, help="Path to input video file")
    parser.add_argument("--config", required=True, help="Path to YAML camera config")
    parser.add_argument("--out", required=True, help="Output job folder")
    args = parser.parse_args()

    # We make sure output folder exists.
    ensure_dir(args.out)

    # We load scene configuration from YAML.
    with open(args.config, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    # We build all artifact file paths in one place.
    artifact_paths = build_artifact_paths(args.out)

    # We create a temporary raw overlay path before web-friendly transcode.
    raw_overlay_path = os.path.join(args.out, "overlay_raw.mp4")

    # We read input FPS for reliable timestamp mapping.
    fps = read_video_fps(args.input)

    # We initialize two-line speed gate logic.
    gate = TwoLineSpeedGate(
        line_a=cfg["line_a"],
        line_b=cfg["line_b"],
        distance_meters=cfg["distance_meters"],
        direction=cfg.get("direction", [0.0, 1.0]),
        roi_polygon=cfg.get("roi_polygon", []),
        min_crossing_delta_ms=cfg.get("min_crossing_delta_ms", 150),
    )

    # We hold frame-level events for JSONL output.
    events: List[Dict] = []

    # We hold track-level aggregated samples for CSV summary.
    track_samples: Dict[int, Dict] = {}

    # We hold drawing history points per track for trail rendering.
    track_trails: Dict[int, List[tuple]] = {}

    # We prepare video writer lazily once first frame arrives.
    writer = None

    # We define allowed class ids from config.
    allowed_classes = cfg.get("classes", [2, 3, 5, 7])

    # We select anchor point mode used by speed gate crossing.
    anchor_mode = str(cfg.get("anchor_point", "bottom_center"))

    # We read trail drawing configuration from scene config.
    trail_enabled = bool(cfg.get("trail_enabled", True))
    trail_length_frames = int(cfg.get("trail_length_frames", 22))
    trail_thickness = int(cfg.get("trail_thickness", 2))

    # We iterate tracked frames from detector/tracker pipeline.
    for item in iter_tracked_frames(
        source_path=args.input,
        model_primary=cfg.get("model_primary", "yolo26n.pt"),
        model_fallback=cfg.get("model_fallback", "yolo11n.pt"),
        tracker=cfg.get("tracker", "bytetrack.yaml"),
        classes=allowed_classes,
        conf_threshold=float(cfg.get("conf_threshold", 0.25)),
    ):
        # We unpack frame index from iterator payload.
        frame_index = item["frame_index"]

        # We clone frame to avoid accidental shared mutation issues.
        frame = item["frame"].copy()

        # We unpack detections list for this frame.
        detections = item["detections"]

        # We compute timestamp in milliseconds for this frame index.
        timestamp_ms = (frame_index / fps) * 1000.0

        # We initialize video writer once frame dimensions are known.
        if writer is None:
            # We choose MP4 codec for editor-friendly output.
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")

            # We create writer with same frame dimensions and fps as source.
            writer = cv2.VideoWriter(
                raw_overlay_path,
                fourcc,
                fps,
                (frame.shape[1], frame.shape[0]),
            )

        # We draw gate lines and disclaimer first so they stay visible.
        draw_speed_gate_overlay(frame, cfg["line_a"], cfg["line_b"], cfg.get("disclaimer_text", "Estimare AI"))

        # We draw ROI boundary if configured.
        draw_roi(frame, cfg.get("roi_polygon", []))

        # We iterate each detection in current frame.
        for det in detections:
            # We unpack track id.
            track_id = int(det["track_id"])

            # We skip detections without valid tracking id.
            if track_id < 0:
                continue

            # We unpack class id for aggregation.
            class_id = int(det["class_id"])

            # We unpack bbox in xyxy format.
            bbox = det["bbox"]

            # We compute anchor point used by speed gate logic.
            center = bbox_anchor_point(bbox, anchor_mode=anchor_mode)

            # We update gate state and optionally get speed.
            gate_info = gate.update_track(track_id=track_id, center=center, timestamp_ms=timestamp_ms)

            # We update per-track trail points for visual movement history.
            if trail_enabled:
                # We initialize trail list on first point.
                if track_id not in track_trails:
                    track_trails[track_id] = []

                # We append current anchor point as integer pixel pair.
                track_trails[track_id].append((int(center[0]), int(center[1])))

                # We clamp stored points to configured trail length.
                if len(track_trails[track_id]) > trail_length_frames:
                    track_trails[track_id] = track_trails[track_id][-trail_length_frames:]

            # We initialize per-track sample store on first sighting.
            if track_id not in track_samples:
                track_samples[track_id] = {
                    "class_id": class_id,
                    "first_seen_ms": round(timestamp_ms, 2),
                    "last_seen_ms": round(timestamp_ms, 2),
                    "crossed_a_ms": None,
                    "crossed_b_ms": None,
                    "speed_samples": [],
                }

            # We update last seen time every frame where track appears.
            track_samples[track_id]["last_seen_ms"] = round(timestamp_ms, 2)

            # We keep crossing times if they become available.
            if gate_info.get("crossed_a_ms") is not None:
                track_samples[track_id]["crossed_a_ms"] = round(float(gate_info["crossed_a_ms"]), 2)
            if gate_info.get("crossed_b_ms") is not None:
                track_samples[track_id]["crossed_b_ms"] = round(float(gate_info["crossed_b_ms"]), 2)

            # We append speed sample (may be None before full crossing).
            track_samples[track_id]["speed_samples"].append(gate_info.get("speed_kmh"))

            # We apply privacy blur to vehicle region when enabled.
            if bool(cfg.get("privacy_blur", True)):
                frame = blur_bbox_region(frame, bbox)

            # We convert bbox to ints for drawing.
            x1, y1, x2, y2 = [int(v) for v in bbox]

            # We draw bounding box after blur so box remains visible.
            cv2.rectangle(frame, (x1, y1), (x2, y2), (50, 220, 255), 2)

            # We draw movement trail behind current track when enough points exist.
            if trail_enabled and track_id in track_trails and len(track_trails[track_id]) >= 2:
                # We convert trail points into OpenCV polyline array.
                trail_points = np.array(track_trails[track_id], dtype=np.int32)

                # We draw open polyline to show recent trajectory.
                cv2.polylines(
                    frame,
                    [trail_points],
                    isClosed=False,
                    color=(255, 230, 90),
                    thickness=trail_thickness,
                    lineType=cv2.LINE_AA,
                )

            # We build label text with track id and optional speed.
            label = f"ID {track_id} | {gate_info.get('status_label', 'status necunoscut')}"

            # We draw label above bounding box.
            cv2.putText(frame, label, (x1, max(20, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            # We add event row for detailed timeline analysis.
            events.append(
                {
                    "frameIndex": frame_index,
                    "timestampMs": round(timestamp_ms, 2),
                    "trackId": track_id,
                    "classId": class_id,
                    "bbox": [round(float(v), 2) for v in bbox],
                    "center": [round(center[0], 2), round(center[1], 2)],
                    "anchorMode": anchor_mode,
                    "insideRoi": bool(gate_info.get("inside_roi", False)),
                    "crossedAms": gate_info.get("crossed_a_ms"),
                    "crossedBms": gate_info.get("crossed_b_ms"),
                    "speedKmh": gate_info.get("speed_kmh"),
                    "statusLabel": gate_info.get("status_label"),
                    "note": "Entertainment-only estimate",
                }
            )

        # We write processed frame into overlay video.
        writer.write(frame)

    # We release writer resource if it was initialized.
    if writer is not None:
        writer.release()

    # We convert raw overlay to browser-friendly H.264 final output.
    transcode_info = transcode_overlay_for_web(raw_overlay_path, artifact_paths["overlay_video"])

    # We build sorted per-track summary rows.
    summary_rows = build_track_summary(track_samples)

    # We write events to JSONL artifact.
    write_events_jsonl(events, artifact_paths["events_jsonl"])

    # We write summary rows to CSV artifact.
    write_summary_csv(summary_rows, artifact_paths["summary_csv"])

    # We build metadata object for API/dashboard consumption.
    metadata = {
        "status": "done",
        "input": os.path.abspath(args.input),
        "fps": fps,
        "sceneId": cfg.get("scene_id", "unknown-scene"),
        "modelPrimary": cfg.get("model_primary", "yolo26n.pt"),
        "modelFallback": cfg.get("model_fallback", "yolo11n.pt"),
        "tracker": cfg.get("tracker", "bytetrack.yaml"),
        "distanceMeters": cfg.get("distance_meters"),
        "privacyBlur": bool(cfg.get("privacy_blur", True)),
        "artifacts": artifact_paths,
        "numEvents": len(events),
        "numTracks": len(summary_rows),
        "disclaimer": "Doar pentru divertisment. Nu este masurare legala.",
        "overlayEncoding": transcode_info,
    }

    # We write metadata JSON artifact.
    write_metadata_json(metadata, artifact_paths["metadata_json"])

    # We also print metadata to stdout for API process capture.
    print(json.dumps(metadata, ensure_ascii=True))


# Standard Python entrypoint guard.
if __name__ == "__main__":
    main()
