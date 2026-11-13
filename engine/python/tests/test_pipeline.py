"""Process synthetic tracked frames through the real gate, blur, and exporters.

The detector is replaced with deterministic boxes. These tests verify the video
pipeline and its artifacts, not YOLO detection accuracy or real-world calibration.
"""
import contextlib
import csv
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch, Mock

import cv2
import numpy as np
import yaml

import run_pipeline
from modules.detect_track import read_video_fps


class PipelineTests(unittest.TestCase):
    def test_synthetic_crossing_exports_video_and_correct_speed(self):
        with tempfile.TemporaryDirectory(prefix="speed trap ") as directory:
            folder = Path(directory)
            source = folder / "test video.mp4"
            config = folder / "camera.yaml"
            output = folder / "results"
            frames = []
            positions = [50, 90, 110, 150, 210]
            writer = cv2.VideoWriter(str(source), cv2.VideoWriter_fourcc(*"mp4v"), 4, (640, 360))
            self.assertTrue(writer.isOpened(), "OpenCV must support MP4 writing on this platform.")
            for y in positions:
                frame = np.full((360, 640, 3), 180, dtype=np.uint8)
                cv2.rectangle(frame, (280, y - 30), (360, y), (40, 90, 160), -1)
                frames.append(frame)
                writer.write(frame)
            writer.release()
            config.write_text(yaml.safe_dump({
                "line_a": [[0, 100], [639, 100]],
                "line_b": [[0, 200], [639, 200]],
                "distance_meters": 5,
                "direction": [0, 1],
                "device": "cpu",
                "privacy_blur": True,
            }), encoding="utf-8")
            tracked = [
                {"frame_index": index, "frame": frame, "model": "synthetic-test", "device": "cpu",
                 "detections": [{"track_id": 1, "class_id": 2, "bbox": [280, y - 30, 360, y], "conf": 1.0}]}
                for index, (frame, y) in enumerate(zip(frames, positions))
            ]
            args = ["run_pipeline.py", "--input", str(source), "--config", str(config), "--out", str(output)]
            with patch.object(sys, "argv", args), patch.object(run_pipeline, "iter_tracked_frames", return_value=iter(tracked)):
                with contextlib.redirect_stdout(io.StringIO()):
                    run_pipeline.main()

            metadata = json.loads((output / "metadata.json").read_text())
            self.assertEqual(metadata["status"], "done")
            self.assertEqual(metadata["fps"], 4)
            self.assertEqual(metadata["numTracks"], 1)
            self.assertTrue(metadata["privacyBlur"])
            self.assertEqual(metadata["disclaimer"], "Doar pentru divertisment. Nu este masurare legala.")
            with (output / "summary.csv").open(newline="") as summary:
                row = next(csv.DictReader(summary))
            self.assertEqual(float(row["crossedAms"]), 500)
            self.assertEqual(float(row["crossedBms"]), 1000)
            self.assertEqual(float(row["maxSpeedKmh"]), 36)
            events = [json.loads(line) for line in (output / "events.jsonl").read_text().splitlines()]
            self.assertEqual(len(events), 5)
            self.assertEqual(events[-1]["speedKmh"], 36)
            cap = cv2.VideoCapture(str(output / "overlay.mp4"))
            try:
                self.assertTrue(cap.isOpened())
                self.assertEqual(int(cap.get(cv2.CAP_PROP_FRAME_COUNT)), 5)
                self.assertTrue(cap.read()[0])
            finally:
                cap.release()
            if shutil.which("ffmpeg"):
                self.assertIn(metadata["overlayEncoding"]["status"], {"transcoded", "transcoded_videotoolbox"})

    def test_missing_video_is_rejected_before_inference(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "Cannot open"):
                read_video_fps(str(Path(folder) / "missing.mp4"))

    def test_invalid_fps_is_not_silently_assumed_to_be_30(self):
        for fps in [0, float("nan"), float("inf")]:
            capture = Mock()
            capture.isOpened.return_value = True
            capture.get.return_value = fps
            with self.subTest(fps=fps), patch("modules.detect_track.cv2.VideoCapture", return_value=capture):
                with self.assertRaisesRegex(ValueError, "FPS"):
                    read_video_fps("test.mp4")
            capture.release.assert_called_once()


if __name__ == "__main__":
    unittest.main()
