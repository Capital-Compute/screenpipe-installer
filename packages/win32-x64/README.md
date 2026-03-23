# `@screenpipe-installer/win32-x64`

Windows x64 Screenpipe binary installer used by `@screenpipe-installer/screenpipe`.

It downloads the configured `zip` archive during `postinstall`, verifies the SHA-256 checksum, and extracts `screenpipe.exe` into `bin/`.
