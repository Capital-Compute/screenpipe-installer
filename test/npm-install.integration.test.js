'use strict';

var assert = require('assert');
var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');
var test = require('node:test');

var rootDir = path.resolve(__dirname, '..');
var npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function copyRepoSubset(destinationDir) {
    fs.cpSync(path.join(rootDir, 'package.json'), path.join(destinationDir, 'package.json'));
    fs.cpSync(path.join(rootDir, 'packages'), path.join(destinationDir, 'packages'), { recursive: true });
    fs.cpSync(path.join(rootDir, 'scripts'), path.join(destinationDir, 'scripts'), { recursive: true });
    fs.cpSync(path.join(rootDir, 'config'), path.join(destinationDir, 'config'), { recursive: true });
}

function packPackage(packageDir, outputDir) {
    var rawOutput = childProcess.execFileSync(
        npmCommand,
        ['pack', '--json', '--pack-destination', outputDir],
        {
            cwd: packageDir,
            encoding: 'utf8'
        }
    );
    var packResult = JSON.parse(rawOutput);

    return path.join(outputDir, packResult[0].filename);
}

function execFileAsync(command, args, options) {
    return new Promise(function (resolve, reject) {
        childProcess.execFile(command, args, options || {}, function (error, stdout, stderr) {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                return reject(error);
            }

            resolve({
                stdout: stdout,
                stderr: stderr
            });
        });
    });
}

function rewriteMetaPackageForOfflineInstall(workspaceDir, currentPlatform) {
    var metaPackagePath = path.join(workspaceDir, 'packages', 'screenpipe', 'package.json');
    var metaPackageJson = JSON.parse(fs.readFileSync(metaPackagePath, 'utf8'));
    var packageName = '@screenpipe-installer/' + currentPlatform;

    metaPackageJson.optionalDependencies = {};
    metaPackageJson.optionalDependencies[packageName] = metaPackageJson.version;

    fs.writeFileSync(metaPackagePath, JSON.stringify(metaPackageJson, null, 2) + '\n');
}

test('packed installer packages install into a temp consumer project and clean up temp artifacts', async function (t) {
    var currentPlatform = os.platform() + '-' + os.arch();
    var config = JSON.parse(fs.readFileSync(path.join(rootDir, 'config', 'platforms.json'), 'utf8'));

    if (currentPlatform !== 'darwin-arm64' && currentPlatform !== 'win32-x64') {
        t.skip('integration test only runs on supported host platforms');
    }

    var tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'screenpipe-pack-workspace-'));
    var tempConsumer = fs.mkdtempSync(path.join(os.tmpdir(), 'screenpipe-pack-consumer-'));
    var distDir = path.join(tempWorkspace, 'dist');

    try {
        copyRepoSubset(tempWorkspace);
        fs.mkdirSync(distDir, { recursive: true });

        childProcess.execFileSync(process.execPath, ['scripts/sync-platform-metadata.js'], {
            cwd: tempWorkspace
        });
        rewriteMetaPackageForOfflineInstall(tempWorkspace, currentPlatform);

        var platformTarball = packPackage(path.join(tempWorkspace, 'packages', currentPlatform), distDir);
        var screenpipeTarball = packPackage(path.join(tempWorkspace, 'packages', 'screenpipe'), distDir);

        fs.writeFileSync(
            path.join(tempConsumer, 'package.json'),
            JSON.stringify({
                name: 'screenpipe-test-consumer',
                version: '0.0.0',
                private: true
            }, null, 2) + '\n'
        );

        await execFileAsync(
            npmCommand,
            ['install', '--no-audit', '--no-fund', screenpipeTarball, platformTarball],
            {
                cwd: tempConsumer,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024 * 20
            }
        );

        var output = childProcess.execFileSync(
            process.execPath,
            [
                '-e',
                [
                    'const fs = require("fs");',
                    'const screenpipe = require("@screenpipe-installer/screenpipe");',
                    'if (!fs.existsSync(screenpipe.path)) { throw new Error("missing binary"); }',
                    'process.stdout.write(JSON.stringify(screenpipe));'
                ].join(' ')
            ],
            {
                cwd: tempConsumer,
                encoding: 'utf8'
            }
        );
        var installed = JSON.parse(output);

        assert.equal(installed.version, config.version);
        assert.equal(installed.url, config.platforms[currentPlatform].url);
        assert.equal(
            path.basename(installed.path),
            currentPlatform === 'win32-x64' ? 'screenpipe.exe' : 'screenpipe'
        );
        assert.equal(fs.existsSync(installed.path), true);
    } finally {
        fs.rmSync(tempConsumer, { recursive: true, force: true });
        fs.rmSync(tempWorkspace, { recursive: true, force: true });
    }
});
