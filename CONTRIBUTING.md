# Contributing

Contributions are welcome: bug fixes, clearer calibration instructions, engine
tests, translations, and dashboard improvements. The project estimates speed
from recorded video for entertainment and education.

> Doar pentru divertisment. Nu este masurare legala.

## Set up a checkout

Use Node.js 22.13 or newer, pnpm 10, Python 3.11 or 3.12, and FFmpeg/FFprobe on
PATH. CPU processing works; an NVIDIA GPU or Apple MPS is optional.

- Windows: install Python with its launcher enabled. The setup command tries
  `py -3.12` and `py -3.11`, then Python executables on PATH.
- macOS/Linux: the setup command tries `python3.12`, `python3.11`, `python3`,
  and `python`. It checks the version before creating an environment.
- FFmpeg and FFprobe must be available in the same terminal you use for pnpm.
  Restart that terminal after changing PATH.

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm run setup:engine
pnpm run doctor
pnpm dev
```

Use `pnpm run setup:engine` explicitly. `pnpm setup` is a different, built-in pnpm
command and does not install this project's Python engine.

The project creates `engine/python/.venv` and selects its interpreter automatically
on Windows and Unix. No shell activation is needed. Setup installs Python
dependencies and may download large PyTorch wheels. It does not install system
packages, download a recording, or calibrate a scene.

For a manually managed environment, install `engine/python/requirements.txt`
there and set `SPEED_TRAP_PYTHON_BIN` to that environment's Python executable.

## Make a change

Start a working branch from `dev` and open a pull request against `dev`.
Maintainers integrate `dev` into `main` for releases. Describe the problem,
what changes for a user, and how you checked the result.

Keep code commented and beginner-friendly. Explain units, timestamps, coordinate
systems, and non-obvious decisions. Avoid unrelated formatting changes.

For changes to speed estimation, preserve and test this method:

```text
same track crosses Linia A at t1, then Linia B at t2
speed_kmh = distance_meters / (t2 - t1) * 3.6
```

Keep privacy blur enabled by default and preserve the required disclaimer in
the dashboard and generated output. Use synthetic or authorized, reviewed footage
for a new example. Do not commit recordings, personal paths, credentials,
model weights, databases, or generated job outputs.

## Run checks

```bash
pnpm run check
```

This builds the API and both frontend variants, runs Python geometry/calibration
and synthetic video-export tests, and checks the compiled API over HTTP.
Individual checks are `pnpm test:engine`, `pnpm test:api`, `pnpm build`, and
`pnpm build:radar`.

Tests do not require a GPU or model weights. A real detector run additionally
requires the engine dependencies and a recording:

```bash
pnpm run process:video data/input/sample.mp4 engine/python/configs/my-camera.yaml
```

That command works on Windows, macOS, and Linux. The older `.sh` helpers remain
available for Bash users. Local CLI runs write artifacts without adding a
dashboard job; create a job through the UI to review it there.

## Lightweight Python test environment

CI installs `engine/python/requirements-test.txt` in an isolated Python environment.
This substitutes deterministic tracked boxes for YOLO while exercising the real
gate, blur, video writer, FFmpeg conversion, and CSV/JSON exports. It does not
establish detector accuracy. Do not install `opencv-python-headless` into the same
environment as `opencv-python`; they both provide the `cv2` module.

## Licensing and reports

Your original code and written documentation contributions are submitted under
the project's [MIT License](LICENSE). Identify the source and license of any
third-party code or media. The default YOLO dependency retains its upstream
license; see [third-party notices](THIRD_PARTY_NOTICES.md).

Use the issue templates for reproducible bugs and feature requests. Report
sensitive vulnerabilities through the private channel in [SECURITY.md](SECURITY.md).
Keep reviews respectful, concrete, and focused on the work.
