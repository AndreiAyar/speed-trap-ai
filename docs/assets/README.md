# README media

The GIFs are excerpts from the author's film, [Radarul s-a SCHIMBAT](https://www.youtube.com/watch?v=CDCUi20Q6CM). The dashboard images are captures of the actual local application processing the supplied short traffic recording.

| File | Film interval | What it shows |
| --- | --- | --- |
| `road-measurement.gif` | 02:37.2–02:40.3; 02:54.8–02:57.6; 02:58.4–03:01.7 | Actual roadside phone measurement, tape-measure comparison, and overhead road marking dimensions |
| `calibration.gif` | 05:21.5–05:28.1 | Moving line endpoints and the green ROI in the application |
| `bytetrack.gif` | 04:03.2–04:09.1 | The pointing hand following a tracked vehicle |
| `speed-gate.gif` | 04:21.5–04:28.5 | The same ID crossing A, then B, and receiving a speed |
| `comparison.gif` | 06:20.5–06:26.5 | AI overlay alongside vehicle sensor data, speedometer, and Waze |
| `video-preview.jpg` | 06:24 | Linked preview for the complete YouTube film |
| `video-link-preview.png` | Film preview with a Play control | Clickable YouTube preview with an English caption |
| `dashboard.png` | Local app capture | Completed job, overlay, leaderboard, and track details |
| `dashboard-calibration.png` | Local app capture | The current calibration tool using the supplied recording |
| `dashboard-walkthrough.gif` | Local app capture | Actual clicks, preview playback, scrolling, and placing line endpoints |
| `readme-banner.png` | Film frames at 04:38.2 and 04:27.2 | Uppercase Roboto Black on graphite/ochre, with separate green and red speed estimates from the film |
| `readme-banner.svg` | Source artwork for the header | Self-contained photo layout and outlined Roboto lettering; no font files or external resources required |

Recreate the film excerpts locally with:

```bash
python3 scripts/export-readme-media.py /path/to/your/source-film.mp4
```

FFmpeg must include `drawtext`, `palettegen`, and `paletteuse`. Each GIF has a permanent disclaimer footer. The source film, extracted frames, local demo recording, model weights, database, and generated job outputs are excluded from the repository.

The dashboard's example distance is **unmeasured for the short clip**. Its displayed speed demonstrates the software workflow and is not a verified vehicle speed. Original film results belong to their own camera calibrations.

Media rights remain with their respective owners; a code license does not automatically license the film, screenshots, or third-party content appearing in them.
