'use strict';

var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

var rootDir = path.resolve(__dirname, '..');
var distDir = path.join(rootDir, 'dist');
var npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
var packageOrder = [
    path.join(rootDir, 'packages', 'darwin-arm64'),
    path.join(rootDir, 'packages', 'win32-x64'),
    path.join(rootDir, 'packages', 'screenpipe')
];

function packPackage(packageDir) {
    var result = childProcess.execFileSync(
        npmCommand,
        ['pack', '--json', '--pack-destination', distDir],
        {
            cwd: packageDir,
            encoding: 'utf8'
        }
    );
    var packInfo = JSON.parse(result)[0];
    return packInfo.filename;
}

function main() {
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });

    packageOrder.forEach(function (packageDir) {
        var packageJson = require(path.join(packageDir, 'package.json'));
        var filename = packPackage(packageDir);
        process.stdout.write(packageJson.name + ' -> dist/' + filename + '\n');
    });
}

if (require.main === module) {
    main();
}

module.exports = {
    main: main,
    packPackage: packPackage
};
