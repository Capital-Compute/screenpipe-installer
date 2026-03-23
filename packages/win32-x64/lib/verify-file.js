'use strict';

var fs = require('fs');

function verifyFile(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (error) {
        return false;
    }
}

module.exports = verifyFile;
