# `@screenpipe-installer`

Installer packages for shipping precompiled [Screenpipe](https://github.com/screenpipe/screenpipe) binaries into Node.js and Electron apps.

This repo is not Screenpipe itself. It is a packaging layer that:

- installs binaries built and hosted by this project during `postinstall`
- exposes a stable `require('@screenpipe-installer/screenpipe')` API
- keeps platform-specific download metadata in one config file

Credit for the Screenpipe software and upstream project goes to the Screenpipe team and the upstream GitHub repository:

- https://github.com/screenpipe/screenpipe

The binaries referenced by this installer are built and hosted by this project, not pulled from upstream release artifacts.

## Consumer API

The consumer-facing package is `@screenpipe-installer/screenpipe`:

```js
const screenpipe = require("@screenpipe-installer/screenpipe");

console.log(screenpipe.path, screenpipe.version, screenpipe.url);
```

It exports:

- `path`: absolute path to the installed executable
- `version`: binary version for the current platform
- `url`: hosted download URL used for that binary

## Packages

- `@screenpipe-installer/screenpipe`
- `@screenpipe-installer/darwin-arm64`
- `@screenpipe-installer/win32-x64`

## How It Works

1. Consumers install `@screenpipe-installer/screenpipe`.
2. npm selects the matching optional dependency for the current platform.
3. The selected platform package downloads the archive from your host during `postinstall`.
4. The package verifies the SHA-256 checksum.
5. The executable and any required companion files are copied into the installed package.
6. The top-level package resolves the installed binary and exports `{ path, version, url }`.

## Config

All hosted binary metadata lives in `config/platforms.json`.

Example shape:

```json
{
  "platforms": {
    "darwin-arm64": {
      "version": "<darwin-arm64-package-version>",
      "url": "<darwin-arm64-binary-url>",
      "sha256": "<sha256>",
      "archiveType": "tar.gz",
      "binaryName": "screenpipe"
    },
    "win32-x64": {
      "version": "<win32-x64-package-version>",
      "url": "<win32-x64-binary-url>",
      "sha256": "<sha256>",
      "archiveType": "zip",
      "binaryName": "screenpipe.exe"
    }
  }
}
```

After changing the config:

```sh
npm run sync-platform-metadata
```

If you want to bump the top-level `@screenpipe-installer/screenpipe` package version separately:

```sh
npm run sync-platform-metadata -- --version=<meta-package-version>
```

## Local Testing

Run tests:

```sh
npm test
```

Pack all publishable tarballs into `dist/`:

```sh
npm run pack:all
```

## Publish Order

1. `@screenpipe-installer/darwin-arm64`
2. `@screenpipe-installer/win32-x64`
3. `@screenpipe-installer/screenpipe`

## Electron Note

If your Electron app uses `asar`, you may need:

```js
const screenpipePath = require("@screenpipe-installer/screenpipe").path.replace(
  "app.asar",
  "app.asar.unpacked",
);
```

## License

This packaging repo is MIT licensed. See `LICENSE`.

Screenpipe itself is a separate upstream project with its own repository and licensing. This repo only provides packaging, metadata, and installer logic for binaries built and hosted by this project:

- https://github.com/screenpipe/screenpipe
