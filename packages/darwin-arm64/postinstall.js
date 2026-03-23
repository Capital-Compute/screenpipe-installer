'use strict';

var install = require('./lib/install').install;

if (require.main === module) {
    install().catch(function (error) {
        console.error(error.message);
        process.exit(1);
    });
}
