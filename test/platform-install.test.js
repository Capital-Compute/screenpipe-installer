'use strict';

var assert = require('assert');
var crypto = require('crypto');
var fs = require('fs');
var https = require('https');
var os = require('os');
var path = require('path');
var stream = require('stream');
var childProcess = require('child_process');
var test = require('node:test');

var darwinInstaller = require('../packages/darwin-arm64/lib/install');
var darwinPackageJson = require('../packages/darwin-arm64/package.json');
var winInstaller = require('../packages/win32-x64/lib/install');
var winPackageJson = require('../packages/win32-x64/package.json');

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function patchHttpsGet(archivePath) {
    var originalGet = https.get;

    https.get = function (_url, callback) {
        var response = fs.createReadStream(archivePath);
        response.statusCode = 200;
        response.headers = {};
        process.nextTick(function () {
            callback(response);
        });
        return {
            on: function () {}
        };
    };

    return function restore() {
        https.get = originalGet;
    };
}

function buildTarGzArchive() {
    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenpipe-tar-fixture-'));
    var contentsDir = path.join(tempDir, 'contents', 'nested');
    var archivePath = path.join(tempDir, 'screenpipe.tar.gz');
    var binaryPath = path.join(contentsDir, 'screenpipe');

    fs.mkdirSync(contentsDir, { recursive: true });
    fs.writeFileSync(binaryPath, '#!/bin/sh\necho screenpipe\n');
    childProcess.execFileSync('tar', ['-czf', archivePath, '-C', path.join(tempDir, 'contents'), '.']);

    return {
        archivePath: archivePath,
        cleanup: function () {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    };
}

function buildZipArchive() {
    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenpipe-zip-fixture-'));
    var contentsDir = path.join(tempDir, 'contents', 'nested');
    var archivePath = path.join(tempDir, 'screenpipe.zip');
    var binaryPath = path.join(contentsDir, 'screenpipe.exe');

    fs.mkdirSync(contentsDir, { recursive: true });
    fs.writeFileSync(binaryPath, 'screenpipe.exe');
    childProcess.execFileSync('zip', ['-qr', archivePath, '.'], { cwd: path.join(tempDir, 'contents') });

    return {
        archivePath: archivePath,
        cleanup: function () {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    };
}

function withPackageMetadata(packageJson, overrides, callback) {
    var original = Object.assign({}, packageJson.screenpipe);

    Object.assign(packageJson.screenpipe, overrides);

    return Promise.resolve()
        .then(callback)
        .finally(function () {
            packageJson.screenpipe = original;
        });
}

function cleanupInstalledArtifacts(packageDir) {
    fs.rmSync(path.join(packageDir, 'bin'), { recursive: true, force: true });
    fs.rmSync(path.join(packageDir, '.tmp'), { recursive: true, force: true });
}

test('darwin installer rejects placeholder metadata', function () {
    assert.throws(function () {
        darwinInstaller.validateMetadata({
            url: 'REPLACE_WITH_REAL_URL',
            sha256: 'REPLACE_WITH_REAL_SHA256',
            archiveType: 'tar.gz',
            binaryName: 'screenpipe'
        });
    }, /not configured/);
});

test('checksum verification rejects mismatched archives', async function () {
    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenpipe-checksum-'));
    var filePath = path.join(tempDir, 'archive.bin');

    fs.writeFileSync(filePath, 'archive');

    await assert.rejects(
        darwinInstaller.verifyChecksum(filePath, '0'.repeat(64)),
        /Checksum mismatch/
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('darwin installer downloads, verifies, extracts and installs a tar.gz binary', async function () {
    var archive = buildTarGzArchive();
    var packageDir = path.resolve(__dirname, '..', 'packages', 'darwin-arm64');
    var restoreHttps = patchHttpsGet(archive.archivePath);

    try {
        await withPackageMetadata(darwinPackageJson, {
            version: '9.9.9',
            url: 'https://fixtures.example.com/screenpipe.tar.gz',
            sha256: sha256(archive.archivePath),
            archiveType: 'tar.gz',
            binaryName: 'screenpipe'
        }, async function () {
            cleanupInstalledArtifacts(packageDir);
            await darwinInstaller.install();

            var binaryPath = path.join(packageDir, 'bin', 'screenpipe');
            assert.equal(fs.existsSync(binaryPath), true);
            assert.equal(fs.statSync(binaryPath).mode & 0o111, 0o111);
        });
    } finally {
        cleanupInstalledArtifacts(packageDir);
        restoreHttps();
        archive.cleanup();
    }
});

test('win32 installer downloads, verifies, extracts and installs a zip binary', async function () {
    var archive = buildZipArchive();
    var packageDir = path.resolve(__dirname, '..', 'packages', 'win32-x64');
    var restoreHttps = patchHttpsGet(archive.archivePath);

    try {
        await withPackageMetadata(winPackageJson, {
            version: '9.9.9',
            url: 'https://fixtures.example.com/screenpipe.zip',
            sha256: sha256(archive.archivePath),
            archiveType: 'zip',
            binaryName: 'screenpipe.exe'
        }, async function () {
            cleanupInstalledArtifacts(packageDir);
            await winInstaller.install();

            var binaryPath = path.join(packageDir, 'bin', 'screenpipe.exe');
            assert.equal(fs.existsSync(binaryPath), true);
        });
    } finally {
        cleanupInstalledArtifacts(packageDir);
        restoreHttps();
        archive.cleanup();
    }
});

test('findFile locates nested executables', function () {
    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenpipe-find-file-'));
    var nestedDir = path.join(tempDir, 'a', 'b');
    var binaryPath = path.join(nestedDir, 'screenpipe.exe');

    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(binaryPath, 'binary');

    assert.equal(winInstaller.findFile(tempDir, 'screenpipe.exe'), binaryPath);

    fs.rmSync(tempDir, { recursive: true, force: true });
});
