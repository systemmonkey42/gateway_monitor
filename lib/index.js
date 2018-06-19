#!/usr/bin/env npm

// jshint node:true
// jshint esnext:false
// jshint esversion:6

const FMS = require('./fms');

(function() {
    "use strict";

    var fms = new FMS({
        url: 'https://fms.gochangprovisioning.cloud.freestyle.co.kr',
        login: 'freestyle',
        password: 'freestyle'
    });

    fms.start();
    console.log('hello world');
})();
