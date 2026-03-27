'use strict';

var fs = require('fs');
var path = require('path');

var rootDir = path.resolve(__dirname, '..');
var defaultConfigPath = path.join(rootDir, 'config', 'platforms.json');

var packagePaths = {
    'darwin-arm64': {
        packageJsonPath: path.join(rootDir, 'packages', 'darwin-arm64', 'package.json')
    },
    'win32-x64': {
        packageJsonPath: path.join(rootDir, 'packages', 'win32-x64', 'package.json')
    }
};

var metaPackagePath = path.join(rootDir, 'packages', 'screenpipe', 'package.json');

function parseArgs(argv) {
    return argv.reduce(function (accumulator, token) {
        if (token.indexOf('--') !== 0) {
            return accumulator;
        }

        var separatorIndex = token.indexOf('=');
        var key = separatorIndex === -1 ? token.slice(2) : token.slice(2, separatorIndex);
        var value = separatorIndex === -1 ? 'true' : token.slice(separatorIndex + 1);
        accumulator[key] = value;
        return accumulator;
    }, {});
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function loadConfig(configPath) {
    var resolvedConfigPath = path.resolve(rootDir, configPath || defaultConfigPath);
    return readJson(resolvedConfigPath);
}

function validatePlatformConfig(platformName, platformConfig) {
    ['packageVersion', 'binaryVersion', 'url', 'sha256', 'archiveType', 'binaryName'].forEach(function (key) {
        if (!platformConfig[key]) {
            throw new Error('Missing "' + key + '" for ' + platformName + ' in config/platforms.json');
        }
    });
}

function updatePlatformPackage(platformName, packageInfo, platformConfig) {
    var packageJson = readJson(packageInfo.packageJsonPath);

    validatePlatformConfig(platformName, platformConfig);

    if (packageJson.screenpipe.binaryName !== platformConfig.binaryName) {
        throw new Error(
            'Binary name mismatch for ' +
                platformName +
                '. package.json expects "' +
                packageJson.screenpipe.binaryName +
                '" but config/platforms.json has "' +
                platformConfig.binaryName +
                '"'
        );
    }

    packageJson.version = platformConfig.packageVersion;
    packageJson.screenpipe.version = platformConfig.binaryVersion;
    packageJson.screenpipe.url = platformConfig.url;
    packageJson.screenpipe.sha256 = platformConfig.sha256;
    packageJson.screenpipe.archiveType = platformConfig.archiveType;

    writeJson(packageInfo.packageJsonPath, packageJson);
}

function updateMetaPackage(metaPackageVersion, config, platformNames) {
    var packageJson = readJson(metaPackagePath);

    if (metaPackageVersion) {
        packageJson.version = metaPackageVersion;
    }
    platformNames.forEach(function (platformName) {
        packageJson.optionalDependencies['@screenpipe-installer/' + platformName] = config.platforms[platformName].packageVersion;
    });

    writeJson(metaPackagePath, packageJson);
}

function main() {
    var args = parseArgs(process.argv.slice(2));
    var config = loadConfig(args.config);
    var platformNames = Object.keys(packagePaths);

    platformNames.forEach(function (platformName) {
        updatePlatformPackage(platformName, packagePaths[platformName], config.platforms[platformName] || {});
    });

    updateMetaPackage(args.version, config, platformNames);
}

if (require.main === module) {
    main();
}

module.exports = {
    loadConfig: loadConfig,
    main: main,
    parseArgs: parseArgs,
    validatePlatformConfig: validatePlatformConfig
};
