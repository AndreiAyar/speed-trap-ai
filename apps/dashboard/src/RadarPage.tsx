// Radar page simulates a speed-radar capture screen for tablet demos.
import { useEffect, useState } from "react";

// We keep the mandatory entertainment disclaimer in a single constant.
const RADAR_DISCLAIMER = "Doar pentru divertisment. Nu este masurare legala.";

// Clamp helper keeps percentage values inside valid screen-relative bounds.
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Radar page offers a full-screen capture view plus scrollable control panel.
export function RadarPage() {
  // We store selected local image so we can show metadata and allow re-selection.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // We store object URL used by the image element for local preview rendering.
  const [imageUrl, setImageUrl] = useState<string>("");

  // We store synthetic speed value shown as flashing radar measurement.
  const [speedKmh, setSpeedKmh] = useState<number>(153);

  // We store amount of blur for the simulated "high speed" camera effect.
  const [blurPx, setBlurPx] = useState<number>(1.8);

  // We store bounding box horizontal position as percentage from left.
  const [boxX, setBoxX] = useState<number>(46);

  // We store bounding box vertical position as percentage from top.
  const [boxY, setBoxY] = useState<number>(42);

  // We store bounding box width as percentage of stage width.
  const [boxWidth, setBoxWidth] = useState<number>(21);

  // We store bounding box height as percentage of stage height.
  const [boxHeight, setBoxHeight] = useState<number>(24);

  // We keep X valid when width changes so the box can still reach right edge.
  useEffect(() => {
    setBoxX((previous) => clamp(previous, 0, Math.max(0, 100 - boxWidth)));
  }, [boxWidth]);

  // We keep Y valid when height changes so the box can still reach bottom edge.
  useEffect(() => {
    setBoxY((previous) => clamp(previous, 0, Math.max(0, 100 - boxHeight)));
  }, [boxHeight]);

  // We regenerate and clean up object URLs whenever selected file changes.
  useEffect(() => {
    // We clear preview when no image is selected.
    if (!selectedFile) {
      setImageUrl("");
      return;
    }

    // We create a local browser URL for the selected image.
    const objectUrl = URL.createObjectURL(selectedFile);
    setImageUrl(objectUrl);

    // We release URL memory when file changes or component unmounts.
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  // We render the radar-style page with full-screen stage and settings below.
  return (
    <main className="radar-shell">
      <section className="radar-stage">
        {imageUrl ? (
          <img
            className="radar-image"
            src={imageUrl}
            alt="Cadru incarcat pentru simulare radar"
            style={{
              // We combine blur and color tuning for a believable radar monitor mood.
              filter: `blur(${blurPx}px) contrast(1.15) saturate(0.82) hue-rotate(-12deg) brightness(0.9)`,
            }}
          />
        ) : (
          <div className="radar-placeholder">
            Incarca o poza din setarile de mai jos ca sa porneasca simularea radar.
          </div>
        )}

        {/* Overlay layers add scan lines and HUD glow regardless of image state. */}
        <div className="radar-overlay-scan" aria-hidden="true" />
        <div className="radar-overlay-vignette" aria-hidden="true" />

        {imageUrl ? (
          <div
            className="radar-bbox"
            style={{
              left: `${boxX}%`,
              top: `${boxY}%`,
              width: `${boxWidth}%`,
              height: `${boxHeight}%`,
            }}
          >
            <div className="radar-bbox-corners" />
          </div>
        ) : null}

        {imageUrl ? (
          <p
            className="radar-speed-flash"
            style={{
              // We keep the label just under the bounding box in stage coordinates.
              left: `${boxX}%`,
              top: `${Math.min(94, boxY + boxHeight + 1.5)}%`,
            }}
          >
            {Math.max(0, Math.round(speedKmh))} KM/h
          </p>
        ) : null}

        <div className="radar-hud-top">
          <span>RADAR-CAM 04</span>
          <span>TRACK LOCK</span>
          <span>AUTO MODE</span>
        </div>

        <p className="radar-disclaimer-overlay">{RADAR_DISCLAIMER}</p>
      </section>

      <section className="radar-controls">
        <p className="eyebrow">Speed Trap AI</p>
        <h1 className="radar-title">Setari Simulare Radar</h1>
        <p className="panel-subtitle">
          Incarca poza, pozitioneaza chenarul pe masina si ajusteaza efectele de captura.
        </p>

        <form className="upload-form">
          <label htmlFor="radar-video-input" className="field-label">
            Poza input
          </label>
          <input
            id="radar-video-input"
            className="field-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              // We read first selected file and keep only image files.
              const nextFile = event.currentTarget.files?.[0] ?? null;
              if (nextFile && nextFile.type.startsWith("image/")) {
                setSelectedFile(nextFile);
                return;
              }

              // We clear state when selection is empty or invalid.
              setSelectedFile(null);
            }}
          />
        </form>

        <div className="radar-controls-grid">
          <label className="radar-control">
            <span>Viteza afisata (KM/h)</span>
            <input
              className="field-input"
              type="number"
              min={0}
              max={400}
              step={1}
              value={speedKmh}
              onChange={(event) => {
                // We parse numeric input and keep previous value when input is invalid.
                const nextValue = Number(event.currentTarget.value);
                if (Number.isFinite(nextValue)) {
                  setSpeedKmh(nextValue);
                }
              }}
            />
          </label>

          <label className="radar-control">
            <span>Blur imagine: {blurPx.toFixed(1)} px</span>
            <input
              type="range"
              min={0}
              max={8}
              step={0.1}
              value={blurPx}
              onChange={(event) => {
                // We update blur slider in real-time.
                setBlurPx(Number(event.currentTarget.value));
              }}
            />
          </label>

          <label className="radar-control">
            <span>Chenar X (din ecran): {boxX.toFixed(1)}%</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, 100 - boxWidth)}
              step={0.1}
              value={boxX}
              onChange={(event) => {
                // We move box on horizontal axis.
                const nextValue = Number(event.currentTarget.value);
                setBoxX(clamp(nextValue, 0, Math.max(0, 100 - boxWidth)));
              }}
            />
          </label>

          <label className="radar-control">
            <span>Chenar Y (din ecran): {boxY.toFixed(1)}%</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, 100 - boxHeight)}
              step={0.1}
              value={boxY}
              onChange={(event) => {
                // We move box on vertical axis.
                const nextValue = Number(event.currentTarget.value);
                setBoxY(clamp(nextValue, 0, Math.max(0, 100 - boxHeight)));
              }}
            />
          </label>

          <label className="radar-control">
            <span>Latime chenar: {boxWidth.toFixed(1)}%</span>
            <input
              type="range"
              min={1}
              max={Math.max(1, 100 - boxX)}
              step={0.1}
              value={boxWidth}
              onChange={(event) => {
                // We scale box width in stage-relative percentages.
                const nextValue = Number(event.currentTarget.value);
                setBoxWidth(clamp(nextValue, 1, Math.max(1, 100 - boxX)));
              }}
            />
          </label>

          <label className="radar-control">
            <span>Inaltime chenar: {boxHeight.toFixed(1)}%</span>
            <input
              type="range"
              min={1}
              max={Math.max(1, 100 - boxY)}
              step={0.1}
              value={boxHeight}
              onChange={(event) => {
                // We scale box height in stage-relative percentages.
                const nextValue = Number(event.currentTarget.value);
                setBoxHeight(clamp(nextValue, 1, Math.max(1, 100 - boxY)));
              }}
            />
          </label>
        </div>

        <p className="radar-file-name">{selectedFile?.name ?? "Nicio poza selectata."}</p>
        <p className="disclaimer-text">{RADAR_DISCLAIMER}</p>
      </section>
    </main>
  );
}
