"""Two-line speed gate logic for tracked objects."""

# Dataclass is used for clean per-track state storage.
from dataclasses import dataclass, field

# Typing improves readability and future maintenance.
from typing import Dict, List, Optional, Tuple

# NumPy is used for line and vector calculations.
import numpy as np


# This dataclass stores timing and speed-related track metadata.
@dataclass
class TrackGateState:
    # Unique tracking ID from ByteTrack.
    track_id: int
    # Last known center point in frame coordinates.
    last_center: Optional[Tuple[float, float]] = None
    # Last side values for line A and line B crossing checks.
    last_side_a: Optional[float] = None
    last_side_b: Optional[float] = None
    # Timestamp when line A was crossed in the correct direction.
    crossed_a_ms: Optional[float] = None
    # Timestamp when line B was crossed in the correct direction.
    crossed_b_ms: Optional[float] = None
    # Cached last computed speed value in km/h.
    speed_kmh: Optional[float] = None
    # We keep history for debugging, UI details, and exports.
    points: List[Tuple[float, float, float]] = field(default_factory=list)
    # Timestamp of last accepted crossing event to reduce jitter toggles.
    last_cross_event_ms: float = -1.0


# This helper computes oriented side of a point relative to a line.
def side_of_line(point: Tuple[float, float], line: List[List[float]]) -> float:
    # We unpack line endpoints into NumPy vectors.
    p1 = np.array(line[0], dtype=float)
    p2 = np.array(line[1], dtype=float)

    # We build vector from line start to query point.
    p = np.array(point, dtype=float)

    # 2D cross-product scalar tells which side of line the point is on.
    return float(np.cross(p2 - p1, p - p1))


# This helper checks whether the point is inside ROI polygon when ROI exists.
def point_in_polygon(point: Tuple[float, float], polygon: List[List[float]]) -> bool:
    # We allow empty ROI by treating everything as inside.
    if not polygon:
        return True

    # We implement ray-casting algorithm for point-in-polygon.
    x, y = point
    inside = False
    n = len(polygon)

    # We iterate polygon edges one by one.
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]

        # We check if horizontal ray intersects this edge.
        intersects = ((y1 > y) != (y2 > y)) and (
            x < (x2 - x1) * (y - y1) / ((y2 - y1) + 1e-9) + x1
        )

        # We flip inclusion state on each intersection.
        if intersects:
            inside = not inside

    # We return final inclusion boolean.
    return inside


# This class owns per-track states and crossing/speed logic.
class TwoLineSpeedGate:
    # Constructor receives calibration and filtering config.
    def __init__(
        self,
        line_a: List[List[float]],
        line_b: List[List[float]],
        distance_meters: float,
        direction: List[float],
        roi_polygon: List[List[float]],
        min_crossing_delta_ms: float = 150.0,
    ):
        # We store the first gate line.
        self.line_a = line_a
        # We store the second gate line.
        self.line_b = line_b
        # We store real-world distance between the two lines.
        self.distance_meters = float(distance_meters)
        # We normalize direction vector to compare movement direction reliably.
        d = np.array(direction, dtype=float)
        norm = float(np.linalg.norm(d)) + 1e-9
        self.direction = d / norm
        # We store ROI polygon for spatial filtering.
        self.roi_polygon = roi_polygon or []
        # We store debounce gap for crossing events.
        self.min_crossing_delta_ms = float(min_crossing_delta_ms)
        # We keep all track states in memory by track id.
        self.states: Dict[int, TrackGateState] = {}

    # This method updates one track position and possibly computes speed.
    def update_track(
        self,
        track_id: int,
        center: Tuple[float, float],
        timestamp_ms: float,
    ) -> Dict:
        # We fetch or create state object for this track.
        state = self.states.get(track_id)
        if state is None:
            state = TrackGateState(track_id=track_id)
            self.states[track_id] = state

        # We append this point into track history for debugging and exports.
        state.points.append((float(center[0]), float(center[1]), float(timestamp_ms)))

        # We skip speed logic if point is outside ROI.
        if not point_in_polygon(center, self.roi_polygon):
            state.last_center = center
            return {
                "track_id": track_id,
                "inside_roi": False,
                "speed_kmh": state.speed_kmh,
                "status_label": "in afara ROI",
            }

        # We compute current side values relative to both lines.
        side_a = side_of_line(center, self.line_a)
        side_b = side_of_line(center, self.line_b)

        # We determine movement projection over expected direction when possible.
        movement_projection = 0.0
        if state.last_center is not None:
            delta = np.array([center[0] - state.last_center[0], center[1] - state.last_center[1]], dtype=float)
            movement_projection = float(np.dot(delta, self.direction))

        # We consider movement valid only if it follows configured direction.
        moving_expected_direction = movement_projection >= 0.0

        # We define helper to check side change crossing with jitter debounce.
        def crossed(prev_side: Optional[float], curr_side: float, now_ms: float) -> bool:
            # We cannot detect crossing without previous side reference.
            if prev_side is None:
                return False
            # We require a sign flip as crossing signal.
            sign_flip = (prev_side <= 0 < curr_side) or (prev_side >= 0 > curr_side)
            # We reject crossing if debounce window has not elapsed.
            debounce_ok = (now_ms - state.last_cross_event_ms) >= self.min_crossing_delta_ms
            # Crossing is accepted only if both conditions are true.
            return sign_flip and debounce_ok

        # We detect line A crossing first (start gate).
        crossed_a = crossed(state.last_side_a, side_a, timestamp_ms)
        if crossed_a and moving_expected_direction and state.crossed_a_ms is None:
            state.crossed_a_ms = float(timestamp_ms)
            state.last_cross_event_ms = float(timestamp_ms)

        # We detect line B crossing second (end gate).
        crossed_b = crossed(state.last_side_b, side_b, timestamp_ms)
        if crossed_b and moving_expected_direction and state.crossed_a_ms is not None and state.crossed_b_ms is None:
            state.crossed_b_ms = float(timestamp_ms)
            state.last_cross_event_ms = float(timestamp_ms)

            # We compute elapsed seconds between line crossings.
            delta_seconds = (state.crossed_b_ms - state.crossed_a_ms) / 1000.0

            # We compute speed only if elapsed time is positive.
            if delta_seconds > 0:
                # We compute meters per second from known distance.
                speed_mps = self.distance_meters / delta_seconds
                # We convert to kilometers per hour.
                speed_kmh = speed_mps * 3.6
                # We cache rounded speed for stable UI labels.
                state.speed_kmh = float(round(speed_kmh, 2))

        # We update last side references for next frame crossing detection.
        state.last_side_a = side_a
        state.last_side_b = side_b

        # We update last center position for motion direction estimation.
        state.last_center = center

        # We build a user-facing status label for overlay clarity.
        if state.speed_kmh is not None:
            status_label = f"Estimare AI: {state.speed_kmh} km/h"
        elif not moving_expected_direction and state.last_center is not None:
            status_label = "sens opus"
        elif state.crossed_a_ms is not None and state.crossed_b_ms is None:
            status_label = "asteapta linia B"
        elif state.crossed_a_ms is None:
            status_label = "asteapta linia A"
        else:
            status_label = "fara crossing valid"

        # We return state snapshot for event writing and overlays.
        return {
            "track_id": track_id,
            "inside_roi": True,
            "crossed_a_ms": state.crossed_a_ms,
            "crossed_b_ms": state.crossed_b_ms,
            "speed_kmh": state.speed_kmh,
            "movement_projection": movement_projection,
            "status_label": status_label,
        }

    # This method returns all states for final aggregation and export.
    def all_states(self) -> Dict[int, TrackGateState]:
        # We expose in-memory state map to caller.
        return self.states
