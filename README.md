# `@screenpipe-installer`

This repo publishes a small npm package family that installs Screenpipe from precompiled binaries you host yourself.

The consumer-facing package is `@screenpipe-installer/screenpipe`:

```js
const screenpipe = require("@screenpipe-installer/screenpipe");

console.log(screenpipe.path, screenpipe.version, screenpipe.url);
```

## Packages

- `@screenpipe-installer/screenpipe`
- `@screenpipe-installer/darwin-arm64`
- `@screenpipe-installer/win32-x64`

## How it works

1. Consumers install `@screenpipe-installer/screenpipe`.
2. npm selects the matching optional dependency for the current OS and CPU.
3. The selected platform package downloads the archive from your host during `postinstall`.
4. The top-level package resolves the installed binary and exports `{ path, version, url }`.

## Development

The platform package metadata is generated from a single config file: `config/platforms.json`.

Update that file before publishing:

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

Then sync the package manifests:

```sh
npm run sync-platform-metadata
```

If you want to bump the top-level `@screenpipe-installer/screenpipe` package version separately, pass it explicitly:

```sh
npm run sync-platform-metadata -- --version=<meta-package-version>
```

Publish order:

1. `@screenpipe-installer/darwin-arm64`
2. `@screenpipe-installer/win32-x64`
3. `@screenpipe-installer/screenpipe`

## Electron note

Users may need to rewrite the path:

```js
const screenpipePath = require("@screenpipe-installer/screenpipe").path.replace(
  "app.asar",
  "app.asar.unpacked",
);
```
