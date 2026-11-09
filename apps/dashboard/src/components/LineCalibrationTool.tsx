// Interactive calibration panel for selecting line A/B coordinates from any video URL.

// React hooks manage local tool state and DOM measurements.
import { useEffect, useMemo, useRef, useState } from "react";

// API helper converts local paths into browser-playable preview URLs.
import { toCalibrationVideoUrl } from "../lib/api";

// We define a simple point type used by all calibration logic.
interface Point {
  // Horizontal coordinate in native video pixels.
  x: number;
  // Vertical coordinate in native video pixels.
  y: number;
}

// Draft input state keeps manual text editing smooth before commit.
interface PointDraft {
  // Draft horizontal coordinate as plain text.
  x: string;
  // Draft vertical coordinate as plain text.
  y: string;
}

// Drag state tracks what overlay shape is currently being moved by pointer.
interface DragInteraction {
  // Drag kind decides whether one point, one line, or the whole ROI moves.
  kind: "point" | "line" | "roi";
  // Pointer id keeps drag stable even on touch/pen capable devices.
  pointerId: number;
  // Slots affected by the current drag action.
  slots: SlotKey[];
  // Native frame position where drag started.
  startPointer: Point;
  // Snapshot of original points before drag begins.
  initialPoints: Partial<Record<SlotKey, Point>>;
}

// Point-hit records keep the closest draggable point under the pointer.
interface PointHitMatch {
  // Matching slot key for the nearest point.
  slot: SlotKey;
  // Display-space distance from pointer to that point.
  distance: number;
}

// Slot keys represent the four required line endpoints.
type SlotKey = "a1" | "a2" | "b1" | "b2" | "r1" | "r2" | "r3" | "r4";

// We keep labels centralized for UI text and ordering.
const SLOT_LABELS: Record<SlotKey, string> = {
  a1: "Linia A - punct 1",
  a2: "Linia A - punct 2",
  b1: "Linia B - punct 1",
  b2: "Linia B - punct 2",
  r1: "ROI - punct 1",
  r2: "ROI - punct 2",
  r3: "ROI - punct 3",
  r4: "ROI - punct 4",
};

// This ordered array defines auto-advance behavior after each click.
const LINE_SLOT_ORDER: SlotKey[] = ["a1", "a2", "b1", "b2"];

// This ordered array defines ROI point ordering for polygon drawing.
const ROI_SLOT_ORDER: SlotKey[] = ["r1", "r2", "r3", "r4"];

// This ordered array defines auto-advance behavior after each click.
const SLOT_ORDER: SlotKey[] = [...LINE_SLOT_ORDER, ...ROI_SLOT_ORDER];

// We use a practical local sample path when no suggested URL exists yet.
const DEFAULT_CALIBRATION_PATH = "data/input/sample.mp4";

// This helper formats one native point into YAML list item text.
function formatYamlPoint(point: Point): string {
  return `  - [${point.x}, ${point.y}]`;
}

// This helper extracts one top-level YAML block by key from pasted config text.
function extractTopLevelYamlBlock(source: string, key: string): string {
  // We split into lines so we can stop at the next top-level key.
  const lines = source.split(/\r?\n/);

  // We search for the requested top-level key first.
  const startIndex = lines.findIndex((line) => new RegExp(`^\\s*${key}\\s*:`).test(line));
  if (startIndex < 0) {
    return "";
  }

  // We collect the key line and its indented children.
  const collected: string[] = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];

    // We stop when a new top-level key begins after the target block.
    if (
      index > startIndex &&
      /^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(line) &&
      !/^\s/.test(line)
    ) {
      break;
    }

    collected.push(line);
  }

  // We return the joined YAML fragment for downstream coordinate parsing.
  return collected.join("\n");
}

// This helper parses YAML-like coordinate lists such as "- [100, 200]".
function parseYamlPointList(source: string, key: string, expectedCount: number): Point[] | null {
  // We isolate the relevant YAML block first.
  const block = extractTopLevelYamlBlock(source, key);
  if (!block) {
    return null;
  }

  // We collect all coordinate pairs from the block in written order.
  const matches = [...block.matchAll(/\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g)];
  if (matches.length < expectedCount) {
    return null;
  }

  // We convert coordinates to rounded integer native pixels.
  return matches.slice(0, expectedCount).map((match) => ({
    x: Math.round(Number(match[1])),
    y: Math.round(Number(match[2])),
  }));
}

// Component props allow parent to suggest a default video URL or local path.
interface LineCalibrationToolProps {
  // Optional pre-filled URL/path from processed job artifacts.
  suggestedUrl?: string;
}

// Main calibration component used inside dashboard.
export function LineCalibrationTool({ suggestedUrl = "" }: LineCalibrationToolProps) {
  // We keep current text input state for URL editing.
  const [inputUrl, setInputUrl] = useState(DEFAULT_CALIBRATION_PATH);

  // We keep actively loaded browser-playable src used by video element.
  const [videoUrl, setVideoUrl] = useState(toCalibrationVideoUrl(DEFAULT_CALIBRATION_PATH));

  // We store optional playback/loading error for user feedback.
  const [loadError, setLoadError] = useState<string | null>(null);

  // We store native video dimensions after metadata is loaded.
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });

  // We store displayed video element dimensions for coordinate conversion.
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  // We store current cursor position in native coordinates.
  const [cursor, setCursor] = useState<Point | null>(null);

  // We store active selection slot where next click writes coordinates.
  const [activeSlot, setActiveSlot] = useState<SlotKey>("a1");

  // We store explicit point selection so one point can be nudged precisely.
  const [selectedSlot, setSelectedSlot] = useState<SlotKey | null>(null);

  // We allow line editors to collapse so the preview stays more visible.
  const [showLineSection, setShowLineSection] = useState(false);

  // We allow ROI editors to collapse for the same space-saving reason.
  const [showRoiSection, setShowRoiSection] = useState(false);

  // We let users hide ROI overlay while keeping ROI coordinates in the form.
  const [showRoiOverlay, setShowRoiOverlay] = useState(true);

  // We store selected points for both lines.
  const [points, setPoints] = useState<Record<SlotKey, Point | null>>({
    a1: null,
    a2: null,
    b1: null,
    b2: null,
    r1: null,
    r2: null,
    r3: null,
    r4: null,
  });

  // We keep editable string drafts separate from committed numeric points.
  const [pointDrafts, setPointDrafts] = useState<Record<SlotKey, PointDraft>>({
    a1: { x: "", y: "" },
    a2: { x: "", y: "" },
    b1: { x: "", y: "" },
    b2: { x: "", y: "" },
    r1: { x: "", y: "" },
    r2: { x: "", y: "" },
    r3: { x: "", y: "" },
    r4: { x: "", y: "" },
  });

  // We hold ref to video element for metadata and size reads.
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // We hold ref to stage wrapper where pointer events are captured.
  const stageRef = useRef<HTMLDivElement | null>(null);

  // We keep current drag interaction while user repositions geometry on overlay.
  const [dragInteraction, setDragInteraction] = useState<DragInteraction | null>(null);

  // We keep a writable YAML area so pasted camera settings can drive the preview.
  const [yamlEditorValue, setYamlEditorValue] = useState(
    "line_a:\n  - [x1, y1]\n  - [x2, y2]\n\nline_b:\n  - [x1, y1]\n  - [x2, y2]\n\nroi_polygon:\n  - [x1, y1]\n  - [x2, y2]\n  - [x3, y3]\n  - [x4, y4]"
  );

  // We store parser feedback near the YAML editor for confidence while calibrating.
  const [yamlEditorMessage, setYamlEditorMessage] = useState<string | null>(null);

  // We keep fine-adjustment step configurable for precise point edits.
  const [nudgeStep, setNudgeStep] = useState(1);

  // This helper writes text drafts without forcing immediate numeric parsing.
  const updatePointDraft = (slot: SlotKey, axis: keyof Point, rawValue: string) => {
    setPointDrafts((previous) => ({
      ...previous,
      [slot]: {
        ...previous[slot],
        [axis]: rawValue,
      },
    }));
  };

  // This helper commits one draft axis into numeric state on blur/enter.
  const commitPointAxis = (slot: SlotKey, axis: keyof Point) => {
    const rawValue = pointDrafts[slot][axis].trim();

    // We allow blank draft to keep field empty until user decides next value.
    if (!rawValue) {
      return;
    }

    // We parse user input as integer pixel coordinate.
    const parsedValue = Number.parseInt(rawValue, 10);

    // We ignore invalid strings and restore current committed value text.
    if (!Number.isFinite(parsedValue)) {
      setPointDrafts((previous) => ({
        ...previous,
        [slot]: {
          ...previous[slot],
          [axis]: points[slot] ? String(points[slot]![axis]) : "",
        },
      }));
      return;
    }

    // We clamp values to loaded video bounds when metadata is available.
    const maxX = Math.max(videoSize.width - 1, 0);
    const maxY = Math.max(videoSize.height - 1, 0);
    const clampedValue = axis === "x"
      ? Math.min(Math.max(parsedValue, 0), maxX || parsedValue)
      : Math.min(Math.max(parsedValue, 0), maxY || parsedValue);

    // We create missing point object on first manual commit.
    setPoints((previous) => {
      const existingPoint = previous[slot] ?? { x: 0, y: 0 };
      return {
        ...previous,
        [slot]: {
          ...existingPoint,
          [axis]: clampedValue,
        },
      };
    });

    // We normalize draft text to committed clamped value.
    setPointDrafts((previous) => ({
      ...previous,
      [slot]: {
        ...previous[slot],
        [axis]: String(clampedValue),
      },
    }));

    // We keep manual edits aligned with selection for follow-up nudging.
    setActiveSlot(slot);
    setSelectedSlot(slot);
  };

  // We optionally auto-load suggested URL only while input still matches the default sample path.
  useEffect(() => {
    if (suggestedUrl && inputUrl === DEFAULT_CALIBRATION_PATH && !videoUrl) {
      setInputUrl(suggestedUrl);
      setVideoUrl(toCalibrationVideoUrl(suggestedUrl));
    }
  }, [inputUrl, suggestedUrl, videoUrl]);

  // We keep draft strings aligned with committed point changes from clicks/clear.
  useEffect(() => {
    setPointDrafts({
      a1: { x: points.a1 ? String(points.a1.x) : "", y: points.a1 ? String(points.a1.y) : "" },
      a2: { x: points.a2 ? String(points.a2.x) : "", y: points.a2 ? String(points.a2.y) : "" },
      b1: { x: points.b1 ? String(points.b1.x) : "", y: points.b1 ? String(points.b1.y) : "" },
      b2: { x: points.b2 ? String(points.b2.x) : "", y: points.b2 ? String(points.b2.y) : "" },
      r1: { x: points.r1 ? String(points.r1.x) : "", y: points.r1 ? String(points.r1.y) : "" },
      r2: { x: points.r2 ? String(points.r2.x) : "", y: points.r2 ? String(points.r2.y) : "" },
      r3: { x: points.r3 ? String(points.r3.x) : "", y: points.r3 ? String(points.r3.y) : "" },
      r4: { x: points.r4 ? String(points.r4.x) : "", y: points.r4 ? String(points.r4.y) : "" },
    });
  }, [points]);

  // We keep displayed size in sync with responsive video element resizing.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    // This helper reads current rendered dimensions from DOM.
    const refreshSize = () => {
      setDisplaySize({ width: video.clientWidth, height: video.clientHeight });
    };

    // We refresh once immediately in case metadata is already loaded.
    refreshSize();

    // We observe future resize events for accurate coordinate mapping.
    const observer = new ResizeObserver(() => {
      refreshSize();
    });
    observer.observe(video);

    // Cleanup detaches observer on unmount.
    return () => {
      observer.disconnect();
    };
  }, [videoUrl]);

  // This helper maps pointer client coordinates to overlay-local display pixels.
  const pointerToStageLocal = (clientX: number, clientY: number): Point | null => {
    const stage = stageRef.current;
    if (!stage) {
        return null;
    }

    // We get stage rectangle to compute local pointer offsets.
    const rect = stage.getBoundingClientRect();

    // We skip conversion when stage has no visible dimensions.
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    // We clamp pointer offsets to stage boundaries.
    const localX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const localY = Math.min(Math.max(clientY - rect.top, 0), rect.height);

    // We return stage-local point in display coordinates.
    return { x: localX, y: localY };
  };

  // This helper maps pointer client coordinates to native video coordinates.
  const pointerToNative = (clientX: number, clientY: number): Point | null => {
    const stagePoint = pointerToStageLocal(clientX, clientY);
    if (!stagePoint || videoSize.width <= 0 || videoSize.height <= 0) {
      return null;
    }

    // We map local offsets from display space to native video pixels.
    const stage = stageRef.current;
    const rect = stage?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const x = Math.round((stagePoint.x / rect.width) * (videoSize.width - 1));
    const y = Math.round((stagePoint.y / rect.height) * (videoSize.height - 1));

    // We return converted native point.
    return { x, y };
  };

  // This helper clamps one point to the loaded video bounds.
  const clampPointToVideo = (point: Point): Point => {
    const maxX = Math.max(videoSize.width - 1, 0);
    const maxY = Math.max(videoSize.height - 1, 0);
    return {
      x: Math.min(Math.max(Math.round(point.x), 0), maxX || Math.round(point.x)),
      y: Math.min(Math.max(Math.round(point.y), 0), maxY || Math.round(point.y)),
    };
  };

  // This helper clears all selected points in one action.
  const clearPoints = () => {
    setPoints({ a1: null, a2: null, b1: null, b2: null, r1: null, r2: null, r3: null, r4: null });
    setActiveSlot("a1");
    setSelectedSlot(null);
    setDragInteraction(null);
    setYamlEditorMessage(null);
  };

  // We compute YAML snippet for easy copy into camera config.
  const yamlSnippet = useMemo(() => {
    const lineA = points.a1 && points.a2
      ? `line_a:\n${formatYamlPoint(points.a1)}\n${formatYamlPoint(points.a2)}`
      : "line_a:\n  - [x1, y1]\n  - [x2, y2]";
    const lineB = points.b1 && points.b2
      ? `line_b:\n${formatYamlPoint(points.b1)}\n${formatYamlPoint(points.b2)}`
      : "line_b:\n  - [x1, y1]\n  - [x2, y2]";
    const roiPolygon = ROI_SLOT_ORDER.every((slot) => points[slot])
      ? `roi_polygon:\n${formatYamlPoint(points.r1!)}\n${formatYamlPoint(points.r2!)}\n${formatYamlPoint(points.r3!)}\n${formatYamlPoint(points.r4!)}`
      : "roi_polygon:\n  - [x1, y1]\n  - [x2, y2]\n  - [x3, y3]\n  - [x4, y4]";
    return `${lineA}\n\n${lineB}\n\n${roiPolygon}`;
  }, [points]);

  // We keep the text editor synced with the latest calibrated points.
  useEffect(() => {
    setYamlEditorValue(yamlSnippet);
  }, [yamlSnippet]);

  // This helper copies generated YAML to clipboard when available.
  const copyYaml = async () => {
    try {
      await navigator.clipboard.writeText(yamlEditorValue);
    } catch {
      // We silently ignore clipboard failures in restricted contexts.
    }
  };

  // This helper applies pasted YAML coordinates to the live calibration preview.
  const applyYamlToPreview = () => {
    const parsedLineA = parseYamlPointList(yamlEditorValue, "line_a", 2);
    const parsedLineB = parseYamlPointList(yamlEditorValue, "line_b", 2);
    const parsedRoi = parseYamlPointList(yamlEditorValue, "roi_polygon", 4);

    // We require at least one valid section so accidental paste does not wipe points.
    if (!parsedLineA && !parsedLineB && !parsedRoi) {
      setYamlEditorMessage("Nu am gasit coordonate valide pentru line_a, line_b sau roi_polygon.");
      return;
    }

    // We merge only sections that were successfully parsed from pasted config.
    setPoints((previous) => ({
      ...previous,
      a1: parsedLineA?.[0] ?? previous.a1,
      a2: parsedLineA?.[1] ?? previous.a2,
      b1: parsedLineB?.[0] ?? previous.b1,
      b2: parsedLineB?.[1] ?? previous.b2,
      r1: parsedRoi?.[0] ?? previous.r1,
      r2: parsedRoi?.[1] ?? previous.r2,
      r3: parsedRoi?.[2] ?? previous.r3,
      r4: parsedRoi?.[3] ?? previous.r4,
    }));

    // We confirm how many sections were updated for user confidence.
    const updatedSections = [
      parsedLineA ? "Linia A" : null,
      parsedLineB ? "Linia B" : null,
      parsedRoi ? "ROI" : null,
    ].filter(Boolean);
    setYamlEditorMessage(`${updatedSections.join(", ")} au fost aplicate pe preview.`);
  };

  // This helper converts native point to display point for SVG drawing.
  const nativeToDisplay = (point: Point | null): Point | null => {
    if (!point || videoSize.width <= 0 || videoSize.height <= 0 || displaySize.width <= 0 || displaySize.height <= 0) {
      return null;
    }

    return {
      x: (point.x / (videoSize.width - 1 || 1)) * displaySize.width,
      y: (point.y / (videoSize.height - 1 || 1)) * displaySize.height,
    };
  };

  // We project all selected points into display space for SVG rendering.
  const displayPoints = {
    a1: nativeToDisplay(points.a1),
    a2: nativeToDisplay(points.a2),
    b1: nativeToDisplay(points.b1),
    b2: nativeToDisplay(points.b2),
    r1: nativeToDisplay(points.r1),
    r2: nativeToDisplay(points.r2),
    r3: nativeToDisplay(points.r3),
    r4: nativeToDisplay(points.r4),
  };

  // We prepare ROI polygon SVG points only when all four ROI corners are set.
  const roiDisplayPolygon = ROI_SLOT_ORDER.every((slot) => displayPoints[slot])
    ? ROI_SLOT_ORDER.map((slot) => `${displayPoints[slot]!.x},${displayPoints[slot]!.y}`).join(" ")
    : "";

  // This helper returns the nearest existing point under the pointer, if any.
  const findNearbySlot = (stagePoint: Point): SlotKey | null => {
    let bestMatch: PointHitMatch | undefined;

    SLOT_ORDER.forEach((slot) => {
      const point = displayPoints[slot];
      if (!point) {
        return;
      }

      const distance = Math.hypot(point.x - stagePoint.x, point.y - stagePoint.y);
      if (distance <= 14 && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = { slot, distance };
      }
    });

    return bestMatch ? bestMatch.slot : null;
  };

  // This helper measures display-space distance from a point to one line segment.
  const distanceToSegment = (point: Point, start: Point, end: Point): number => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 0) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }

    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    const projection = {
      x: start.x + t * dx,
      y: start.y + t * dy,
    };
    return Math.hypot(point.x - projection.x, point.y - projection.y);
  };

  // This helper decides whether one of the two draggable lines is under the pointer.
  const findDraggableLine = (stagePoint: Point): SlotKey[] | null => {
    const candidates: Array<{ slots: SlotKey[]; distance: number }> = [];

    if (displayPoints.a1 && displayPoints.a2) {
      candidates.push({
        slots: ["a1", "a2"],
        distance: distanceToSegment(stagePoint, displayPoints.a1, displayPoints.a2),
      });
    }

    if (displayPoints.b1 && displayPoints.b2) {
      candidates.push({
        slots: ["b1", "b2"],
        distance: distanceToSegment(stagePoint, displayPoints.b1, displayPoints.b2),
      });
    }

    const best = candidates
      .filter((candidate) => candidate.distance <= 10)
      .sort((left, right) => left.distance - right.distance)[0];

    return best?.slots ?? null;
  };

  // This helper checks if a display-space point falls inside the displayed ROI polygon.
  const isInsideDisplayedRoi = (stagePoint: Point): boolean => {
    const polygonPoints = ROI_SLOT_ORDER.map((slot) => displayPoints[slot]).filter(Boolean) as Point[];
    if (polygonPoints.length !== ROI_SLOT_ORDER.length) {
      return false;
    }

    let inside = false;
    for (let index = 0; index < polygonPoints.length; index += 1) {
      const current = polygonPoints[index];
      const next = polygonPoints[(index + 1) % polygonPoints.length];
      const intersects = ((current.y > stagePoint.y) !== (next.y > stagePoint.y))
        && (
          stagePoint.x
          < ((next.x - current.x) * (stagePoint.y - current.y)) / ((next.y - current.y) || 1e-9) + current.x
        );
      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  };

  // This helper stores initial drag geometry for one chosen slot set.
  const captureInitialPoints = (slots: SlotKey[]): Partial<Record<SlotKey, Point>> => {
    return slots.reduce<Partial<Record<SlotKey, Point>>>((snapshot, slot) => {
      if (points[slot]) {
        snapshot[slot] = points[slot]!;
      }
      return snapshot;
    }, {});
  };

  // This helper clamps group movement so dragged geometry stays inside video bounds.
  const clampGroupDelta = (slots: SlotKey[], initialPoints: Partial<Record<SlotKey, Point>>, dx: number, dy: number) => {
    const slotPoints = slots.map((slot) => initialPoints[slot]).filter(Boolean) as Point[];
    if (slotPoints.length === 0) {
      return { dx: 0, dy: 0 };
    }

    const maxX = Math.max(videoSize.width - 1, 0);
    const maxY = Math.max(videoSize.height - 1, 0);
    const minDx = Math.max(...slotPoints.map((point) => -point.x));
    const maxDx = Math.min(...slotPoints.map((point) => maxX - point.x));
    const minDy = Math.max(...slotPoints.map((point) => -point.y));
    const maxDy = Math.min(...slotPoints.map((point) => maxY - point.y));

    return {
      dx: Math.min(Math.max(Math.round(dx), minDx), maxDx),
      dy: Math.min(Math.max(Math.round(dy), minDy), maxDy),
    };
  };

  // This helper nudges the selected point with a small configurable pixel step.
  const nudgeSelectedPoint = (axis: keyof Point, delta: number) => {
    if (!selectedSlot || !points[selectedSlot]) {
      return;
    }

    const nextPoint = clampPointToVideo({
      ...points[selectedSlot]!,
      [axis]: points[selectedSlot]![axis] + delta,
    });

    setPoints((previous) => ({
      ...previous,
      [selectedSlot]: nextPoint,
    }));
  };

  // This helper finds the next still-empty slot after the current active one.
  const advanceToNextEmptySlot = (currentSlot: SlotKey) => {
    const currentIndex = SLOT_ORDER.indexOf(currentSlot);
    for (let offset = 1; offset <= SLOT_ORDER.length; offset += 1) {
      const candidate = SLOT_ORDER[(currentIndex + offset) % SLOT_ORDER.length];
      if (!points[candidate]) {
        setActiveSlot(candidate);
        return;
      }
    }
  };

  // Pointer-down selects or starts dragging shapes already defined on screen.
  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const nativePoint = pointerToNative(event.clientX, event.clientY);
    const stagePoint = pointerToStageLocal(event.clientX, event.clientY);
    if (!nativePoint || !stagePoint) {
      return;
    }

    const nearbySlot = findNearbySlot(stagePoint);
    if (nearbySlot && points[nearbySlot]) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedSlot(nearbySlot);
      setActiveSlot(nearbySlot);
      setDragInteraction({
        kind: "point",
        pointerId: event.pointerId,
        slots: [nearbySlot],
        startPointer: nativePoint,
        initialPoints: captureInitialPoints([nearbySlot]),
      });
      return;
    }

    const draggableLine = findDraggableLine(stagePoint);
    if (draggableLine) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedSlot(draggableLine[0]);
      setActiveSlot(draggableLine[0]);
      setDragInteraction({
        kind: "line",
        pointerId: event.pointerId,
        slots: draggableLine,
        startPointer: nativePoint,
        initialPoints: captureInitialPoints(draggableLine),
      });
      return;
    }

    if (isInsideDisplayedRoi(stagePoint)) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedSlot("r1");
      setActiveSlot("r1");
      setDragInteraction({
        kind: "roi",
        pointerId: event.pointerId,
        slots: ROI_SLOT_ORDER,
        startPointer: nativePoint,
        initialPoints: captureInitialPoints(ROI_SLOT_ORDER),
      });
      return;
    }

    // We only place a new point by background click when the active slot is still empty.
    if (!points[activeSlot]) {
      const clampedPoint = clampPointToVideo(nativePoint);
      setPoints((previous) => ({
        ...previous,
        [activeSlot]: clampedPoint,
      }));
      setSelectedSlot(activeSlot);
      advanceToNextEmptySlot(activeSlot);
    }
  };

  // Pointer-move updates hover metrics and applies drag deltas when active.
  const handleStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const nativePoint = pointerToNative(event.clientX, event.clientY);
    setCursor(nativePoint);

    if (!dragInteraction || dragInteraction.pointerId !== event.pointerId || !nativePoint) {
      return;
    }

    const deltaX = nativePoint.x - dragInteraction.startPointer.x;
    const deltaY = nativePoint.y - dragInteraction.startPointer.y;

    if (dragInteraction.kind === "point") {
      const slot = dragInteraction.slots[0];
      const initialPoint = dragInteraction.initialPoints[slot];
      if (!slot || !initialPoint) {
        return;
      }

      const nextPoint = clampPointToVideo({
        x: initialPoint.x + deltaX,
        y: initialPoint.y + deltaY,
      });

      setPoints((previous) => ({
        ...previous,
        [slot]: nextPoint,
      }));
      return;
    }

    const clampedDelta = clampGroupDelta(
      dragInteraction.slots,
      dragInteraction.initialPoints,
      deltaX,
      deltaY,
    );

    setPoints((previous) => {
      const nextPoints = { ...previous };
      dragInteraction.slots.forEach((slot) => {
        const initialPoint = dragInteraction.initialPoints[slot];
        if (!initialPoint) {
          return;
        }

        nextPoints[slot] = {
          x: initialPoint.x + clampedDelta.dx,
          y: initialPoint.y + clampedDelta.dy,
        };
      });
      return nextPoints;
    });
  };

  // Pointer-up ends any active drag and releases capture safely.
  const handleStagePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragInteraction(null);
  };

  // Pointer-cancel shares the same cleanup path as normal drag end.
  const handleStagePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragInteraction(null);
  };

  // Leaving the stage should only clear cursor when no drag is in progress.
  const handleStagePointerLeave = () => {
    if (!dragInteraction) {
      setCursor(null);
    }
  };

  // We render full calibration panel.
  return (
    <section className="panel panel-calibration">
      <h2 className="panel-title">Line Calibration Tool (A/B)</h2>
      <p className="panel-subtitle">
        Paste a local video path or URL, click on frame to set endpoints, and copy YAML coordinates for `line_a` and `line_b`.
      </p>
      <p className="disclaimer-text">Doar pentru divertisment. Nu este masurare legala.</p>

      <div className="calibration-url-row">
        <input
          className="field-input"
          value={inputUrl}
          onChange={(event) => setInputUrl(event.target.value)}
          placeholder="data/input/sample.mp4"
        />
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setLoadError(null);
            // We reset paused preview state before loading a new source.
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
            }
            setVideoUrl(toCalibrationVideoUrl(inputUrl));
          }}
        >
          Load Video
        </button>
      </div>

      <div className="calibration-layout">
        <div
          className="calibration-stage"
          ref={stageRef}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerCancel}
          onPointerLeave={handleStagePointerLeave}
        >
          <video
            ref={videoRef}
            className="calibration-video"
            src={videoUrl || undefined}
            controls
            preload="metadata"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              setVideoSize({ width: video.videoWidth, height: video.videoHeight });
              setDisplaySize({ width: video.clientWidth, height: video.clientHeight });
              // We keep preview paused at the beginning until user presses play.
              video.pause();
              video.currentTime = 0;
            }}
            onError={() => {
              setLoadError("Video could not be loaded. Check URL and server availability.");
            }}
          />

          <svg className="calibration-overlay" width={displaySize.width} height={displaySize.height}>
            {showRoiOverlay && roiDisplayPolygon ? (
              <polygon points={roiDisplayPolygon} className="cal-roi-polygon" />
            ) : null}
            {displayPoints.a1 && displayPoints.a2 ? (
              <line x1={displayPoints.a1.x} y1={displayPoints.a1.y} x2={displayPoints.a2.x} y2={displayPoints.a2.y} className="cal-line-a" />
            ) : null}
            {displayPoints.b1 && displayPoints.b2 ? (
              <line x1={displayPoints.b1.x} y1={displayPoints.b1.y} x2={displayPoints.b2.x} y2={displayPoints.b2.y} className="cal-line-b" />
            ) : null}
            {Object.entries(displayPoints).map(([key, point]) =>
              point ? (
                <circle
                  key={key}
                  cx={point.x}
                  cy={point.y}
                  r={selectedSlot === key ? 9 : 6}
                  className={selectedSlot === key ? "cal-point cal-point-active" : "cal-point"}
                />
              ) : null
            )}
          </svg>
        </div>

        <aside className="calibration-sidebar">
          <div className="calibration-metric-grid">
            <div className="calibration-metric">
              <span className="stat-label">Cursor X</span>
              <strong>{cursor ? cursor.x : "-"}</strong>
            </div>
            <div className="calibration-metric">
              <span className="stat-label">Cursor Y</span>
              <strong>{cursor ? cursor.y : "-"}</strong>
            </div>
            <div className="calibration-metric">
              <span className="stat-label">Video Width</span>
              <strong>{videoSize.width || "-"}</strong>
            </div>
            <div className="calibration-metric">
              <span className="stat-label">Video Height</span>
              <strong>{videoSize.height || "-"}</strong>
            </div>
          </div>

          <label className="calibration-toggle-row">
            <input
              type="checkbox"
              checked={showRoiOverlay}
              onChange={(event) => setShowRoiOverlay(event.target.checked)}
            />
            <span>Show ROI overlay</span>
          </label>

          <label className="field-label" htmlFor="slotSelect">
            Active slot (next click)
          </label>
          <select
            id="slotSelect"
            className="field-input"
            value={activeSlot}
            onChange={(event) => {
              const nextSlot = event.target.value as SlotKey;
              setActiveSlot(nextSlot);
              setSelectedSlot(nextSlot);
            }}
          >
            {SLOT_ORDER.map((slot) => (
              <option key={slot} value={slot}>
                {SLOT_LABELS[slot]}
              </option>
            ))}
          </select>

          {selectedSlot && points[selectedSlot] ? (
            <section className="calibration-section-card">
              <div className="calibration-section-heading">
                <span>Selected point</span>
                <span className="calibration-section-note">{SLOT_LABELS[selectedSlot]}</span>
              </div>

              <div className="calibration-selected-point-meta">
                <span>X: {points[selectedSlot]!.x}</span>
                <span>Y: {points[selectedSlot]!.y}</span>
              </div>

              <label className="calibration-point-input-group">
                <span>Step (px)</span>
                <input
                  className="calibration-number-input"
                  type="number"
                  min={1}
                  value={nudgeStep}
                  onChange={(event) => setNudgeStep(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>

              <div className="calibration-nudge-grid">
                <button type="button" className="btn-secondary calibration-nudge-btn" onClick={() => nudgeSelectedPoint("x", -nudgeStep)}>
                  X -{nudgeStep}
                </button>
                <button type="button" className="btn-secondary calibration-nudge-btn" onClick={() => nudgeSelectedPoint("x", nudgeStep)}>
                  X +{nudgeStep}
                </button>
                <button type="button" className="btn-secondary calibration-nudge-btn" onClick={() => nudgeSelectedPoint("y", -nudgeStep)}>
                  Y -{nudgeStep}
                </button>
                <button type="button" className="btn-secondary calibration-nudge-btn" onClick={() => nudgeSelectedPoint("y", nudgeStep)}>
                  Y +{nudgeStep}
                </button>
              </div>

              <p className="calibration-editor-hint">
                Drag punctul, trage linia direct din segment sau muta tot ROI-ul din interiorul poligonului.
              </p>
            </section>
          ) : null}

          <section className="calibration-section-card">
            <button
              type="button"
              className="calibration-section-toggle"
              onClick={() => setShowLineSection((previous) => !previous)}
              aria-expanded={showLineSection}
            >
              <span className="calibration-section-heading">
                <span>Line points</span>
                <span className="calibration-section-note">A + B</span>
              </span>
              <span className="calibration-section-chevron">{showLineSection ? "Hide" : "Show"}</span>
            </button>

            {showLineSection ? (
              <div className="calibration-points-list">
                {LINE_SLOT_ORDER.map((slot) => (
                  <div key={slot} className={`calibration-point-row ${activeSlot === slot || selectedSlot === slot ? "calibration-point-row-active" : ""}`}>
                    <span className="calibration-point-label">{SLOT_LABELS[slot]}</span>
                    <div className="calibration-point-inputs">
                      <label className="calibration-point-input-group">
                        <span>X</span>
                        <input
                          className="calibration-number-input"
                          type="number"
                          value={pointDrafts[slot].x}
                          placeholder="x"
                          onChange={(event) => updatePointDraft(slot, "x", event.target.value)}
                          onFocus={() => {
                            setActiveSlot(slot);
                            setSelectedSlot(slot);
                          }}
                          onBlur={() => commitPointAxis(slot, "x")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              commitPointAxis(slot, "x");
                            }
                          }}
                        />
                      </label>
                      <label className="calibration-point-input-group">
                        <span>Y</span>
                        <input
                          className="calibration-number-input"
                          type="number"
                          value={pointDrafts[slot].y}
                          placeholder="y"
                          onChange={(event) => updatePointDraft(slot, "y", event.target.value)}
                          onFocus={() => {
                            setActiveSlot(slot);
                            setSelectedSlot(slot);
                          }}
                          onBlur={() => commitPointAxis(slot, "y")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              commitPointAxis(slot, "y");
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="calibration-section-card">
            <button
              type="button"
              className="calibration-section-toggle"
              onClick={() => setShowRoiSection((previous) => !previous)}
              aria-expanded={showRoiSection}
            >
              <span className="calibration-section-heading">
                <span>ROI polygon</span>
                <span className="calibration-section-note">Green overlay</span>
              </span>
              <span className="calibration-section-chevron">{showRoiSection ? "Hide" : "Show"}</span>
            </button>

            {showRoiSection ? (
              <div className="calibration-points-list">
                {ROI_SLOT_ORDER.map((slot) => (
                  <div key={slot} className={`calibration-point-row ${activeSlot === slot || selectedSlot === slot ? "calibration-point-row-active" : ""}`}>
                    <span className="calibration-point-label">{SLOT_LABELS[slot]}</span>
                    <div className="calibration-point-inputs">
                      <label className="calibration-point-input-group">
                        <span>X</span>
                        <input
                          className="calibration-number-input"
                          type="number"
                          value={pointDrafts[slot].x}
                          placeholder="x"
                          onChange={(event) => updatePointDraft(slot, "x", event.target.value)}
                          onFocus={() => {
                            setActiveSlot(slot);
                            setSelectedSlot(slot);
                          }}
                          onBlur={() => commitPointAxis(slot, "x")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              commitPointAxis(slot, "x");
                            }
                          }}
                        />
                      </label>
                      <label className="calibration-point-input-group">
                        <span>Y</span>
                        <input
                          className="calibration-number-input"
                          type="number"
                          value={pointDrafts[slot].y}
                          placeholder="y"
                          onChange={(event) => updatePointDraft(slot, "y", event.target.value)}
                          onFocus={() => {
                            setActiveSlot(slot);
                            setSelectedSlot(slot);
                          }}
                          onBlur={() => commitPointAxis(slot, "y")}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              commitPointAxis(slot, "y");
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <div className="calibration-actions">
            <button type="button" className="btn-secondary" onClick={applyYamlToPreview}>
              Apply pasted YAML
            </button>
            <button type="button" className="btn-primary" onClick={copyYaml}>
              Copy YAML
            </button>
            <button type="button" className="btn-secondary" onClick={clearPoints}>
              Clear points
            </button>
          </div>

          <label className="field-label" htmlFor="calibrationYamlEditor">
            YAML editor / paste box
          </label>
          <textarea
            id="calibrationYamlEditor"
            className="calibration-yaml-editor"
            value={yamlEditorValue}
            onChange={(event) => {
              setYamlEditorValue(event.target.value);
              setYamlEditorMessage(null);
            }}
            spellCheck={false}
          />

          {yamlEditorMessage ? <p className="calibration-editor-message">{yamlEditorMessage}</p> : null}

          {loadError ? <p className="error-text">{loadError}</p> : null}
        </aside>
      </div>
    </section>
  );
}
