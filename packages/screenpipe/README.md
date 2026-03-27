# `@screenpipe-installer/screenpipe`

Platform independent binary installer for Screenpipe. It mirrors the `@ffmpeg-installer/ffmpeg` API for Electron and Node consumers.

This package installs binaries built and hosted by this project for the Screenpipe application:

- https://github.com/Capital-Compute/screenpipe

## Install

```sh
npm install @screenpipe-installer/screenpipe
```

## Usage

```js
const screenpipe = require("@screenpipe-installer/screenpipe");

console.log(screenpipe.path, screenpipe.version, screenpipe.url);
```

Use it with `spawn`:

```js
const spawn = require("child_process").spawn;
const screenpipePath = require("@screenpipe-installer/screenpipe").path;

const child = spawn(screenpipePath, ["--help"]);
child.on("exit", function (code) {
  console.log(code);
});
```

## Electron / `asar`

If your Electron app uses `asar`, you may need to rewrite the path:

```js
const screenpipePath = require("@screenpipe-installer/screenpipe").path.replace(
  "app.asar",
  "app.asar.unpacked",
);
```

## Supported platforms

- macOS arm64
- Windows x64

## Credit

Credit for the Screenpipe application itself goes to the Screenpipe project and the fork used by this installer:

- https://github.com/Capital-Compute/screenpipe

The binaries referenced by this installer are built and hosted by this project.

## Troubleshooting

- A 404 during install usually means the hosted binary URL in the platform package metadata is wrong.
- A checksum failure means the hosted binary does not match the published package metadata.
- If the executable cannot be found after install, confirm the archive contains a runnable `screenpipe` binary.
