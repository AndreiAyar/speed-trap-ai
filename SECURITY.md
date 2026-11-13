# Security

## Report a vulnerability privately

Use [GitHub's private vulnerability report form](https://github.com/AndreiAyar/speed-trap-ai/security/advisories/new).
Do not put credentials, private footage, personal paths, or an exploit against
someone else's system in a public issue.

Include the affected commit, operating system, steps to reproduce, expected
impact, and a minimal example with private information removed. This is a
community-maintained project; no response-time SLA or bug bounty is offered.

## Scope and supported versions

Security fixes target the current `main` branch and are tested on `dev` before
integration. Older commits do not receive a separate maintenance stream.

The API is designed to run on your own machine. It binds to `127.0.0.1` by
default and allows browser requests from loopback origins. Other dashboard
origins need explicit configuration through `SPEED_TRAP_ALLOWED_ORIGINS`.
This origin check is not authentication. The application has no public-service
user isolation, quota management, or production authentication layer.

Only load recordings you trust. Dependencies decode video and load model weights;
keep the environment updated and obtain weights from the upstream project.
Vehicle blur is a best-effort sharing aid and may miss identifying details.

## Before sharing source or recordings

Local data, weights, virtual environments, and `.env` files are ignored by Git.
Ignoring or deleting a file does not remove it from old commits. Review history
as well as the current checkout before changing repository visibility or sharing
an archive. Example configuration distances must be recalibrated for each scene.

> Doar pentru divertisment. Nu este masurare legala.
