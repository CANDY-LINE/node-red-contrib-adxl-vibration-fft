/**
 * @license
 * Copyright (c) 2018 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
Object.defineProperty(exports, '__esModule', {
    value: !0
}), exports.default = function(i) {
    var o = {},
        e = function() {
            Object.keys(o).forEach(function(e) {
                o[e].shutdown()
            })
        };
    process.on('exit', e), i.settings && i.settings.exitHandlers && i.settings.exitHandlers.push(e);
    i.nodes.registerType('ADXL100x FFT', function e(t) {
        var s = this;
        if (_classCallCheck(this, e), i.nodes.createNode(this, t), this.serialport = t.serialport, o[this.serialport]) throw Error('Duplicate serialport configuration for ADXL100zFFTNode!');
        this.identifier = t.identifier, this.enabled = !!t.enabled, this.emitFftValues = !!t.emitFftValues, this.nodes = {}, ['connected', 'disconnected', 'error'].forEach(function(i) {
            s.on(i, function() {
                for (var e = arguments.length, t = Array(e), n = 0; n < e; n++) t[n] = arguments[n];
                try {
                    Object.keys(s.nodes).forEach(function(e) {
                        s.nodes[e].emit(i, t)
                    })
                } catch (e) {
                    s.error(e)
                }
            })
        }), this.on('data', function(i) {
            try {
                Object.keys(s.nodes).forEach(function(e) {
                    if (s.nodes[e].input) {
                        var t = parseInt(s.nodes[e].numOfPeaks || 0),
                            n = s.nodes[e].payloadFormat;
                        s.nodes[e].send(s.client.format(i, s.identifier, t, n))
                    }
                })
            } catch (e) {
                s.error(e)
            }
        }), this.on('close', function(t) {
            return delete o[s.serialport], s.client.shutdown().then(function() {
                t()
            }).catch(function(e) {
                s.log(e), t()
            })
        });
        var n = this;
        this.operations = {
            register: function(e) {
                return !!e && !n.nodes[e.id] && (n.nodes[e.id] = e, n.client.closed ? e.emit('disconnected') : e.emit('connected'), !0)
            },
            remove: function(e) {
                return !(!e || !n.nodes[e.id] || (delete n.nodes[e.id], 0))
            },
            shutdown: function() {
                return n.client.shutdown()
            }
        }, this.client = new _adxl100xFftClient.ADXL100zFFTClient(this), this.enabled ? (o[this.serialport] = this.client, this.client.start()) : process.nextTick(function() {
            s.emit('disconnected')
        })
    });
    i.nodes.registerType('ADXL100x FFT in', function e(t) {
        var n = this;
        _classCallCheck(this, e), i.nodes.createNode(this, t), this.name = t.name, this.input = !0, this.payloadFormat = t.payloadFormat, this.numOfPeaks = t.numOfPeaks, this.adxl100xFFTNodeId = t.adxl100xFFT, this.adxl100xFFTNode = i.nodes.getNode(this.adxl100xFFTNodeId), this.adxl100xFFTNode && (this.on('connected', function() {
            var e = 0 < arguments.length && void 0 !== arguments[0] ? arguments[0] : 0;
            n.status({
                fill: 'green',
                shape: 'dot',
                text: i._('adxl100x-fft.status.connected', {
                    n: e
                })
            })
        }), ['disconnected', 'error'].forEach(function(e) {
            n.on(e, function() {
                n.status({
                    fill: 'red',
                    shape: 'ring',
                    text: 'adxl100x-fft.status.' + e
                })
            })
        }), this.on('close', function() {
            n.adxl100xFFTNode && n.adxl100xFFTNode.operations.remove(n)
        }), this.adxl100xFFTNode.operations.register(this))
    }), i.httpAdmin.get('/adxl100x-fft-ports', i.auth.needsPermission('serial.read'), function(e, n) {
        _serialport2.default.list(function(e, t) {
            n.json(t)
        })
    })
}, require('source-map-support/register');
var M, _serialport = require('serialport'),
    _serialport2 = (M = _serialport) && M.__esModule ? M : {
        default: M
    },
    _adxl100xFftClient = require('./adxl100x-fft-client');

function _classCallCheck(e, t) {
    if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function')
}
module.exports = exports.default;
