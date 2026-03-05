"""Artifact export helpers for JSONL, CSV, and metadata."""

# JSON is used for metadata and event serialization.
import json

# OS and pathlib help with robust local filesystem writing.
import os
from pathlib import Path

# Typing improves clarity of function contracts.
from typing import Dict, List

# Pandas is used for friendly CSV output generation.
import pandas as pd


# This helper ensures destination folders exist before writing files.
def ensure_dir(path: str) -> None:
    # We create folders recursively when missing.
    Path(path).mkdir(parents=True, exist_ok=True)


# This function writes frame-level events as JSONL.
def write_events_jsonl(events: List[Dict], out_path: str) -> None:
    # We open destination file in text mode with UTF-8 encoding.
    with open(out_path, "w", encoding="utf-8") as f:
        # We write one JSON object per line for streaming-friendly analysis.
        for event in events:
            f.write(json.dumps(event, ensure_ascii=True) + "\n")


# This function writes per-track summary as CSV.
def write_summary_csv(rows: List[Dict], out_path: str) -> None:
    # We build a DataFrame from list of row dictionaries.
    df = pd.DataFrame(rows)

    # We add empty placeholder columns when no rows exist.
    if df.empty:
        df = pd.DataFrame(
            columns=[
                "trackId",
                "classId",
                "maxSpeedKmh",
                "avgSpeedKmh",
                "firstSeenMs",
                "lastSeenMs",
                "crossedAms",
                "crossedBms",
                "numSamples",
            ]
        )

    # We write CSV file without DataFrame row index.
    df.to_csv(out_path, index=False)


# This function writes a compact metadata JSON file.
def write_metadata_json(meta: Dict, out_path: str) -> None:
    # We write pretty JSON for easier human debugging.
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=True)


# This helper returns standardized artifact paths for one job.
def build_artifact_paths(job_dir: str) -> Dict[str, str]:
    # We normalize all output file locations in one place.
    return {
        "events_jsonl": os.path.join(job_dir, "events.jsonl"),
        "summary_csv": os.path.join(job_dir, "summary.csv"),
        "metadata_json": os.path.join(job_dir, "metadata.json"),
        "overlay_video": os.path.join(job_dir, "overlay.mp4"),
    }
