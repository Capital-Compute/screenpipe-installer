'use strict';

var path = require('path');
var verifyFile = require('./lib/verify-file');

var packageJson = require('./package.json');
var binaryPath = path.join(__dirname, 'bin', packageJson.screenpipe.binaryName);

if (!verifyFile(binaryPath)) {
    throw new Error('Could not find screenpipe executable at "' + binaryPath + '"');
}

module.exports = {
    path: binaryPath,
    version: packageJson.screenpipe.version,
    url: packageJson.screenpipe.url
};
