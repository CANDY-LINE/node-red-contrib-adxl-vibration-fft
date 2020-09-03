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
import debugLogger from 'debug';

const debug = debugLogger('node-red-contrib-adxl-vibration-fft:index');

const FFT_POINTS = 4096;
const GRAPH_INDICATION_DELTA = 10; // A gap to avoid overlap the peak indicator on the graph
const RAW_MSG_HEADER_LENGTH = 12;
const FFT_DATA_HEADER_PEAK_FREQ_IDX = 8;
const FFT_DATA_HEADER_PEAK_VAL_IDX = 20;

const EDGE_DEVICE_CONFIG = {
  generic: {
    sampleFreq: 102.4,
    ampFullscale: 20,
    ampCorrection: 34,
    freqRange: 20,
    fftDataOffset: 0,
    peakFinder: 'Header',
  },
  uq: {
    sampleFreq: 107.5,
    ampFullscale: 20,
    ampCorrection: 20,
    freqRange: 2,
    fftDataOffset: 2 * 3, // Peak, RMS, CF
    peakFinder: 'Body',
    peakFinderByBody: {
      startIndex: 2,
    },
  },
};
Object.values(EDGE_DEVICE_CONFIG).forEach((config) => {
  config.samples = parseInt(
    (FFT_POINTS / config.sampleFreq) * config.freqRange
  );
});

export class ADXL100xFFTClient {
  constructor(opts = {}) {
    this.serialport = opts.serialport;
    if (opts instanceof EventEmitter) {
      this.bus = opts;
    } else {
      this.bus = opts.bus || new EventEmitter();
    }
    this.emitFftValues = opts.emitFftValues;
    this.closed = true;
    this.frequencyLabels = [];
    this.edgeDeviceModel = opts.edgeDeviceModel || 'generic';
    this.edgeDeviceConfig = EDGE_DEVICE_CONFIG[this.edgeDeviceModel];
    const { samples, freqRange, peakFinder } = this.edgeDeviceConfig;
    for (let i = 0; i < samples; i++) {
      this.frequencyLabels.push(
        `${Math.floor(((freqRange * i) / (samples - 1)) * 10) / 10}kHz`
      );
    }
    this._findPeaks = this[`_findPeaksBy${peakFinder}`].bind(this);
    debug(
      `$$$$$$$$$$ [ADXL100xFFTClient] opts.edgeDeviceModel=>[${opts.edgeDeviceModel}], this.edgeDeviceModel=>[${this.edgeDeviceModel}]`
    );
  }

  async _createUartCommand(cmd, param) {
    await this._createCommand('CPS', '0000');
    return this._createCommand(cmd, param);
  }

  _createCommand(cmd, param) {
    return new Promise((resolve, reject) => {
      const req = `:0 ${cmd} ${param}`;
      debug(`req(text):[${req}]`);
      this.port.write(`${req}\r`);
      this.bus.once('command-response', (e) => {
        const res = e.toString();
        if (res.startsWith('OK')) {
          debug(`res(text):[${res}]`);
          return resolve();
        }
        reject(
          new Error(`CMD: ${cmd} ${param}, Unexpected response:\n${hexdump(e)}`)
        );
      });
    });
  }

  _onStopRequested() {
    return new Promise((resolve) => {
      this.commandMode = true;
      const creCommand = () => {
        this._createCommand('CRE', '0000')
          .then(() => {
            resolve();
          })
          .catch(() => {
            debug('[_onShutdownRequested] error retry...');
            setTimeout(creCommand, 100);
          });
      };
      setTimeout(creCommand, 0);
    });
  }

  async _onShutdownRequested() {
    await this._onStopRequested();
    return this._createCommand('SRS', '0000');
  }

  async _onInitCompleted() {
    await this._createCommand('CPS', '0000');
    await this._createUartCommand('RMC', '0000');
    await this._createUartCommand('RRP', '001s');
    await this._createUartCommand('BSZ', '0000');
    await this._createUartCommand('DFA', '0001');
    await this._createUartCommand('AL1', '0002');
    await this._createUartCommand('AH1', '0800');
    await this._createUartCommand('AL8', '0300');
    await this._createUartCommand('AH8', '0600');
    await this._createUartCommand('AC8', '0003');
    await this._createCommand('CRS', '0000');
    return this._onFftReady();
  }

  _onFftReady() {
    this.commandMode = false;
    this.rawMsgHeaderInProgress = true;
    this.rawMsgHeader = null;
    this.bus.emit('connected');
    debug('[_onFftReady] OK');
    this.bus.on('fft', (dataBuf) => {
      for (; 0 < dataBuf.length; ) {
        if (this.rawMsgHeaderInProgress) {
          this.rawMsgHeader = this.rawMsgHeader || Buffer.from([]);
          const headerLength = this.rawMsgHeader.length;
          if (
            ((this.rawMsgHeader = Buffer.concat([
              this.rawMsgHeader,
              dataBuf.slice(0, RAW_MSG_HEADER_LENGTH - headerLength),
            ])),
            RAW_MSG_HEADER_LENGTH !== this.rawMsgHeader.length)
          ) {
            return;
          }
          this.rawMsgBodySize =
            256 * this.rawMsgHeader[9] + this.rawMsgHeader[10] + 4;
          debug(`[RAW MSG header]\n${hexdump(this.rawMsgHeader)}`);
          debug(`[RAW MSG  body size] => ${this.rawMsgBodySize}`);
          this.rawMsgHeaderInProgress = false;
          this.rawMsgBody = Buffer.from([]);
          dataBuf = dataBuf.slice(12 - headerLength);
        }
        const rawMsgBodySizeDiff = this.rawMsgBodySize - this.rawMsgBody.length;
        this.rawMsgBody = Buffer.concat([
          this.rawMsgBody,
          dataBuf.slice(0, rawMsgBodySizeDiff),
        ]);
        dataBuf = dataBuf.slice(rawMsgBodySizeDiff);
        if (this.rawMsgBody.length === this.rawMsgBodySize) {
          this.bus.emit('fft-data-arrived', {
            header: this._parseNotifyBuf(this.rawMsgHeader),
            body: this._parseDataBuf(this.rawMsgBody),
          });
          this.rawMsgHeaderInProgress = true;
          this.rawMsgHeader = null;
          this.rawMsgBody = null;
          this.rawMsgBodySize = 0;
        }
      }
    });
    this.bus.on('fft-data-arrived', (payload) => {
      debug('[fft-data-arrived] command => ' + payload.header.command);
      if ('XFD' === payload.header.command) {
        this.bus.emit('data', payload.body);
      }
    });
  }

  async _openSerialPort() {
    return await new Promise((resolve) => {
      const connect = () => {
        this.port = new SerialPort(this.serialport, {
          baudRate: 230400,
          autoOpen: false,
        });
        this.port.on('close', () => {
          this.bus.emit('disconnected');
          this.closed = true;
        });
        this.port.on('error', (e) => {
          debug('[error] ' + e.stack);
          if (!this.port.isOpen) {
            this.port.close(() => {
              debug('[info] trying to re-connect');
              setTimeout(connect, 5000);
            });
          }
          this.bus.emit('error');
        });
        this.port.on('open', () => {
          this.closed = false;
          this.commandMode = true;
          debug('Serial port (' + this.serialport + ') is now open.');
          let timer = null;
          const ping = () => {
            this.port.write('\r');
            timer = setTimeout(ping, 100);
          };
          timer = setTimeout(ping, 100);
          this.port.write('\r');
          this.bus.once('command-response', (e) => {
            clearTimeout(timer);
            return resolve(e);
          });
        });
        let r = null;
        this.port.on('data', (dataBuf) => {
          this.commandMode
            ? ((r = r || Buffer.from([])),
              (1 < (r = Buffer.concat([r, dataBuf])).length &&
                10 === r[r.length - 2]) ||
              13 === r[r.length - 1]
                ? (this.bus.emit('command-response', r), (r = null))
                : this.bus.emit('command-response-data', dataBuf))
            : this.bus.emit('fft', dataBuf);
        });

        this.port.open((err) => {
          if (err) {
            debug('[info] opening error, trying to re-connect');
            setTimeout(connect, 5000);
          }
        });
      };
      setTimeout(connect, 0);
    });
  }

  async start() {
    const dataBuf = await this._openSerialPort();
    debug(`[initialMessage]\n${hexdump(dataBuf)}`);
    return new Promise((resolve, reject) => {
      let trial = 0;
      const init = () => {
        debug(`[start] initialzing parameters...`);
        this._onInitCompleted()
          .then(resolve)
          .catch((err) => {
            debug(
              `[start] Error while initialzing: trial=${trial}, err=${
                err.message || err
              }`
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
  }

  async shutdown() {
    if (this.closed) {
      return;
    }
    if (this.commandMode) {
      await new Promise((resolve) => {
        this.debug('Schedule the shutdown command...'),
          this.bus.once('data', () => {
            return resolve();
          });
      });
    }
    await this._onShutdownRequested();
    ['fft', 'fft-data-arrived', 'command-response'].forEach((event) => {
      this.bus.listeners(event).forEach((listener) => {
        return this.bus.removeListener(event, listener);
      });
    });
    return new Promise((resolve) => {
      this.port.close(() => {
        return resolve(true);
      });
    });
  }

  _parseNotifyBuf(dataBuf) {
    if (!dataBuf) {
      throw new Error('No input!');
    }
    debug(`[_parseNotifyBuf] buf => ${dataBuf}, len => ${dataBuf.length}`);
    return (
      Array.isArray(dataBuf)
        ? (dataBuf = Buffer.from(dataBuf))
        : Buffer.isBuffer(dataBuf) ||
          (dataBuf = Buffer.from(dataBuf.toString())),
      {
        command: dataBuf.slice(3, 6).toString(),
        size: 256 * dataBuf[9] + dataBuf[10],
      }
    );
  }
  _byte2binary16(byteValue) {
    let t = 32768 & byteValue,
      r = (byteValue >> 10) & 31,
      n = 1023 & byteValue;
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

  _parseDataBuf(/* FFT Data Header (36 bytes) + FFT Data */ dataBuf) {
    if (!dataBuf) {
      throw new Error('No input!');
    }
    if (Array.isArray(dataBuf)) {
      dataBuf = Buffer.from(dataBuf);
    } else if (!Buffer.isBuffer(dataBuf)) {
      dataBuf = Buffer.from(dataBuf.toString());
    }
    // Config
    const { samples, fftDataOffset } = this.edgeDeviceConfig;

    // FFT_Timestamp
    const timestamp =
      dataBuf[0] +
      256 * dataBuf[1] +
      65536 * dataBuf[2] +
      16777216 * dataBuf[3];

    // FFT Peak Freq and Amp
    let { peaks, raw } = this._findPeaks(dataBuf);

    // FFT Body Data
    if (this.emitFftValues) {
      if (!raw) {
        raw = Array(samples);
        const bodyIndexOffset = 36 + fftDataOffset;
        for (let i = 0; i < samples; i++) {
          const bufIndex = bodyIndexOffset + 2 * i;
          raw[i] = this._byte2binary16(
            dataBuf[bufIndex] + 256 * dataBuf[bufIndex + 1]
          );
        }
      }
    } else {
      raw = null;
    }
    return {
      raw,
      timestamp,
      peaks,
    };
  }

  _findPeaksByHeader(dataBuf) {
    const peaks = []; // length = 8
    let frequency = null;
    // FFT Peak Frequencies (2 * 4 = 8 elements)
    debug(
      `[FFT Data Header:Peak Freq.]\n${hexdump(
        dataBuf.slice(FFT_DATA_HEADER_PEAK_FREQ_IDX, 20)
      )}`
    );
    for (let i = FFT_DATA_HEADER_PEAK_FREQ_IDX; i < 20; i += 3) {
      frequency = ((0x0f & dataBuf[i + 1]) << 8) + dataBuf[i];
      debug(
        `${frequency}, 0x0f & dataBuf[i + 1]<< 8=${
          0x0f & (dataBuf[i + 1] << 8)
        }, dataBuf[i]=${dataBuf[i]}`
      );
      peaks.push({
        frequency,
      });
      frequency = (dataBuf[i + 2] << 4) + ((0xf0 & dataBuf[i + 1]) >> 4);
      debug(
        `${frequency}, 0x0f & dataBuf[i + 2] << 4=${
          0x0f & (dataBuf[i + 1] << 8)
        }, (0xf0 & dataBuf[i + 1]) >> 4=${(0xf0 & dataBuf[i + 1]) >> 4}`
      );
      peaks.push({
        frequency,
      });
    }

    debug(
      `[FFT Data Header:Peak Amp.]\n${hexdump(
        dataBuf.slice(FFT_DATA_HEADER_PEAK_VAL_IDX, 36)
      )}`
    );
    for (let i = 0; i < 8; i++) {
      // FFT Peak Amplitude Values (8 elements)
      const idx = FFT_DATA_HEADER_PEAK_VAL_IDX + 2 * i;
      const first = dataBuf[idx];
      const second = dataBuf[idx + 1];
      peaks[i].amplitude =
        ((((1 - 2 * ((0x80 & second) >> 7)) *
          Math.pow(2, (0x7c & second) >> 2)) /
          32768) * // Math.pow(2, 15)
          (1024 + 256 * (0x03 & second) + first)) /
        1024;
    }
    return {
      raw: null,
      peaks,
    };
  }

  _findPeaksByBody(dataBuf) {
    // Config
    const {
      peakFinderByBody,
      fftDataOffset,
      samples,
      ampFullscale,
      ampCorrection,
    } = this.edgeDeviceConfig;
    // Raw FFT Body Data
    const raw = Array(samples);
    const bodyIndexOffset = 36 + fftDataOffset;
    for (let i = 0; i < samples; i++) {
      const bufIndex = bodyIndexOffset + 2 * i;
      raw[i] = this._byte2binary16(
        dataBuf[bufIndex] + 256 * dataBuf[bufIndex + 1]
      );
    }
    const peaks = raw
      .slice(peakFinderByBody.startIndex) // exclude first N values for sorting
      .sort((a, b) => b - a)
      .slice(0, 8)
      .map((rawAmpValue) => {
        return {
          frequency: raw.indexOf(rawAmpValue),
          amplitude: rawAmpValue,
        };
      });
    return {
      raw,
      peaks,
    };
  }

  _convertAmp(rawAmpValue, ampFullscale, ampCorrection) {
    return ampFullscale * Math.log10(rawAmpValue) - ampCorrection;
  }

  format(data, topic, numOfPeaks, payloadFormat) {
    const {
      samples,
      sampleFreq,
      ampFullscale,
      ampCorrection,
    } = this.edgeDeviceConfig;
    const payload = {
      timestamp: data.timestamp,
      topic,
    };
    if (numOfPeaks < 0) {
      numOfPeaks = 0;
    } else if (8 < numOfPeaks) {
      numOfPeaks = 8;
    }
    const peaks = data.peaks.slice(0, numOfPeaks);
    switch (payloadFormat) {
      case 'chart':
      case 'chartWithoutPeak':
        const series = ['FFT'];
        const amplitude = [
          data.raw
            ? data.raw.map((rawAmpValue) => {
                return this._convertAmp(
                  rawAmpValue,
                  ampFullscale,
                  ampCorrection
                );
              })
            : [],
        ];
        if ('chart' === payloadFormat) {
          peaks.forEach((peak, i) => {
            series.push(`Peak${i + 1}`);
            const peakIndicator = Array(samples).fill(0);
            peakIndicator[peak.frequency] =
              this._convertAmp(peak.amplitude, ampFullscale, ampCorrection) +
              GRAPH_INDICATION_DELTA;
            amplitude.push(peakIndicator);
          });
          payload.payload = [
            {
              series,
              data: amplitude,
              labels: this.frequencyLabels,
            },
          ];
        }
        break;
      case 'all':
        const fft = data.raw
          ? Array.prototype.slice.call(data.raw, 0).map((rawAmpValue) => {
              return this._convertAmp(rawAmpValue, ampFullscale, ampCorrection);
            })
          : null;
        payload.payload = {
          peaks: peaks.map((peak) => {
            return {
              frequency: (sampleFreq / FFT_POINTS) * peak.frequency,
              amplitude: this._convertAmp(
                peak.amplitude,
                ampFullscale,
                ampCorrection
              ),
            };
          }),
          fft,
        };
        break;
      case 'peak':
        payload.payload = peaks.map((peak) => {
          return {
            frequency: (sampleFreq / FFT_POINTS) * peak.frequency,
            amplitude: this._convertAmp(
              peak.amplitude,
              ampFullscale,
              ampCorrection
            ),
          };
        });
    }
    return payload;
  }
}
