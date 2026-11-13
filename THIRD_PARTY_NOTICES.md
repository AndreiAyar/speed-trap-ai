# Licensing and third-party components

The original Speed Trap AI source code, scripts, configuration examples, and
written documentation are offered under the [MIT License](LICENSE).
Contributors retain copyright in their contributions.

## The default detector is not MIT

The Python engine imports **Ultralytics**, including its implementation of
ByteTrack, and uses YOLO weights. Those components are provided by Ultralytics
under **AGPL-3.0**, with a separate Enterprise licensing option.

MIT covers our original code; it does not replace the license of Ultralytics
or its weights. When using, modifying, distributing, or serving a combined
application, comply with the applicable upstream terms, including any source
code obligations. Do not describe the default combined stack as MIT-only.

- [Ultralytics licensing](https://www.ultralytics.com/license)
- [Ultralytics source and license](https://github.com/ultralytics/ultralytics)
- [Copy of the AGPL-3.0 text](LICENSES/AGPL-3.0.txt)

Using the project in a proprietary product may require a separate arrangement
with Ultralytics or a detector with suitable licensing. The project MIT license
does not grant an Ultralytics Enterprise license.

## Other dependencies

JavaScript and Python dependencies retain their own licenses. They are installed
from the package manifests and are not relicensed by this repository. Keep their
notices when distributing a packaged application. Model weights are downloaded
separately and are not included in Git.

## Film, screenshots, and other media

The MIT grant does not cover the videos, photographs, GIFs, screenshots, or other
media in `docs/assets/` and `apps/dashboard/public/presentation/`. These are
documentation and demonstration assets; rights remain with their respective
owners. No general permission to reuse those media is granted here. Review
[media sources and notes](docs/assets/README.md) and obtain permission where
needed. Third-party trademarks are not licensed by the MIT grant.

The header uses outlined Roboto lettering. No font software is redistributed.

> Doar pentru divertisment. Nu este masurare legala.
