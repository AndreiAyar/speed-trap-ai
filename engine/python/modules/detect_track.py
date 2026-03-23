"""Detection and tracking pipeline using Ultralytics YOLO + ByteTrack."""

# Typing improves readability of yielded frame dictionaries.
from typing import Dict, Generator, List, Tuple

# OpenCV is used for video metadata such as FPS.
import cv2

# Torch helps us detect whether GPU backends are available.
try:
    import torch
except Exception:  # pragma: no cover - best-effort optional import
    torch = None

# Ultralytics model API provides detection + tracking.
from ultralytics import YOLO


# This helper opens video and returns frame rate.
def read_video_fps(video_path: str) -> float:
    # We open the video source with OpenCV.
    cap = cv2.VideoCapture(video_path)

    # We fetch FPS metadata and fallback to 30 if unavailable.
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    # We release the file handle immediately after reading metadata.
    cap.release()

# We return a safe float FPS value.
    return float(fps if fps > 0 else 30.0)


# This helper selects a safe inference device from a friendly config value.
def resolve_inference_device(device_preference: str) -> Tuple[str, str]:
    # We normalize empty or mixed-case input into a predictable string.
    normalized = str(device_preference or "auto").strip().lower()

    # We only support the beginner-friendly values documented in this project.
    if normalized not in {"auto", "cpu", "mps"}:
        normalized = "auto"
        invalid_note = "Unknown device preference received, so auto selection was used instead."
    else:
        invalid_note = ""

    # CPU is always available, so explicit CPU requests can return immediately.
    if normalized == "cpu":
        return "cpu", "CPU was requested explicitly."

    # We detect CUDA availability when torch is installed with GPU support.
    cuda_available = bool(torch is not None and torch.cuda.is_available())

    # We detect Apple Metal support carefully because not all torch builds expose MPS.
    mps_backend = getattr(torch.backends, "mps", None) if torch is not None else None
    mps_available = bool(mps_backend is not None and mps_backend.is_available())

    # Explicit MPS requests use Apple GPU when possible, otherwise fall back safely.
    if normalized == "mps":
        if mps_available:
            return "mps", "Apple Metal Performance Shaders (MPS) was requested and is available."
        return "cpu", "MPS was requested but is unavailable in this Python/Torch environment, so CPU was used."

    # Auto mode prefers Apple GPU on Apple Silicon machines when available.
    if mps_available:
        note = "Auto selected Apple Metal Performance Shaders (MPS)."
        if invalid_note:
            note = f"{invalid_note} {note}"
        return "mps", note

    # Auto mode also supports CUDA GPUs on non-Apple systems.
    if cuda_available:
        note = "Auto selected CUDA GPU acceleration."
        if invalid_note:
            note = f"{invalid_note} {note}"
        return "cuda:0", note

    # We fall back to CPU when no GPU backend is available.
    note = "Auto fell back to CPU because no supported GPU backend is available."
    if invalid_note:
        note = f"{invalid_note} {note}"
    return "cpu", note


# This function yields per-frame tracked detections.
def iter_tracked_frames(
    source_path: str,
    model_primary: str,
    model_fallback: str,
    tracker: str,
    classes: List[int],
    conf_threshold: float,
    device: str,
) -> Generator[Dict, None, None]:
    # We try loading primary model first and fallback on failure.
    try:
        model = YOLO(model_primary)
        active_model = model_primary
    except Exception:
        model = YOLO(model_fallback)
        active_model = model_fallback

    # We run tracker in streaming mode to process frame-by-frame.
    results = model.track(
        source=source_path,
        stream=True,
        persist=True,
        tracker=tracker,
        classes=classes,
        conf=conf_threshold,
        device=device,
        verbose=False,
    )

    # We iterate through each processed frame result.
    for frame_index, result in enumerate(results):
        # We get rendered frame image as NumPy array.
        frame = result.orig_img

        # We normalize boxes object presence.
        boxes = result.boxes

        # We keep a list of plain dict detections for easier downstream use.
        detections = []

        # We proceed only when boxes are present for current frame.
        if boxes is not None and boxes.xyxy is not None:
            # We read bounding boxes tensor values as Python list.
            xyxy_list = boxes.xyxy.cpu().tolist()

            # We read confidence values if available.
            conf_list = boxes.conf.cpu().tolist() if boxes.conf is not None else [0.0] * len(xyxy_list)

            # We read class ids if available.
            cls_list = boxes.cls.cpu().tolist() if boxes.cls is not None else [-1] * len(xyxy_list)

            # We read tracking ids if available; otherwise use -1.
            if boxes.id is not None:
                id_list = [int(v) for v in boxes.id.cpu().tolist()]
            else:
                id_list = [-1] * len(xyxy_list)

            # We combine per-box fields into simple detection entries.
            for i, bbox in enumerate(xyxy_list):
                detections.append(
                    {
                        "track_id": int(id_list[i]),
                        "bbox": [float(v) for v in bbox],
                        "conf": float(conf_list[i]),
                        "class_id": int(cls_list[i]),
                    }
                )

        # We yield frame package consumed by speed pipeline.
        yield {
            "frame_index": frame_index,
            "frame": frame,
            "detections": detections,
            "model": active_model,
            "device": device,
        }
