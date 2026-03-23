'use strict';

var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');

var resolveInstalledBinary = require('../packages/screenpipe/lib/resolve').resolveInstalledBinary;

function withPlatform(platformName, archName, callback) {
    var originalPlatform = os.platform;
    var originalArch = os.arch;

    os.platform = function () {
        return platformName;
    };
    os.arch = function () {
        return archName;
    };

    try {
        callback();
    } finally {
        os.platform = originalPlatform;
        os.arch = originalArch;
    }
}

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function canonicalPath(filePath) {
    return fs.realpathSync.native(filePath);
}

test('resolveInstalledBinary finds a sibling workspace package', function () {
    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenpipe-resolve-workspace-'));
    var screenpipeDir = path.join(tempDir, 'packages', 'screenpipe');
    var darwinDir = path.join(tempDir, 'packages', 'darwin-arm64');
    var binaryPath = path.join(darwinDir, 'bin', 'screenpipe');

    writeJson(path.join(screenpipeDir, 'package.json'), {
        name: '@screenpipe-installer/screenpipe',
        optionalDependencies: {
            '@screenpipe-installer/darwin-arm64': '0.1.0'
        }
    });
    writeJson(path.join(darwinDir, 'package.json'), {
        name: '@screenpipe-installer/darwin-arm64',
        screenpipe: {
            version: '0.1.0',
            url: 'https://example.com/darwin-arm64.tar.gz'
        }
    });
    fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
    fs.writeFileSync(binaryPath, 'binary');

    withPlatform('darwin', 'arm64', function () {
        var resolved = resolveInstalledBinary(screenpipeDir);

        assert.equal(canonicalPath(resolved.path), canonicalPath(binaryPath));
        assert.equal(resolved.version, '0.1.0');
        assert.equal(resolved.url, 'https://example.com/darwin-arm64.tar.gz');
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('resolveInstalledBinary finds a nested node_modules package', function () {
    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenpipe-resolve-node-modules-'));
    var screenpipeDir = path.join(tempDir, 'node_modules', '@screenpipe-installer', 'screenpipe');
    var windowsDir = path.join(tempDir, 'node_modules', '@screenpipe-installer', 'win32-x64');
    var binaryPath = path.join(windowsDir, 'bin', 'screenpipe.exe');

    writeJson(path.join(screenpipeDir, 'package.json'), {
        name: '@screenpipe-installer/screenpipe',
        optionalDependencies: {
            '@screenpipe-installer/win32-x64': '0.1.0'
        }
    });
    writeJson(path.join(windowsDir, 'package.json'), {
        name: '@screenpipe-installer/win32-x64',
        screenpipe: {
            version: '0.1.0',
            url: 'https://example.com/win32-x64.zip'
        }
    });
    fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
    fs.writeFileSync(binaryPath, 'binary');

    withPlatform('win32', 'x64', function () {
        var resolved = resolveInstalledBinary(screenpipeDir);

        assert.equal(canonicalPath(resolved.path), canonicalPath(binaryPath));
        assert.equal(resolved.version, '0.1.0');
        assert.equal(resolved.url, 'https://example.com/win32-x64.zip');
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('resolveInstalledBinary throws on unsupported platform', function () {
    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenpipe-resolve-unsupported-'));
    var screenpipeDir = path.join(tempDir, 'packages', 'screenpipe');

    writeJson(path.join(screenpipeDir, 'package.json'), {
        name: '@screenpipe-installer/screenpipe',
        optionalDependencies: {
            '@screenpipe-installer/darwin-arm64': '0.1.0'
        }
    });

    withPlatform('linux', 'x64', function () {
        assert.throws(function () {
            resolveInstalledBinary(screenpipeDir);
        }, /Unsupported platform\/architecture: linux-x64/);
    });

    fs.rmSync(tempDir, { recursive: true, force: true });
});
