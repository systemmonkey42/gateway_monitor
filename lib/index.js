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

    fms.connect( ()=>console.log('connected!') )
        .then(()=>console.log('++ connected!'))
        .then(()=>fms.version())
        .then(([result])=>console.log('result = ' + JSON.stringify(result,0,4)))
        .then(()=>fms.getdeviceinfo({
            eid:"7cd762000cf0ffff"
        }))
        .then( ([result])=>console.log('result = ' + JSON.stringify(result,0,4)))
        .catch((e)=>console.log('msg ' + e));
})();
