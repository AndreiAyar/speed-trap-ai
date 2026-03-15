// React effect helps us tune document metadata for the presentation route.
import { useEffect } from "react";

// Lightweight TypeScript aliases make the fake presentation data easy to read.
type PresentationMetric = {
  label: string;
  value: string;
  note: string;
};

type PresentationFeed = {
  id: string;
  sector: string;
  corridor: string;
  imageUrl: string;
  speedLimitKmh: number;
  averageSpeedKmh: number;
  topSpeedKmh: number;
  alertsLastHour: number;
  focusNote: string;
  occupancyLabel: string;
  trend: number[];
};

type HotListEntry = {
  sector: string;
  plateMask: string;
  vehicleLabel: string;
  speedKmh: number;
  overLimitKmh: number;
  timeLabel: string;
};

type SectorBoard = {
  sector: string;
  corridor: string;
  alertCount: number;
  complianceRate: string;
  drivers: Array<{
    plateMask: string;
    speedKmh: number;
    note: string;
  }>;
};

// Fake KPI cards set the tone quickly for the presentation video.
const presentationMetrics: PresentationMetric[] = [
  {
    label: "Camere in perete video",
    value: "04",
    note: "feed-uri simulate, afisate simultan",
  },
  {
    label: "Alerte > 90 km/h",
    value: "28",
    note: "ultimele 60 de minute",
  },
  {
    label: "Viteza maxima",
    value: "154 km/h",
    note: "captura demo pe Centura Est",
  },
  {
    label: "Sectoare cu risc ridicat",
    value: "03",
    note: "depasesc media serii",
  },
];

// Each feed gets its own look, story, and summary so the grid feels alive.
const presentationFeeds: PresentationFeed[] = [
  {
    id: "CAM-01",
    sector: "Sector A1",
    corridor: "Centura Est / intrare oras",
    imageUrl: "/presentation/sector-est.svg",
    speedLimitKmh: 70,
    averageSpeedKmh: 84,
    topSpeedKmh: 154,
    alertsLastHour: 8,
    focusNote: "varf de acceleratie pe banda a doua",
    occupancyLabel: "Flux intens",
    trend: [48, 54, 62, 66, 74, 78, 82, 76],
  },
  {
    id: "CAM-02",
    sector: "Sector B3",
    corridor: "Pasaj Vest / apus",
    imageUrl: "/presentation/sector-apus.svg",
    speedLimitKmh: 60,
    averageSpeedKmh: 73,
    topSpeedKmh: 138,
    alertsLastHour: 6,
    focusNote: "iesire agresiva din coloana centrala",
    occupancyLabel: "Flux dens",
    trend: [34, 38, 42, 49, 57, 61, 58, 63],
  },
  {
    id: "CAM-03",
    sector: "Sector C2",
    corridor: "Coridor bus + banda rapida",
    imageUrl: "/presentation/sector-bus.svg",
    speedLimitKmh: 50,
    averageSpeedKmh: 66,
    topSpeedKmh: 121,
    alertsLastHour: 9,
    focusNote: "accelerari scurte intre statii",
    occupancyLabel: "Flux mixt",
    trend: [27, 29, 35, 44, 51, 56, 61, 67],
  },
  {
    id: "CAM-04",
    sector: "Sector D5",
    corridor: "Splai Sud / sens dublu",
    imageUrl: "/presentation/sector-splai.svg",
    speedLimitKmh: 70,
    averageSpeedKmh: 79,
    topSpeedKmh: 145,
    alertsLastHour: 5,
    focusNote: "pluton rapid pe directia de iesire",
    occupancyLabel: "Flux mediu",
    trend: [41, 45, 47, 52, 58, 61, 65, 69],
  },
];

// Global hot list gives the page a strong "captured speeders" narrative.
const hotListEntries: HotListEntry[] = [
  {
    sector: "Centura Est",
    plateMask: "TM-**-421",
    vehicleLabel: "sedan gri",
    speedKmh: 154,
    overLimitKmh: 84,
    timeLabel: "19:42",
  },
  {
    sector: "Pasaj Vest",
    plateMask: "AR-**-908",
    vehicleLabel: "coupe negru",
    speedKmh: 145,
    overLimitKmh: 85,
    timeLabel: "19:37",
  },
  {
    sector: "Splai Sud",
    plateMask: "CS-**-117",
    vehicleLabel: "SUV alb",
    speedKmh: 139,
    overLimitKmh: 69,
    timeLabel: "19:33",
  },
  {
    sector: "Pasaj Vest",
    plateMask: "TM-**-552",
    vehicleLabel: "hatchback albastru",
    speedKmh: 138,
    overLimitKmh: 78,
    timeLabel: "19:28",
  },
  {
    sector: "Coridor Bus",
    plateMask: "HD-**-605",
    vehicleLabel: "berlina rosie",
    speedKmh: 121,
    overLimitKmh: 71,
    timeLabel: "19:24",
  },
  {
    sector: "Centura Est",
    plateMask: "TM-**-214",
    vehicleLabel: "SUV negru",
    speedKmh: 118,
    overLimitKmh: 48,
    timeLabel: "19:18",
  },
];

// Sector cards make it obvious that each corridor has its own list of offenders.
const sectorBoards: SectorBoard[] = [
  {
    sector: "Sector A1",
    corridor: "Centura Est / intrare oras",
    alertCount: 8,
    complianceRate: "61%",
    drivers: [
      { plateMask: "TM-**-421", speedKmh: 154, note: "sedan gri / banda 2" },
      { plateMask: "TM-**-214", speedKmh: 118, note: "SUV negru / intrare sud" },
      { plateMask: "GJ-**-903", speedKmh: 111, note: "berlina alba / depasire dubla" },
    ],
  },
  {
    sector: "Sector B3",
    corridor: "Pasaj Vest / apus",
    alertCount: 6,
    complianceRate: "68%",
    drivers: [
      { plateMask: "AR-**-908", speedKmh: 145, note: "coupe negru / banda rapida" },
      { plateMask: "TM-**-552", speedKmh: 138, note: "hatchback albastru / zona rampa" },
      { plateMask: "BH-**-771", speedKmh: 109, note: "sedan argintiu / iesire pasaj" },
    ],
  },
  {
    sector: "Sector C2",
    corridor: "Coridor bus + banda rapida",
    alertCount: 9,
    complianceRate: "54%",
    drivers: [
      { plateMask: "HD-**-605", speedKmh: 121, note: "berlina rosie / statia 2" },
      { plateMask: "TM-**-810", speedKmh: 112, note: "compact alb / schimbare banda" },
      { plateMask: "MH-**-091", speedKmh: 107, note: "SUV albastru / sens centru" },
    ],
  },
  {
    sector: "Sector D5",
    corridor: "Splai Sud / sens dublu",
    alertCount: 5,
    complianceRate: "72%",
    drivers: [
      { plateMask: "CS-**-117", speedKmh: 139, note: "SUV alb / iesire pod" },
      { plateMask: "TM-**-642", speedKmh: 127, note: "sedan albastru / banda 1" },
      { plateMask: "AB-**-322", speedKmh: 103, note: "van alb / pluton rapid" },
    ],
  },
];

// Small helper keeps numeric speed formatting consistent across the page.
const formatSpeed = (speedKmh: number) => `${speedKmh} km/h`;

// Presentation view is a self-contained page meant for video demos and pitch decks.
export function PresentationPage() {
  // On mount we switch the body theme so the presentation can own the full screen mood.
  useEffect(() => {
    const previousTitle = document.title;
    document.body.dataset.view = "presentation";
    document.title = "Depasirea Vitezei | Speed Trap AI";

    return () => {
      delete document.body.dataset.view;
      document.title = previousTitle;
    };
  }, []);

  // We keep the strongest offender handy for the lead hero card.
  const topCapture = hotListEntries[0];

  return (
    <main className="presentation-shell">
      <section className="presentation-hero">
        <div className="presentation-hero-copy">
          <p className="presentation-kicker">Centrul Demo de Monitorizare</p>
          <h1>Depasirea Vitezei</h1>
          <p className="presentation-lead">
            Dashboard de prezentare cu perete video, statistici emulate si lista cu
            vitezomanii surprinsi pe fiecare sector de trafic.
          </p>
        </div>

        <aside className="presentation-disclaimer-card">
          <span className="presentation-tag presentation-tag-live">Simulare demo</span>
          <strong>Doar pentru divertisment. Nu este masurare legala.</strong>
          <p>
            Feed-urile, vitezele si clasamentele de mai jos sunt generate pentru un
            video de prezentare si ilustreaza felul in care ar putea arata un centru
            operativ profesionist.
          </p>
        </aside>
      </section>

      <section className="presentation-metric-grid" aria-label="Statistici demo">
        {presentationMetrics.map((metric) => (
          <article className="presentation-metric-card" key={metric.label}>
            <span className="presentation-metric-label">{metric.label}</span>
            <strong className="presentation-metric-value">{metric.value}</strong>
            <p className="presentation-metric-note">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="presentation-command-grid">
        <article className="presentation-priority-card">
          <div className="presentation-card-header">
            <span className="presentation-tag">Prioritate maxima</span>
            <span className="presentation-card-meta">ultima sincronizare 19:42</span>
          </div>

          <div className="presentation-priority-body">
            <div>
              <p className="presentation-priority-sector">{topCapture.sector}</p>
              <h2>{formatSpeed(topCapture.speedKmh)}</h2>
              <p className="presentation-priority-copy">
                {topCapture.plateMask} a fost marcat ca cel mai rapid vehicul din lotul
                curent, cu <strong>+{topCapture.overLimitKmh} km/h</strong> peste pragul
                demonstrativ configurat pe sector.
              </p>
            </div>

            <div className="presentation-priority-rail">
              <div className="presentation-rail-item">
                <span>Vehicul</span>
                <strong>{topCapture.vehicleLabel}</strong>
              </div>
              <div className="presentation-rail-item">
                <span>Ora capturii</span>
                <strong>{topCapture.timeLabel}</strong>
              </div>
              <div className="presentation-rail-item">
                <span>Status operator</span>
                <strong>marcat pentru clip highlight</strong>
              </div>
            </div>
          </div>
        </article>

        <aside className="presentation-hotlist-card">
          <div className="presentation-card-header">
            <span className="presentation-tag">Top capturi</span>
            <span className="presentation-card-meta">lista fake pentru prezentare</span>
          </div>

          <div className="presentation-hotlist-table">
            {hotListEntries.map((entry) => (
              <div className="presentation-hotlist-row" key={`${entry.sector}-${entry.plateMask}`}>
                <div>
                  <strong>{entry.plateMask}</strong>
                  <span>{entry.sector}</span>
                </div>
                <div>
                  <strong>{formatSpeed(entry.speedKmh)}</strong>
                  <span>{entry.vehicleLabel}</span>
                </div>
                <div>
                  <strong>+{entry.overLimitKmh}</strong>
                  <span>{entry.timeLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="presentation-wall-section">
        <div className="presentation-section-heading">
          <div>
            <p className="presentation-kicker">Grid multi-camera</p>
            <h2>Monitorizare pe sectoare</h2>
          </div>
          <p className="presentation-section-note">
            {/* Fiecare card simuleaza un stream video cu overlay de operare, starea
            traficului si accelerarile cele mai importante din ultimul interval. */}
          </p>
        </div>

        <div className="presentation-feed-grid">
          {presentationFeeds.map((feed) => (
            <article className="presentation-feed-card" key={feed.id}>
              <div className="presentation-feed-frame">
                <img
                  alt={`${feed.sector} ${feed.corridor}`}
                  className="presentation-feed-image"
                  src={feed.imageUrl}
                />
                <div className="presentation-feed-overlay" aria-hidden="true" />

                <div className="presentation-feed-topbar">
                  <span className="presentation-feed-id">{feed.id}</span>
                  <span className="presentation-feed-rec">REC</span>
                </div>

                <div className="presentation-feed-center">
                  <span className="presentation-feed-badge">{feed.occupancyLabel}</span>
                  <strong>{formatSpeed(feed.topSpeedKmh)}</strong>
                </div>

                <div className="presentation-feed-footer">
                  <div>
                    <span>limita demo</span>
                    <strong>{formatSpeed(feed.speedLimitKmh)}</strong>
                  </div>
                  <div>
                    <span>medie trafic</span>
                    <strong>{formatSpeed(feed.averageSpeedKmh)}</strong>
                  </div>
                  <div>
                    <span>alerte</span>
                    <strong>{feed.alertsLastHour}/h</strong>
                  </div>
                </div>
              </div>

              <div className="presentation-feed-copy">
                <div>
                  <p className="presentation-feed-sector">{feed.sector}</p>
                  <h3>{feed.corridor}</h3>
                </div>
                <p>{feed.focusNote}</p>

                <div className="presentation-trend-bars" aria-label={`Trend ${feed.sector}`}>
                  {feed.trend.map((segment, index) => (
                    <span
                      className="presentation-trend-bar"
                      key={`${feed.id}-${index}`}
                      style={{ height: `${segment}%` }}
                    />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="presentation-sector-board-section">
        <div className="presentation-section-heading">
          <div>
            <p className="presentation-kicker">Liste pe sector</p>
            <h2>Vitezomanii prinsi pe fiecare zona</h2>
          </div>
          <p className="presentation-section-note">
            Cardurile de mai jos fac pagina foarte usor de filmat intr-un video: fiecare
            sector are instant un top 3 clar si o rata de conformare afisata mare.
          </p>
        </div>

        <div className="presentation-sector-grid">
          {sectorBoards.map((board) => (
            <article className="presentation-sector-card" key={board.sector}>
              <div className="presentation-card-header">
                <span className="presentation-tag">{board.sector}</span>
                <span className="presentation-card-meta">{board.corridor}</span>
              </div>

              <div className="presentation-sector-stats">
                <div>
                  <span>Alerte</span>
                  <strong>{board.alertCount}</strong>
                </div>
                <div>
                  <span>Conformare</span>
                  <strong>{board.complianceRate}</strong>
                </div>
              </div>

              <div className="presentation-driver-list">
                {board.drivers.map((driver) => (
                  <div className="presentation-driver-row" key={`${board.sector}-${driver.plateMask}`}>
                    <div>
                      <strong>{driver.plateMask}</strong>
                      <span>{driver.note}</span>
                    </div>
                    <strong>{formatSpeed(driver.speedKmh)}</strong>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
