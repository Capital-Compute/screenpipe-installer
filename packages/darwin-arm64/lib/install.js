'use strict';

var crypto = require('crypto');
var fs = require('fs');
var http = require('http');
var https = require('https');
var os = require('os');
var path = require('path');
var stream = require('stream');
var util = require('util');
var childProcess = require('child_process');
var URL = require('url').URL;

var pipeline = util.promisify(stream.pipeline);
var packageJson = require('../package.json');
var verifyFile = require('./verify-file');

function formatError(step, url, error) {
    return new Error(
        '[' +
            packageJson.name +
            '] Failed during ' +
            step +
            ' for ' +
            os.platform() +
            '-' +
            os.arch() +
            ' from "' +
            url +
            '": ' +
            error.message
    );
}

function validateMetadata(metadata) {
    if (!metadata.url || /^https:\/\/your-host\.example\.com\//.test(metadata.url) || metadata.url === 'REPLACE_WITH_REAL_URL') {
        throw new Error('Hosted binary URL is not configured');
    }

    if (!metadata.sha256 || metadata.sha256 === 'REPLACE_WITH_REAL_SHA256' || !/^[a-f0-9]{64}$/i.test(metadata.sha256)) {
        throw new Error('SHA-256 checksum is not configured');
    }

    if (metadata.archiveType !== 'tar.gz' && metadata.archiveType !== 'zip') {
        throw new Error('Unsupported archive type "' + metadata.archiveType + '"');
    }
}

function downloadToFile(url, destinationPath, redirectsRemaining) {
    redirectsRemaining = typeof redirectsRemaining === 'number' ? redirectsRemaining : 5;

    return new Promise(function (resolve, reject) {
        var parsedUrl = new URL(url);
        var transport = parsedUrl.protocol === 'http:' ? http : https;
        var request = transport.get(parsedUrl, function (response) {
            if (
                response.statusCode &&
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location &&
                redirectsRemaining > 0
            ) {
                response.resume();
                return resolve(downloadToFile(new URL(response.headers.location, parsedUrl).toString(), destinationPath, redirectsRemaining - 1));
            }

            if (response.statusCode !== 200) {
                response.resume();
                return reject(new Error('Unexpected HTTP status ' + response.statusCode));
            }

            var output = fs.createWriteStream(destinationPath);
            pipeline(response, output).then(resolve, reject);
        });

        request.on('error', reject);
    });
}

function verifyChecksum(filePath, expectedSha256) {
    return new Promise(function (resolve, reject) {
        var hash = crypto.createHash('sha256');
        var input = fs.createReadStream(filePath);

        input.on('error', reject);
        input.on('data', function (chunk) {
            hash.update(chunk);
        });
        input.on('end', function () {
            var actual = hash.digest('hex');

            if (actual !== expectedSha256.toLowerCase()) {
                return reject(new Error('Checksum mismatch: expected ' + expectedSha256 + ' but received ' + actual));
            }

            resolve();
        });
    });
}

function runCommand(command, args, cwd) {
    return new Promise(function (resolve, reject) {
        childProcess.execFile(command, args, { cwd: cwd }, function (error, stdout, stderr) {
            if (error) {
                error.message = stderr || stdout || error.message;
                return reject(error);
            }

            resolve();
        });
    });
}

async function extractArchive(archivePath, destinationDir, archiveType) {
    if (archiveType === 'tar.gz') {
        await runCommand('tar', ['-xzf', archivePath, '-C', destinationDir], destinationDir);
        return;
    }

    if (archiveType === 'zip') {
        if (process.platform === 'win32') {
            await runCommand(
                'powershell.exe',
                [
                    '-NoProfile',
                    '-NonInteractive',
                    '-Command',
                    'Expand-Archive -LiteralPath "' + archivePath + '" -DestinationPath "' + destinationDir + '" -Force'
                ],
                destinationDir
            );
            return;
        }

        await runCommand('unzip', ['-qq', archivePath, '-d', destinationDir], destinationDir);
        return;
    }

    throw new Error('Unsupported archive type "' + archiveType + '"');
}

function findFile(rootDir, fileName) {
    var entries = fs.readdirSync(rootDir, { withFileTypes: true });

    for (var index = 0; index < entries.length; index += 1) {
        var entry = entries[index];
        var fullPath = path.join(rootDir, entry.name);

        if (entry.isFile() && entry.name === fileName) {
            return fullPath;
        }

        if (entry.isDirectory()) {
            var nestedMatch = findFile(fullPath, fileName);
            if (nestedMatch) {
                return nestedMatch;
            }
        }
    }

    return null;
}

async function install() {
    var metadata = packageJson.screenpipe;
    var tmpDir = path.join(__dirname, '..', '.tmp');
    var archivePath = path.join(tmpDir, 'screenpipe.' + metadata.archiveType.replace('.', '-'));
    var extractDir = path.join(tmpDir, 'extract');
    var binDir = path.join(__dirname, '..', 'bin');
    var binaryPath = path.join(binDir, metadata.binaryName);

    validateMetadata(metadata);

    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });

    try {
        await downloadToFile(metadata.url, archivePath);
    } catch (error) {
        throw formatError('download', metadata.url, error);
    }

    try {
        await verifyChecksum(archivePath, metadata.sha256);
    } catch (error) {
        throw formatError('checksum verification', metadata.url, error);
    }

    try {
        await extractArchive(archivePath, extractDir, metadata.archiveType);
    } catch (error) {
        throw formatError('archive extraction', metadata.url, error);
    }

    var discoveredBinary = findFile(extractDir, metadata.binaryName);
    if (!discoveredBinary) {
        throw formatError('binary lookup', metadata.url, new Error('Executable "' + metadata.binaryName + '" was not found in the archive'));
    }

    fs.copyFileSync(discoveredBinary, binaryPath);

    if (!verifyFile(binaryPath)) {
        throw formatError('binary verification', metadata.url, new Error('Executable was not written to "' + binaryPath + '"'));
    }

    if (process.platform !== 'win32') {
        fs.chmodSync(binaryPath, 0o755);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
}

module.exports = {
    downloadToFile: downloadToFile,
    extractArchive: extractArchive,
    findFile: findFile,
    formatError: formatError,
    install: install,
    validateMetadata: validateMetadata,
    verifyChecksum: verifyChecksum
};
