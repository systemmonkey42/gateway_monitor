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
        //Object.assign(this.opts,opts);
        if( fs.existsSync( '/tmp/session.json' ) ) {
            var session_buf = fs.readFileSync( '/tmp/session.json' );
            this.session = JSON.parse(session_buf);
        }
    };

    FMS.prototype.sessionSave = function() {
        if( this.session ) {
            fs.writeFileSync('/tmp/session.json', JSON.stringify(this.session,0,4));
        }
    };

    FMS.prototype.request = function(cmd, opts) {
        var _url = url.parse(this.opts.url);
        var _path = '/';
        _path += cmd;
        console.log('session = ' + JSON.stringify(this.session,0,4));
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
        console.log('url = ' + JSON.stringify(_url,0,4));
        return protocol.get( _url )
            .on('error', (err) => {
                console.log('Connection to FMS failed: ' + err);
                console.log(err.stack);
                process.exit(1);
            }).on('response', (res) => {
                var body = '';
                res.on('data', (data) => {
                    body += data;
                }).on('end', () => {
                    console.log('end1');
                    if( res.headers['content-type'] == 'application/json' ) {
                        body = JSON.parse(body);
                    }
                    this.emit('response', body);
                });
            });
    };

    FMS.prototype.checkLogin = function(cb) {
        console.log('checklogin');
        console.log('session = ' + JSON.stringify(this.session));

        var req = this.request( 'checklogin' );

        req.on('response', (res) => {
            var body='';
            res.on('data', (data) => {
                body+=data;
            });
            res.on('end', () => {
                console.log('checklogin headers = ' + JSON.stringify(res.headers,0,4));
                console.log('checklogin data = ' + body);
                return cb && cb();
            });
        });
    };

    FMS.prototype.login = function(cb) {

        var req = this.request( 'login', {
            username: this.opts.login,
            password: this.opts.password
        });

        req.on('response',(res) => {
            var body='';
            res.on('data', (data) => {
                body+=data;
            });
            res.on('end', () => {
                if( res.headers['content-type'] == 'application/json' ) {
                    body = JSON.parse(body);
                }
                if( body.response === 'ok' ) {
                    this.session = {};
                    this.session.sessionid = body.sessionid;
                    this.session.expire_at = body.export_at;
                    this.session.host = body.host;
                    this.session.ws_port = body.ws_port;
                    this.sessionSave();
                }
                cb && cb();
            });
        });
    };

    FMS.prototype.connect = function(cb) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

        return this.checkLogin( cb );
    };

    util.inherits(FMSRequest,EventEmitter);

    return FMS;
})();

module.exports.FMSRequest = (function() {
    "use strict";
})();
