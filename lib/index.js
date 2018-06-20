#!/usr/bin/env npm

// jshint node:true
// jshint esnext:false
// jshint esversion:6

const FMS = require('./fms');
const fs = require('fs');

(function() {
    "use strict";

    var gateways = {};

    var fms = new FMS({
        url: 'https://fms.gochangprovisioning.cloud.freestyleiot.co.kr',
        login: 'freestyle',
        password: 'freestyle'
    });

    var loadGateways = function() {
        gateways = {};
        if( fs.existsSync('/tmp/gateways.json') ) {
            var buffer = fs.readFileSync( '/tmp/gateways.json' );
            try {
                gateways = JSON.parse( buffer );
            } catch(e) {
                fs.unlinkSync( '/tmp/gateways.json' );
                return loadGateways();
            }
        } else {
            return fms.getDeviceInfo( { type: 'gateways' } ).then( data => {
                gateways = data;
                fs.writeFileSync( '/tmp/gateways.json', JSON.stringify(gateways) );
            });
        }
    };

    fms.connect( () => console.log('connected!') )
        .catch( e => {
            console.log('msg ' + e);
            process.exit(0);
        })
        .then(() => loadGateways())
        .then(() => {
            var ws = fms.websocket()
                .on('message', msg =>  {
                    console.log( Object.keys(msg));
                    if( msg.FME_APP === undefined && (msg.GW_STATUS === undefined || msg.GW_STATUS.result.cid > 0)) {
                        console.log('incoming: ' + JSON.stringify(msg,0,4));
                    }
                })
                .on('connectFailed', msg => console.log('Connection error: ' + JSON.stringify(msg,0,4)))
                .on('error', msg => console.log('error: ' + JSON.stringify(msg,0,4)))
                .connect();
            setTimeout(() => { 
                ws.request( 'devicesendcommand', { command: 'GW_STATUS', eid: '7cd7620016eaffff' });
            },2000);
        });
})();
