'use strict';

var os = require('os');
var path = require('path');

var verifyFile = require('./verify-file');

function getPlatformPackageName(rootPackageJsonPath) {
    var platform = os.platform() + '-' + os.arch();
    var packageName = '@screenpipe-installer/' + platform;
    var rootPackageJson = require(rootPackageJsonPath);

    if (!rootPackageJson.optionalDependencies[packageName]) {
        throw new Error('Unsupported platform/architecture: ' + platform);
    }

    return {
        packageName: packageName,
        platform: platform
    };
}

function getCandidateLocations(baseDir, packageName, binaryName) {
    var scopeSegments = packageName.split('/');
    var packageDir = path.join(scopeSegments[0], scopeSegments[1]);
    var siblingDir = path.resolve(baseDir, '..', scopeSegments[1]);
    var topLevelBase = baseDir.indexOf('node_modules') === -1
        ? path.resolve(baseDir, '..')
        : path.resolve(baseDir.slice(0, baseDir.indexOf('node_modules')), 'node_modules');
    var candidates = [];

    try {
        var resolvedPackageJson = require.resolve(packageName + '/package.json', { paths: [baseDir] });
        candidates.push(path.dirname(resolvedPackageJson));
    } catch (error) {
        // Fallback to path probing below when normal resolution does not work.
    }

    [
        siblingDir,
        path.resolve(baseDir, '..', packageDir),
        path.resolve(baseDir, 'node_modules', packageDir),
        path.resolve(topLevelBase, packageDir)
    ].forEach(function (candidatePath) {
        if (candidates.indexOf(candidatePath) === -1) {
            candidates.push(candidatePath);
        }
    });

    return candidates.map(function (packagePath) {
        return {
            packagePath: packagePath,
            binaryPath: path.join(packagePath, 'bin', binaryName),
            packageJsonPath: path.join(packagePath, 'package.json')
        };
    });
}

function resolveInstalledBinary(baseDir) {
    var packageMetadata = getPlatformPackageName(path.join(baseDir, 'package.json'));
    var binaryName = packageMetadata.platform.indexOf('win32-') === 0 ? 'screenpipe.exe' : 'screenpipe';
    var candidates = getCandidateLocations(baseDir, packageMetadata.packageName, binaryName);
    var resolvedCandidate;

    candidates.some(function (candidate) {
        if (!verifyFile(candidate.binaryPath)) {
            return false;
        }

        resolvedCandidate = candidate;
        return true;
    });

    if (!resolvedCandidate) {
        throw new Error(
            'Could not find screenpipe executable, tried "' +
                candidates.map(function (candidate) {
                    return candidate.binaryPath;
                }).join('", "') +
                '"'
        );
    }

    var platformPackageJson = require(resolvedCandidate.packageJsonPath);

    return {
        path: resolvedCandidate.binaryPath,
        version: platformPackageJson.screenpipe.version,
        url: platformPackageJson.screenpipe.url
    };
}

module.exports = {
    getCandidateLocations: getCandidateLocations,
    resolveInstalledBinary: resolveInstalledBinary
};
