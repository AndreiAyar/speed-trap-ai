# GitHub preparation checklist

Working checklist for the public release. Source recordings and analysis sheets stay local.

- [x] Inspect repository, transcript, dependencies, and current Git state.
- [x] Sample the supplied film every 0.5 seconds and visually locate demo sequences.
- [x] Export compact GIFs: calibration, ByteTrack hand, speed gate, final comparison.
- [x] Remove personal paths and exclude recordings, weights, builds, and runtime data from Git.
- [x] Make setup and configuration portable; verify development and compiled API paths.
- [x] Process the supplied traffic clip through the real engine.
- [x] Capture the running dashboard with completed results and calibration.
- [x] Write an English README with GIF explanations, setup, limitations, and linked video (English subtitles).
- [x] Run build, engine, API, and public-file checks.
- [ ] Confirm the owner's code licensing choice (AGPL-3.0 proposed; media separate).
- [ ] Publish to the existing GitHub repository when authentication is available.

The source film illustrates a broader live workflow. Describe this repository's recorded-file processing accurately. Comparison footage is an illustrative experiment, not an accuracy certification. Keep the required Romanian disclaimer visible.

Validation: clean-copy frozen-lockfile install; both dashboard builds and API compilation; six geometry tests; actual engine runs through the compiled API and offline script; invalid-path and symlink checks; browser video/range playback, YAML application, and screenshots without page errors. Source film sampled into 826 local frames, with 0.1-second checks at selected transitions.
