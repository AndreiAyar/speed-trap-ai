"""Validate camera settings before a run can produce a misleading speed."""

import math


def real_number(value, name, minimum=None, strictly_positive=False):
    # bool is a Python integer, but a YAML true/false is not a distance or pixel.
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number.")
    if strictly_positive and value <= 0:
        raise ValueError(f"{name} must be greater than zero.")
    if minimum is not None and value < minimum:
        raise ValueError(f"{name} must be at least {minimum}.")


def point_list(value, name, count=None):
    if not isinstance(value, (list, tuple)) or (count is not None and len(value) != count):
        expected = f"{count} " if count is not None else "a list of "
        raise ValueError(f"{name} must contain {expected}[x, y] points.")
    for index, point in enumerate(value):
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            raise ValueError(f"{name}[{index}] must be an [x, y] point.")
        for axis in point:
            real_number(axis, name, minimum=0)


def validate_camera_config(config):
    if not isinstance(config, dict):
        raise ValueError("Camera YAML must be a mapping of configuration keys.")
    for key in ("line_a", "line_b"):
        point_list(config.get(key), key, count=2)
        if config[key][0] == config[key][1]:
            raise ValueError(f"{key} endpoints must be different.")
    if sorted(map(tuple, config["line_a"])) == sorted(map(tuple, config["line_b"])):
        raise ValueError("Linia A and Linia B must be different gates.")
    real_number(config.get("distance_meters"), "distance_meters", strictly_positive=True)

    direction = config.get("direction", [0.0, 1.0])
    if not isinstance(direction, (list, tuple)) or len(direction) != 2:
        raise ValueError("direction must contain [x, y].")
    for axis in direction:
        real_number(axis, "direction")
    if not any(direction):
        raise ValueError("direction must have a nonzero component.")

    roi = config.get("roi_polygon", [])
    point_list(roi, "roi_polygon")
    if roi:
        if len(roi) < 3:
            raise ValueError("roi_polygon needs at least three vertices, or use [].")
    real_number(config.get("min_crossing_delta_ms", 150), "min_crossing_delta_ms", minimum=0)
    confidence = config.get("conf_threshold", 0.25)
    real_number(confidence, "conf_threshold", strictly_positive=True)
    if confidence > 1:
        raise ValueError("conf_threshold cannot exceed 1.")
    if config.get("anchor_point", "bottom_center") not in {"bottom_center", "center"}:
        raise ValueError("anchor_point must be bottom_center or center.")
    if config.get("device", "auto") not in {"auto", "cpu", "mps"}:
        raise ValueError("device must be auto, cpu, or mps.")
    for key in ("privacy_blur", "trail_enabled", "hide_outside_roi_overlays", "show_roi_overlay_on_video"):
        if key in config and not isinstance(config[key], bool):
            raise ValueError(f"{key} must be a YAML boolean (true or false).")


def validate_frame_geometry(config, width, height):
    # Coordinates refer to original frame pixels, never the resized UI preview.
    # Allow the outer image edge too, as produced by endpoint selection in a UI.
    for key in ("line_a", "line_b", "roi_polygon"):
        for x, y in config.get(key, []) or []:
            if x > width or y > height:
                raise ValueError(f"{key} is outside this {width}x{height} video. Recalibrate for its resolution.")
