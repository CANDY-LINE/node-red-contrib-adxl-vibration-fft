/**
 * @license
 * Copyright (c) 2018 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
import 'source-map-support/register';
import { EventEmitter } from 'events';
import SerialPort from 'serialport';

export class ADXL100xFFTClient {
  constructor(e = {}) {
    this.serialport = e.serialport;
    this.log = e.log ? e.log.bind(e) : console.log;
    this.trace = e.trace ? e.trace.bind(e) : console.log;
    this.debug = e.debug ? e.debug.bind(e) : console.log;
    this.error = e.error ? e.error.bind(e) : console.error;
    this.log = e.log ? e.log.bind(e) : console.log;
    if (e instanceof EventEmitter) {
      this.bus = e;
    } else {
      this.bus = e.bus || new EventEmitter();
      this.emitFftValues = e.emitFftValues;
    }
    this.closed = true;
    this.frequencyLabels = [];
    for (let t = 0; t < 800; t++) {
      this.frequencyLabels.push(Math.floor((20 * t) / 799) + 'kHz');
    }
  }

  _createUartCommandPromise(e, t) {
    return this._createCommandPromise('CPS', '0000').then(() => {
      return this._createCommandPromise(e, t);
    });
  }

  _createCommandPromise(o, a) {
    return new Promise((resolve, reject) => {
      this.port.write(':0 ' + o + ' ' + a + '\r');
      this.bus.once('command-response', e => {
        const res = e.toString();
        if (res.startsWith('OK')) {
          return resolve();
        }
        reject(
          new Error('CMD: ' + o + ' ' + a + ', Unexpected response: ' + res)
        );
      });
    });
  }

  _onShutdownRequested() {
    return new Promise(resolve => {
      this.commandMode = true;
      const creCommand = () => {
        this._createCommandPromise('CRE', '0000')
          .then(() => {
            resolve();
          })
          .catch(() => {
            this.log('[_onShutdownRequested] error retry...');
            setTimeout(creCommand, 100);
          });
      };
      setTimeout(creCommand, 0);
    }).then(() => {
      return this._createCommandPromise('SRS', '0000');
    });
  }

  _onInitCompleted() {
    return this._createCommandPromise('CPS', '0000')
      .then(() => {
        return this._createUartCommandPromise('RMC', '0000');
      })
      .then(() => {
        return this._createUartCommandPromise('RRP', '001s');
      })
      .then(() => {
        return this._createUartCommandPromise('BSZ', '0000');
      })
      .then(() => {
        return this._createUartCommandPromise('DFA', '0001');
      })
      .then(() => {
        return this._createUartCommandPromise('AL1', '0002');
      })
      .then(() => {
        return this._createUartCommandPromise('AH1', '0800');
      })
      .then(() => {
        return this._createUartCommandPromise('AL8', '0300');
      })
      .then(() => {
        return this._createUartCommandPromise('AH8', '0600');
      })
      .then(() => {
        return this._createUartCommandPromise('AC8', '0003');
      })
      .then(() => {
        return this._createCommandPromise('CRS', '0000');
      })
      .then(() => {
        return this._onFftReady();
      });
  }

  _onFftReady() {
    this.commandMode = !1;
    this.fftHeaderInProgress = true;
    this.fftHeader = null;
    this.bus.emit('connected');
    this.debug('[_onFftReady] OK');
    this.bus.on('fft', e => {
      for (; 0 < e.length; ) {
        if (this.fftHeaderInProgress) {
          this.fftHeader = this.fftHeader || Buffer.from([]);
          const t = this.fftHeader.length;
          if (
            ((this.fftHeader = Buffer.concat([
              this.fftHeader,
              e.slice(0, 12 - t)
            ])),
            12 !== this.fftHeader.length)
          ) {
            return;
          }
          this.fftBodySize = 256 * this.fftHeader[9] + this.fftHeader[10] + 4;
          this.debug(
            'FFT header => [' +
              this.fftHeader.toString() +
              '], [' +
              this.fftHeader.toString('hex') +
              ']'
          );
          this.debug('FFT body size => ' + this.fftBodySize);
          this.fftHeaderInProgress = !1;
          this.fftBody = Buffer.from([]);
          e = e.slice(12 - t);
        }
        const r = this.fftBodySize - this.fftBody.length;
        this.fftBody = Buffer.concat([this.fftBody, e.slice(0, r)]);
        e = e.slice(r);
        if (this.fftBody.length === this.fftBodySize) {
          this.bus.emit('fft-data-arrived', {
            header: this._parseNotifyBuf(this.fftHeader),
            body: this._parseDataBuf(this.fftBody)
          });
          this.fftHeaderInProgress = true;
          this.fftHeader = null;
          this.fftBody = null;
          this.fftBodySize = 0;
        }
      }
    });
    this.bus.on('fft-data-arrived', e => {
      this.debug('[fft-data-arrived] command => ' + e.header.command);
      if ('XFD' === e.header.command) {
        this.bus.emit('data', e.body);
      }
    });
  }

  _openSerialPort() {
    let o = this;
    return new Promise(n => {
      setTimeout(function t() {
        o.port = new SerialPort(o.serialport, {
          baudRate: 230400
        });
        o.port.on('close', () => {
          o.bus.emit('disconnected'), (o.closed = true);
        });
        o.port.on('error', e => {
          o.debug('[error] ' + e.stack);
          o.closed &&
            o.port.close(() => {
              o.log('[info] trying to re-connect'), setTimeout(t, 5e3);
            });
          o.bus.emit('error');
        });
        o.port.on('open', () => {
          o.closed = !1;
          o.commandMode = true;
          o.debug('Serial port (' + o.serialport + ') is now open.');
          let t = null;
          t = setTimeout(function e() {
            o.port.write('\r'), (t = setTimeout(e, 100));
          }, 100);
          o.port.write('\r');
          o.bus.once('command-response', e => {
            return clearTimeout(t), n(e);
          });
        });
        let r = null;
        o.port.on('data', e => {
          o.commandMode
            ? ((r = r || Buffer.from([])),
              (1 < (r = Buffer.concat([r, e])).length &&
                10 === r[r.length - 2]) ||
              13 === r[r.length - 1]
                ? (o.bus.emit('command-response', r), (r = null))
                : o.bus.emit('command-response-data', e))
            : o.bus.emit('fft', e);
        });
      }, 0);
    });
  }

  start() {
    let r = this;
    return this._openSerialPort().then(e => {
      let t = e.toString();
      r.debug('initialMessage => ' + t);
      return r._onInitCompleted();
    });
  }

  shutdown() {
    let r = this;
    if (this.closed) return Promise.resolve();
    return (this.commandMode
      ? Promise.resolve()
      : new Promise(e => {
          r.debug('Schedule the shutdown command...'),
            r.bus.once('data', () => {
              return e();
            });
        })
    ).then(() => {
      return new Promise((e, t) => {
        return r
          ._onShutdownRequested()
          .then(() => {
            ['fft', 'fft-data-arrived', 'command-response'].forEach(t => {
              r.bus.listeners(t).forEach(e => {
                return r.bus.removeListener(t, e);
              });
            });
          })
          .then(() => {
            r.port.close(() => {
              return e(true);
            });
          })
          .catch(e => {
            return t(e);
          });
      });
    });
  }

  _parseNotifyBuf(e) {
    if (
      (this.debug('[_parseNotifyBuf] buf => ' + e + ', len => ' + e.length), !e)
    )
      throw new Error('No input!');
    return (
      Array.isArray(e)
        ? (e = Buffer.from(e))
        : Buffer.isBuffer(e) || (e = Buffer.from(e.toString())),
      {
        command: e.slice(3, 6).toString(),
        size: 256 * e[9] + e[10]
      }
    );
  }
  _byte2binary16(e) {
    let t = 32768 & e,
      r = (e >> 10) & 31,
      n = 1023 & e;
    return 31 === r
      ? 0 === n
        ? t
          ? -1 / 0
          : 1 / 0
        : NaN
      : 0 === r
      ? 0 === n
        ? t
          ? -0
          : 0
        : 6103515625e-14 * (t ? -1 : 1) * (0 + 0.0009765625 * n)
      : (t ? -1 : 1) * Math.pow(2, r - 15) * (1 + 0.0009765625 * n);
  }

  _parseDataBuf(e) {
    if (!e) throw new Error('No input!');
    Array.isArray(e)
      ? (e = Buffer.from(e))
      : Buffer.isBuffer(e) || (e = Buffer.from(e.toString()));
    for (
      let t = e[0] + 256 * e[1] + 65536 * e[2] + 16777216 * e[3],
        r = [],
        n = null,
        o = 8;
      o < 20;
      o += 3
    )
      (n = ((15 & e[o + 1]) << 8) + e[o]),
        r.push({
          frequency: n
        }),
        (n = (e[o + 2] << 4) + ((240 & e[o + 1]) >> 4)),
        r.push({
          frequency: n
        });
    for (let a = null, i = null, u = 0; u < 8; u++)
      (i =
        ((((1 - 2 * ((128 & (a = e[21 + 2 * u])) >> 7)) *
          Math.pow(2, (124 & a) >> 2)) /
          32768) *
          (1024 + 256 * (3 & a) + e[20 + 2 * u])) /
        1024),
        (r[u].amplitude = i);
    let f = null;
    if (this.emitFftValues) {
      f = Array(800);
      for (let s = 0; s < 800; s++) {
        let c = 36 + 2 * s;
        f[s] = this._byte2binary16(e[c] + 256 * e[c + 1]);
      }
    }
    return {
      raw: f,
      timestamp: t,
      peaks: r
    };
  }

  _convertAmp(e) {
    return 20 * Math.log10(e) - 34;
  }

  format(e, t, r, n) {
    let o = this,
      a = {
        timestamp: e.timestamp,
        topic: t
      };
    r < 0 ? (r = 0) : 8 < r && (r = 8);
    let i = e.peaks.slice(0, r);
    switch (n) {
      case 'chart':
      case 'chartWithoutPeak':
        let u = ['FFT'],
          f = [
            e.raw
              ? e.raw.map(e => {
                  return o._convertAmp(e);
                })
              : []
          ];
        'chart' === n &&
          i.forEach((e, t) => {
            u.push('Peak' + (t + 1));
            let r = Array(800).fill(0);
            (r[e.frequency] = o._convertAmp(e.amplitude) + 10), f.push(r);
          }),
          (a.payload = [
            {
              series: u,
              data: f,
              labels: this.frequencyLabels
            }
          ]);
        break;
      case 'all':
        let s = e.raw
          ? Array.prototype.slice.call(e.raw, 0).map(e => {
              return o._convertAmp(e);
            })
          : null;
        a.payload = {
          peaks: i.map(e => {
            return {
              frequency: 0.025 * e.frequency,
              amplitude: o._convertAmp(e.amplitude)
            };
          }),
          fft: s
        };
        break;
      case 'peak':
        a.payload = i.map(e => {
          return {
            frequency: 0.025 * e.frequency,
            amplitude: o._convertAmp(e.amplitude)
          };
        });
    }
    return a;
  }
}
