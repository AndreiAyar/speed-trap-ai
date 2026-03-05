# Ghid simplu: cum estimam viteza cu AI

## Ce face proiectul

Acest proiect ia un video cu trafic si estimeaza viteza masinilor.
Nu este radar de politie. Este doar pentru demonstratie si divertisment.

## Cum functioneaza pe scurt

1. AI-ul vede masinile in fiecare frame.
2. Tracker-ul da un ID la fiecare masina (ex: ID 12).
3. Noi desenam doua linii pe sosea: Linia A si Linia B.
4. Cand masina trece de A, salvam timpul `t1`.
5. Cand masina trece de B, salvam timpul `t2`.
6. Daca stim distanta reala dintre linii, calculam viteza.

Formula este:

`viteza_m/s = distanta_metri / (t2 - t1)`

`viteza_km/h = viteza_m/s * 3.6`

## De ce trebuie distanta reala

Daca nu avem distanta reala in metri, nu putem spune km/h credibil.
Putem spune doar "mai rapid" sau "mai lent".

## Ce este YOLO

YOLO este un model AI pentru detectie obiecte in imagine/video.
In proiectul nostru, YOLO detecteaza masina, bus, camion, moto.

Noi folosim:

- model default: `yolo26n.pt`
- fallback: `yolo11n.pt`

## Ce este ByteTrack

ByteTrack este tracker-ul care tine acelasi ID pentru masina intre frame-uri.
Fara tracker, AI ar vedea "cutii" dar nu ar sti care masina e aceeasi in timp.

## Alternative simple

- SORT: mai simplu, uneori mai instabil in trafic aglomerat.
- DeepSORT: poate ajuta la re-identificare, dar e mai greu de configurat.
- BoT-SORT: alternativa buna in unele scene, dar noi ramanem pe ByteTrack pentru MVP.

## De ce punem blur

Punem blur pe masini ca sa reducem riscurile de privacy in materialul public.

## Mesaj important

Rezultatul este o estimare AI pentru video entertainment.
Nu este o masurare legala si nu poate inlocui un sistem omologat.
