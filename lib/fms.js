#!/usr/bin/env npm

// jshint node:true
// jshint esnext:false
// jshint esversion:6
// jshint expr:true

const fs = require('fs');
const http = require('http');
const https = require('https');
const url = require('url');
const util = require('util');
const EventEmitter = require('events').EventEmitter;

module.exports = (function() {
    "use strict";

    var FMS = function(opts) {
        this.init(opts);
    };

    FMS.prototype.init = function(opts) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        this.opts = opts;
        this.agent = new http.Agent();
        if( fs.existsSync( '/tmp/session.json' ) ) {
            var session_buf = fs.readFileSync( '/tmp/session.json' );
            this.session = JSON.parse(session_buf);
        }
        for(var method of [ 'setdevice', 'getalert', 'gatewaydeletedevice', 'deactivateotaapp', 'delotaevent', 'devicesendcommand', 'getclientsessions', 'getmysession', 'adddevice', 'gettransferstatus', 'addotabundle', 'transferbundletodevice', 'deleteapp', 'getapplicationcmds', 'gatewayactivatedevice', 'uploadapplication', 'delotabundle', 'addclient', 'gatewaydeletebundle', 'gettypemeters.json', 'getmeterbyeid', 'removedevice', 'addgateway', 'getbundledetails', 'editapp', 'addotaevent', 'setconfig', 'getgasmeter', 'getclients', 'gettransactions', 'deviceremoveapp', 'version', 'getdeviceinfo', 'getdevicemember', 'activateotaapp' ]) {
            FMS.prototype[method] = ((method) => (args) => this.request(method,args))(method);
        }
    };

    FMS.prototype.sessionSave = function() {
        if( this.session ) {
            fs.writeFileSync('/tmp/session.json', JSON.stringify(this.session,0,4));
        }
    };

    FMS.prototype.request = function(cmd, opts) {
        cmd = cmd.toLowerCase();
        return new Promise(
            (fulfill,reject) => {
                var _url = url.parse(this.opts.url);
                var _path = _url.path;
                _path += cmd;

                if( this.session && this.session.sessionid ) {
                    opts = opts || {};
                    opts.sessionid = this.session.sessionid;
                }

                if( opts ) {
                    _path += '?';
                    _path += Object.keys(opts).map((e)=>e+'='+opts[e]).join('&');
                }

                _url.path = _path;

                var protocol = _url.protocol.match('https') >= 0 ? http:https;
                var req = protocol.get( _url )
                    .on('error', (err) => {
                        console.log('Connection to FMS failed: ' + err);
                        console.log(err.stack);
                        reject(err);
                    }).on('response', (res) => {
                        var body = '';
                        res.on('data', (data) => {
                            body += data;
                        }).on('end', () => {
                            if( res.headers['content-type'] === 'application/json' ) {
                                body = JSON.parse(body);
                                // Catch responses which should be errors
                                if( body.response !== undefined && body.response !== 'ok' ) {
                                    reject(new Error(cmd + ': ' + body.response ));
                                }
                                fulfill([body,res.headers]);
                            } else {
                                reject(new Error('Invalid response.'));
                            }
                        });
                    });
            }
        );
    };

    FMS.prototype.checkLogin = function() {
        return this.request( 'checklogin' );
    };

    FMS.prototype.login = function() {

        return this.request( 'login', {
            username: this.opts.login,
            password: this.opts.password
        })
            .then( ([result,headers]) => {
                this.session = {};
                this.session.sessionid = result.sessionid;
                this.session.expire_at = result.export_at;
                this.session.host = result.host;
                this.session.ws_port = result.ws_port;
                this.sessionSave();
                return [result,headers];
            });
    };

    FMS.prototype.connect = function(cb) {
        return this.checkLogin( cb )
        .catch((e) => {
            if( e.message.match( 'session' ) ) {
                return this.login();
            } else {
                throw e;
            }
        });
    };

    return FMS;
})();
