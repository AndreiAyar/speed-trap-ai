# Playbook video (RO) pentru Speed Trap AI

## Scop

Sa filmezi trafic in Timisoara si sa obtii overlay clar, usor de explicat in video.

## Setup filmare (recomandat)

1. Camera cat mai fixa (ideal trepied).
2. Unghi in care masinile merg intr-o directie clara.
3. Evita zoom mare care schimba perspectiva in timpul filmarii.
4. Filmeaza 30-90 secunde pentru prima demonstratie.

## Calibrare simpla (obligatorie pentru km/h)

1. Alege doua puncte vizibile pe sosea in imagine.
2. Pune Linia A si Linia B pe acele puncte in config.
3. Masoara distanta reala dintre ele (metri).
4. Introdu `distance_meters` in config.

## Rulare pipeline

1. Pune fisierul video in `data/input/`.
2. Ruleaza:

```bash
./scripts/run-offline.sh data/input/nume-video.mp4
```

3. Rezultate in `data/output/<job_id>/`:
- `overlay.mp4`
- `summary.csv`
- `events.jsonl`
- `metadata.json`

## Rulare dashboard

```bash
./scripts/run-api-dashboard.sh
```

Dashboard-ul arata:
- status job
- top masini dupa viteza
- detalii per ID
- preview pentru overlay

## Idee narativa pentru video

1. Arata scena si explica cele 2 linii.
2. Spune clar ca este estimare AI pentru divertisment.
3. Arata top 5 cele mai rapide detectii.
4. Explica simplu: "Aici AI-ul poate gresi daca unghiul/calibrarea nu sunt bune".

## Checklist inainte de publicare

- Disclaimer vizibil in clip.
- Blur activ.
- Nu afirma ca e proba legala.
- Mentioneaza ca este demo educational/entertainment.
