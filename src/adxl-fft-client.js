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

/*jslint bitwise: true */

'use strict';
import 'source-map-support/register';
import { EventEmitter } from 'events';
import SerialPort from 'serialport';
import hexdump from 'hexdump-nodejs';

const SAMPLES = 800; // up to 2030

export class ADXL100xFFTClient {
  static get SAMPLES() { return SAMPLES; }
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
    }
    this.emitFftValues = e.emitFftValues;
    this.closed = true;
    this.frequencyLabels = [];
    for (let t = 0; t < SAMPLES; t++) {
      this.frequencyLabels.push(Math.floor((20 * t) / (SAMPLES - 1)) + 'kHz');
    }
  }

  _createUartCommandPromise(e, t) {
    return this._createCommandPromise('CPS', '0000').then(() => {
      return this._createCommandPromise(e, t);
    });
  }

  _createCommandPromise(o, a) {
    return new Promise((resolve, reject) => {
      const req = `:0 ${o} ${a}`;
      this.debug(`req(text):[${req}]`);
      this.port.write(`${req}\r`);
      this.bus.once('command-response', e => {
        const res = e.toString();
        if (res.startsWith('OK')) {
          this.debug(`res(text):[${res}]`);
          return resolve();
        }
        reject(
          new Error(`CMD: ${o} ${a}, Unexpected response:\n${hexdump(e)}`)
        );
      });
    });
  }

  _onStopRequested() {
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
    });
  }

  _onShutdownRequested() {
    return this._onStopRequested().then(() => {
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
    this.commandMode = false;
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
          this.debug(`[FFT header]\n${hexdump(this.fftHeader)}`);
          this.debug(`FFT body size => ${this.fftBodySize}`);
          this.fftHeaderInProgress = false;
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
    return new Promise(n => {
      const t = () => {
        this.port = new SerialPort(this.serialport, {
          baudRate: 230400
        });
        this.port.on('close', () => {
          this.bus.emit('disconnected'), (this.closed = true);
        });
        this.port.on('error', e => {
          this.debug('[error] ' + e.stack);
          this.closed &&
            this.port.close(() => {
              this.log('[info] trying to re-connect'), setTimeout(t, 5e3);
            });
          this.bus.emit('error');
        });
        this.port.on('open', () => {
          this.closed = false;
          this.commandMode = true;
          this.debug('Serial port (' + this.serialport + ') is now open.');
          let timer = null;
          const ping = () => {
            this.port.write('\r');
            timer = setTimeout(ping, 100);
          };
          timer = setTimeout(ping, 100);
          this.port.write('\r');
          this.bus.once('command-response', e => {
            clearTimeout(timer);
            return n(e);
          });
        });
        let r = null;
        this.port.on('data', e => {
          this.commandMode
            ? ((r = r || Buffer.from([])),
              (1 < (r = Buffer.concat([r, e])).length &&
                10 === r[r.length - 2]) ||
              13 === r[r.length - 1]
                ? (this.bus.emit('command-response', r), (r = null))
                : this.bus.emit('command-response-data', e))
            : this.bus.emit('fft', e);
        });
      };
      setTimeout(t, 0);
    });
  }

  start() {
    return this._openSerialPort().then(e => {
      this.debug(`[initialMessage]\n${hexdump(e)}`);
      return new Promise((resolve, reject) => {
        let trial = 0;
        const init = () => {
          this.debug(`[start] initialzing parameters...`);
          this._onInitCompleted()
            .then(resolve)
            .catch(err => {
              this.debug(
                `[start] Error while initialzing: trial=${trial}, err=${err.message ||
                  err}`
              );
              if (trial > 3) {
                return reject(err);
              }
              this._onStopRequested().finally(() => {
                setTimeout(init, 100);
                ++trial;
              });
            });
        };
        process.nextTick(init);
      });
    });
  }

  shutdown() {
    let r = this;
    if (this.closed) {
      return Promise.resolve();
    }
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
    ) {
      throw new Error('No input!');
    }
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

  _parseDataBuf(dataBuf) {
    if (!dataBuf) {
      throw new Error('No input!');
    }
    if (Array.isArray(dataBuf)) {
      dataBuf = Buffer.from(dataBuf);
    } else if (!Buffer.isBuffer(dataBuf)) {
      dataBuf = Buffer.from(dataBuf.toString());
    }
    // FFT_Timestamp
    const timestamp = dataBuf[0] + 256 * dataBuf[1] + 65536 * dataBuf[2] + 16777216 * dataBuf[3];
    let r = [];
    let n = null;
    for (let o = 8; o < 20; o += 3) {
      n = ((15 & dataBuf[o + 1]) << 8) + dataBuf[o];
      r.push({
        frequency: n
      });
      n = (dataBuf[o + 2] << 4) + ((240 & dataBuf[o + 1]) >> 4);
      r.push({
        frequency: n
      });
    }

    let a = null;
    let i = null;
    for (let u = 0; u < 8; u++) {
      (i =
        ((((1 - 2 * ((128 & (a = dataBuf[21 + 2 * u])) >> 7)) *
          Math.pow(2, (124 & a) >> 2)) /
          32768) *
          (1024 + 256 * (3 & a) + dataBuf[20 + 2 * u])) /
        1024),
        (r[u].amplitude = i);
    }
    let f = null;
    if (this.emitFftValues) {
      f = Array(SAMPLES);
      for (let s = 0; s < SAMPLES; s++) {
        let c = 36 + 2 * s;
        f[s] = this._byte2binary16(dataBuf[c] + 256 * dataBuf[c + 1]);
      }
    }
    return {
      raw: f,
      timestamp,
      peaks: r
    };
  }

  _convertAmp(e) {
    return 20 * Math.log10(e) - 34;
  }

  format(e, topic, r, payloadFormat) {
    let o = this,
      a = {
        timestamp: e.timestamp,
        topic
      };
    r < 0 ? (r = 0) : 8 < r && (r = 8);
    let i = e.peaks.slice(0, r);
    switch (payloadFormat) {
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
        'chart' === payloadFormat &&
          i.forEach((e, t) => {
            u.push('Peak' + (t + 1));
            let r = Array(SAMPLES).fill(0);
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
