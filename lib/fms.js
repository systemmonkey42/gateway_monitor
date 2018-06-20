#!/usr/bin/env npm

//////////////////////////////////////////////////////////////////////////////////
//
// FMS module:
//    Supports all know FMS API calls and returns promises for handling data and errors
//
//    Supports websocket connections to the FMS.  This returns an EventEmitter which provides
//    the following events:
//
//   Events:
//   'connectFailed'        Event generated when a connection failure occurred
//   'error'                Event generated for various error conditions
//   'close'                Event generated when connection closes
//   'message'              Event generated when data arrives on the socket.
//   Methods:
//   connect([subprotocol]) Connect the websocket, optionally specifying a subprotocol. 
//                          Default is 'echo-protocol'
//   close([code],[description])  Close the websocket connection, optionally specifying a
//                          response code and description
//   send(data)             Send data to the websocket endpoint
//
//////////////////////////////////////////////////////////////////////////////////

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
const websocket = require('websocket');

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
        for(var key of [ 'check_login', 'set_device', 'get_alert', 'gateway_delete_device', 'deactivate_ota_app', 'del_ota_event', 'device_send_command', 'get_client_sessions', 'get_mysession', 'add_device', 'get_transfer_status', 'add_ota_bundle', 'transfer_bundle_to_device', 'delete_app', 'get_application_cmds', 'gateway_activate_device', 'upload_application', 'del_ota_bundle', 'add_client', 'gateway_delete_bundle', 'get_meter_by_eid', 'remove_device', 'add_gateway', 'get_bundle_details', 'edit_app', 'add_ota_event', 'set_config', 'get_gas_meter', 'get_clients', 'get_transactions', 'device_remove_app', 'version', 'get_device_info', 'get_device_member', 'activate_ota_app', 'get_listen_port' ]) {
            var method = key.replace(/_/g,'');
            FMS.prototype[method] = ((method) => (args) => this.request(method,args))(method);
            FMS.prototype[key] = FMS.prototype[method];
            FMS.prototype[key.replace(/_[a-z]/g, str => str[1].toUpperCase())] = FMS.prototype[method];
        }
    };

    FMS.prototype.sessionSave = function() {
        if( this.session ) {
            fs.writeFileSync('/tmp/session.json', JSON.stringify(this.session,0,4));
        }
    };

    FMS.prototype.formatRequest = function(cmd,opts) {
        var request = '/' + cmd;

        if( this.session && this.session.sessionid ) {
            opts = opts || {};
            opts.sessionid = this.session.sessionid;
        }

        if( opts ) {
            request += '?';
            request += Object.keys(opts).map( e => e+'='+opts[e]).join('&');
        }
        return request;
    };

    FMS.prototype.request = function(cmd, opts) {
        cmd = cmd.toLowerCase();
        return new Promise(
            (fulfill,reject) => {
                var _url = url.parse(this.opts.url);
                _url.path = this.formatRequest(cmd, opts);

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
                                fulfill(body);
                            } else {
                                reject(new Error('Invalid response.'));
                            }
                        });
                    });
            }
        );
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
                this.session.ws_host = result.host;
                this.session.ws_port = result.ws_port;
                this.sessionSave();
                return [result,headers];
            });
    };

    FMS.prototype.connect = function() {
        return this.checkLogin()
        .catch((e) => {
            if( e.message.match( 'session' ) ) {
                return this.login();
            } else {
                throw e;
            }
        });
    };

    FMS.prototype.websocket = function() {
        var wscon = new EventEmitter();

        var _url = url.parse(this.opts.url);
        _url.hostname = this.session.ws_host;
        _url.port = this.session.ws_port;
        _url.protocol = 'ws:';
        _url.path = this.formatRequest('ws');

        wscon.client = new websocket.client()
            .on('connectFailed', e => wscon.emit('connectFailed',e))
            .on('connect', conn => {
                wscon.connection = conn;
                conn
                    .on('error', e => wscon.emit('error',e))
                    .on('close', () => wscon.emit('close'))
                    .on('message', msg => {
                        try {
                            var key = msg.type;
                            var payload = JSON.parse(msg[key+'Data']);
                            wscon.emit('message', payload);
                        } catch(e) {
                            conn.emit('error', new Error('malformed JSON payload'));
                        }
                    });
            });

        wscon.connect = proto => {
            wscon.client.connect( _url, proto || this.session.ws_protocol || 'echo-protocol' );
            return wscon;
        };

        wscon.close = () =>
            wscon.connection && wscon.connection.close.apply(wscon.connection,arguments);

        wscon.send = data => wscon.connection && wscon.connection.sendUTF( data.toString() );
        wscon.request = (cmd,data) => wscon.connection && wscon.connection.sendUTF( JSON.stringify(
            {
                cmd: cmd,
                params: data
            }
        ));

        return wscon;
    };

    return FMS;
})();
