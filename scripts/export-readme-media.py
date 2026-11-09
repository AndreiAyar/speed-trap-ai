#!/usr/bin/env python3
"""Recreate README GIFs from a local copy of the author's film using FFmpeg."""

import argparse
from pathlib import Path
import shutil
import subprocess

# These cuts were selected by inspecting frames every 0.5 s, with finer checks
# around line edits and the transition from a pending crossing to a final speed.
CUTS = [
    ("calibration.gif", 321.5, 6.6),
    ("bytetrack.gif", 243.2, 5.9),
    ("speed-gate.gif", 261.5, 7.0),
    ("comparison.gif", 380.5, 6.0),
]
DISCLAIMER = "Doar pentru divertisment. Nu este masurare legala."


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local source film; never uploaded by this script")
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"), help="Optional FFmpeg executable")
    parser.add_argument("--only", choices=[cut[0] for cut in CUTS], help="Recreate just one GIF")
    args = parser.parse_args()
    if not args.ffmpeg or not args.source.is_file():
        parser.error("Install FFmpeg and supply an existing source film.")

    destination = Path(__file__).resolve().parents[1] / "docs" / "assets"
    destination.mkdir(parents=True, exist_ok=True)
    for name, start, duration in CUTS:
        if args.only and name != args.only:
            continue
        # A permanent footer keeps the disclaimer visible in every exported frame.
        # One palette per GIF and Bayer dithering keep GitHub downloads compact.
        filters = (
            "fps=10,scale=720:-2:flags=lanczos,hqdn3d=3:3:6:6,setsar=1,"
            "pad=iw:ih+32:0:0:color=0x111827,"
            f"drawtext=text='{DISCLAIMER}':fontcolor=white:fontsize=14:x=12:y=h-23,"
            "split[a][b];[a]palettegen=max_colors=80:stats_mode=diff[p];"
            "[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle"
        )
        subprocess.run([
            args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-ss", str(start), "-t", str(duration), "-i", str(args.source),
            "-filter_complex", filters, "-an", "-loop", "0", str(destination / name),
        ], check=True)
        print(f"Exported {name}: {start:.1f}s to {start + duration:.1f}s", flush=True)


if __name__ == "__main__":
    main()
