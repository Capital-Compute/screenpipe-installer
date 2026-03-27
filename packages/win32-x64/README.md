# `@screenpipe-installer/win32-x64`

Windows x64 Screenpipe binary installer used by `@screenpipe-installer/screenpipe`.

It downloads the configured `zip` archive during `postinstall`, verifies the SHA-256 checksum, and copies `screenpipe.exe` plus required companion files into `bin/`.

This package ships binaries built and hosted by this project for the Screenpipe application.

Upstream Screenpipe project:

- https://github.com/screenpipe/screenpipe
