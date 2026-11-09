#!/usr/bin/env python3
"""Recreate README GIFs from a local copy of the author's film using FFmpeg."""

import argparse
from pathlib import Path
import shutil
import subprocess

# These cuts were selected by inspecting frames every 0.5 s, with finer checks
# around line edits and the transition from a pending crossing to a final speed.
CUTS = {
    # Show the real roadside measurement first, then the tape comparison and
    # overhead road dimensions. Skip the unrelated phone/app stock footage.
    "road-measurement.gif": [(157.2, 3.1), (174.8, 2.8), (178.4, 3.3)],
    "calibration.gif": [(321.5, 6.6)],
    "bytetrack.gif": [(243.2, 5.9)],
    "speed-gate.gif": [(261.5, 7.0)],
    "comparison.gif": [(380.5, 6.0)],
}
DISCLAIMER = "Doar pentru divertisment. Nu este masurare legala."


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local source film; never uploaded by this script")
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"), help="Optional FFmpeg executable")
    parser.add_argument("--only", choices=list(CUTS), help="Recreate just one GIF")
    args = parser.parse_args()
    if not args.ffmpeg or not args.source.is_file():
        parser.error("Install FFmpeg and supply an existing source film.")

    destination = Path(__file__).resolve().parents[1] / "docs" / "assets"
    destination.mkdir(parents=True, exist_ok=True)
    for name, segments in CUTS.items():
        if args.only and name != args.only:
            continue
        # A permanent footer keeps the disclaimer visible in every exported frame.
        # One palette per GIF and Bayer dithering keep GitHub downloads compact.
        # A montage may use several source intervals. Reset timestamps so the
        # clips join cleanly and keep their original playback speed.
        command = [args.ffmpeg, "-hide_banner", "-loglevel", "error", "-y"]
        inputs = []
        fps = 8 if name == "road-measurement.gif" else 10
        for index, (start, duration) in enumerate(segments):
            command += ["-ss", str(start), "-t", str(duration), "-i", str(args.source)]
            inputs.append(
                f"[{index}:v]fps={fps},scale=720:-2:flags=lanczos,"
                f"hqdn3d=3:3:6:6,setsar=1,setpts=PTS-STARTPTS[clip{index}]"
            )
        joined = "".join(f"[clip{index}]" for index in range(len(segments)))
        filters = ";".join(inputs) + ";" + joined + (
            f"concat=n={len(segments)}:v=1:a=0,"
            "pad=iw:ih+32:0:0:color=0x111827,"
            f"drawtext=text='{DISCLAIMER}':fontcolor=white:fontsize=14:x=12:y=h-23,"
            "split[a][b];[a]palettegen=max_colors=80:stats_mode=diff[p];"
            "[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle"
        )
        subprocess.run(command + [
            "-filter_complex", filters, "-an", "-loop", "0", str(destination / name),
        ], check=True)
        intervals = ", ".join(f"{start:.1f}–{start + duration:.1f}s" for start, duration in segments)
        print(f"Exported {name}: {intervals}", flush=True)


if __name__ == "__main__":
    main()
