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
const DEFAULT_CALIBRATION_PATH = "/Users/ayar/Personal Dev/speed-trap-ai/data/input/sample.mp4";

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

  // We hold ref to video element for metadata and size reads.
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // We hold ref to stage wrapper where pointer events are captured.
  const stageRef = useRef<HTMLDivElement | null>(null);

  // This helper updates one axis of one point from manual numeric input.
  const updatePointAxis = (slot: SlotKey, axis: keyof Point, rawValue: string) => {
    // We parse user input as integer pixel coordinate.
    const parsedValue = Number.parseInt(rawValue, 10);

    // We ignore invalid intermediate text values.
    if (!Number.isFinite(parsedValue)) {
      setPoints((previous) => ({
        ...previous,
        [slot]: previous[slot],
      }));
      return;
    }

    // We clamp values to loaded video bounds when metadata is available.
    const maxX = Math.max(videoSize.width - 1, 0);
    const maxY = Math.max(videoSize.height - 1, 0);
    const clampedValue = axis === "x"
      ? Math.min(Math.max(parsedValue, 0), maxX || parsedValue)
      : Math.min(Math.max(parsedValue, 0), maxY || parsedValue);

    // We create missing point object on first manual edit.
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
  };

  // We optionally auto-load suggested URL only while input still matches the default sample path.
  useEffect(() => {
    if (suggestedUrl && inputUrl === DEFAULT_CALIBRATION_PATH && !videoUrl) {
      setInputUrl(suggestedUrl);
      setVideoUrl(toCalibrationVideoUrl(suggestedUrl));
    }
  }, [inputUrl, suggestedUrl, videoUrl]);

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

  // This helper maps pointer client coordinates to native video coordinates.
  const pointerToNative = (clientX: number, clientY: number): Point | null => {
    const stage = stageRef.current;
    if (!stage || videoSize.width <= 0 || videoSize.height <= 0) {
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

    // We map local offsets from display space to native video pixels.
    const x = Math.round((localX / rect.width) * (videoSize.width - 1));
    const y = Math.round((localY / rect.height) * (videoSize.height - 1));

    // We return converted native point.
    return { x, y };
  };

  // This handler updates live cursor coordinates while hovering stage.
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const next = pointerToNative(event.clientX, event.clientY);
    setCursor(next);
  };

  // This handler clears cursor state when leaving stage area.
  const handlePointerLeave = () => {
    setCursor(null);
  };

  // This handler writes clicked coordinate into active slot and auto-advances.
  const handleStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const point = pointerToNative(event.clientX, event.clientY);
    if (!point) {
      return;
    }

    // We write selected point into currently active slot.
    setPoints((previous) => ({
      ...previous,
      [activeSlot]: point,
    }));

    // We auto-advance selection to the next slot for faster setup.
    const currentIndex = SLOT_ORDER.indexOf(activeSlot);
    const nextIndex = (currentIndex + 1) % SLOT_ORDER.length;
    setActiveSlot(SLOT_ORDER[nextIndex]);
  };

  // This helper clears all selected points in one action.
  const clearPoints = () => {
    setPoints({ a1: null, a2: null, b1: null, b2: null, r1: null, r2: null, r3: null, r4: null });
    setActiveSlot("a1");
  };

  // We compute YAML snippet for easy copy into camera config.
  const yamlSnippet = useMemo(() => {
    const lineA = points.a1 && points.a2 ? `line_a:\n  - [${points.a1.x}, ${points.a1.y}]\n  - [${points.a2.x}, ${points.a2.y}]` : "line_a:\n  - [x1, y1]\n  - [x2, y2]";
    const lineB = points.b1 && points.b2 ? `line_b:\n  - [${points.b1.x}, ${points.b1.y}]\n  - [${points.b2.x}, ${points.b2.y}]` : "line_b:\n  - [x1, y1]\n  - [x2, y2]";
    const roiPolygon = ROI_SLOT_ORDER.every((slot) => points[slot])
      ? `roi_polygon:\n  - [${points.r1!.x}, ${points.r1!.y}]\n  - [${points.r2!.x}, ${points.r2!.y}]\n  - [${points.r3!.x}, ${points.r3!.y}]\n  - [${points.r4!.x}, ${points.r4!.y}]`
      : "roi_polygon:\n  - [x1, y1]\n  - [x2, y2]\n  - [x3, y3]\n  - [x4, y4]";
    return `${lineA}\n\n${lineB}\n\n${roiPolygon}`;
  }, [points]);

  // This helper copies generated YAML to clipboard when available.
  const copyYaml = async () => {
    try {
      await navigator.clipboard.writeText(yamlSnippet);
    } catch {
      // We silently ignore clipboard failures in restricted contexts.
    }
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

  // We render full calibration panel.
  return (
    <section className="panel panel-calibration">
      <h2 className="panel-title">Line Calibration Tool (A/B)</h2>
      <p className="panel-subtitle">
        Paste a local video path or URL, click on frame to set endpoints, and copy YAML coordinates for `line_a` and `line_b`.
      </p>

      <div className="calibration-url-row">
        <input
          className="field-input"
          value={inputUrl}
          onChange={(event) => setInputUrl(event.target.value)}
          placeholder="/Users/ayar/Personal Dev/speed-trap-ai/data/input/3.mp4"
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
          onMouseMove={handlePointerMove}
          onMouseLeave={handlePointerLeave}
          onClick={handleStageClick}
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
              point ? <circle key={key} cx={point.x} cy={point.y} r={6} className="cal-point" /> : null
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
            onChange={(event) => setActiveSlot(event.target.value as SlotKey)}
          >
            {SLOT_ORDER.map((slot) => (
              <option key={slot} value={slot}>
                {SLOT_LABELS[slot]}
              </option>
            ))}
          </select>

          <div className="calibration-points-list">
            {LINE_SLOT_ORDER.map((slot) => (
              <div key={slot} className={`calibration-point-row ${activeSlot === slot ? "calibration-point-row-active" : ""}`}>
                <span className="calibration-point-label">{SLOT_LABELS[slot]}</span>
                <div className="calibration-point-inputs">
                  <label className="calibration-point-input-group">
                    <span>X</span>
                    <input
                      className="calibration-number-input"
                      type="number"
                      value={points[slot]?.x ?? ""}
                      placeholder="x"
                      onChange={(event) => updatePointAxis(slot, "x", event.target.value)}
                    />
                  </label>
                  <label className="calibration-point-input-group">
                    <span>Y</span>
                    <input
                      className="calibration-number-input"
                      type="number"
                      value={points[slot]?.y ?? ""}
                      placeholder="y"
                      onChange={(event) => updatePointAxis(slot, "y", event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="calibration-section-heading">
            <span>ROI polygon</span>
            <span className="calibration-section-note">Green overlay</span>
          </div>

          <div className="calibration-points-list">
            {ROI_SLOT_ORDER.map((slot) => (
              <div key={slot} className={`calibration-point-row ${activeSlot === slot ? "calibration-point-row-active" : ""}`}>
                <span className="calibration-point-label">{SLOT_LABELS[slot]}</span>
                <div className="calibration-point-inputs">
                  <label className="calibration-point-input-group">
                    <span>X</span>
                    <input
                      className="calibration-number-input"
                      type="number"
                      value={points[slot]?.x ?? ""}
                      placeholder="x"
                      onChange={(event) => updatePointAxis(slot, "x", event.target.value)}
                    />
                  </label>
                  <label className="calibration-point-input-group">
                    <span>Y</span>
                    <input
                      className="calibration-number-input"
                      type="number"
                      value={points[slot]?.y ?? ""}
                      placeholder="y"
                      onChange={(event) => updatePointAxis(slot, "y", event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="calibration-actions">
            <button type="button" className="btn-primary" onClick={copyYaml}>
              Copy YAML
            </button>
            <button type="button" className="btn-secondary" onClick={clearPoints}>
              Clear points
            </button>
          </div>

          <pre className="calibration-yaml-preview">{yamlSnippet}</pre>

          {loadError ? <p className="error-text">{loadError}</p> : null}
        </aside>
      </div>
    </section>
  );
}
