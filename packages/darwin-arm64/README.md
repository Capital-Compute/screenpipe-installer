# `@screenpipe-installer/darwin-arm64`

macOS arm64 Screenpipe binary installer used by `@screenpipe-installer/screenpipe`.

It downloads the configured `tar.gz` archive during `postinstall`, verifies the SHA-256 checksum, extracts the executable into `bin/`, and makes it executable.

This package ships binaries built and hosted by this project for the Screenpipe application.

Upstream Screenpipe project:

- https://github.com/Capital-Compute/screenpipe
