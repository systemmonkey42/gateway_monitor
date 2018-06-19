#!/usr/bin/env npm

// jshint node:true
// jshint esnext:false
// jshint esversion:6

const FMS = require('./fms');

(function() {
    "use strict";

    var fms = new FMS({
        url: 'https://fms.gochangprovisioning.cloud.freestyleiot.co.kr',
        login: 'freestyle',
        password: 'freestyle'
    });

    fms.connect(()=>console.log('connected!'));

    fms.on('response',(res) => {
        console.log('strange days...' + JSON.stringify(res,0,4));
    });
})();
