#!/usr/bin/env npm

// jshint node:true
// jshint esnext:false
// jshint esversion:6

const fs = require('fs');

module.exports = (function() {
    "use strict";
    var FMS = function(opts) {
        this.init(opts);
    };

    FMS.prototype.init = function(opts) {
        Object.assign(this,opts);
        if( fs.existsSync( '/tmp/session.json' ) ) {
            var session_buf = fs.readFileSync( '/tmp/session.json' );
            this.session = JSON.parse(session_buf);
        }
    };

    FMS.prototype.connect = function() {
        
    };

    return FMS;
})();
