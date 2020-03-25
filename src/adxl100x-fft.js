/**
 * @license
 * Copyright (c) 2018 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
import 'source-map-support/register';
import SerialPort from 'serialport';
import { ADXL100xFFTClient } from './adxl100x-fft-client';

export default function(RED) {
  const o = {};
  const exitHandler = () => {
    Object.keys(o).forEach(e => {
      o[e].shutdown();
    });
  };
  process.on('exit', exitHandler);
  if (RED.settings && RED.settings.exitHandlers) {
    RED.settings.exitHandlers.push(exitHandler);
  }
  class ADXL100xFFTNode {
    constructor(t) {
      RED.nodes.createNode(this, t);
      this.serialport = t.serialport;
      if (o[this.serialport]) {
        throw new Error('Duplicate serialport configuration for ADXL100xFFTNode!');
      }
      this.identifier = t.identifier;
      this.enabled = !!t.enabled;
      this.emitFftValues = !!t.emitFftValues;
      this.nodes = {};
      ['connected', 'disconnected', 'error'].forEach(i => {
        this.on(i, () => {
          for (var e = arguments.length, t = Array(e), n = 0; n < e; n++)
            t[n] = arguments[n];
          try {
            Object.keys(this.nodes).forEach(e => {
              this.nodes[e].emit(i, t);
            });
          } catch (e) {
            this.error(e);
          }
        });
      });
      this.on('data', i => {
        try {
          Object.keys(this.nodes).forEach(e => {
            if (this.nodes[e].input) {
              const t = parseInt(this.nodes[e].numOfPeaks || 0);
              const n = this.nodes[e].payloadFormat;
              this.nodes[e].send(this.client.format(i, this.identifier, t, n));
            }
          });
        } catch (e) {
          this.error(e);
        }
      });
      this.on('close', t => {
        return (
          delete o[this.serialport],
          this.client
            .shutdown()
            .then(() => {
              t();
            })
            .catch(e => {
              this.log(e), t();
            })
        );
      });
      this.operations = {
        register: e => {
          return (
            !!e &&
            !this.nodes[e.id] &&
            ((this.nodes[e.id] = e),
            this.client.closed ? e.emit('disconnected') : e.emit('connected'),
            !0)
          );
        },
        remove: e => {
          return !(!e || !this.nodes[e.id] || (delete this.nodes[e.id], 0));
        },
        shutdown: () => {
          return this.client.shutdown();
        }
      };
      this.client = new ADXL100xFFTClient(this);
      if (this.enabled) {
        o[this.serialport] = this.client;
        this.client.start().catch(e => {
          this.error(e);
          this.emit('error');
        });
      } else {
        process.nextTick(() => {
          this.emit('disconnected');
        });
      }
    }
  }
  RED.nodes.registerType('ADXL100x FFT', ADXL100xFFTNode);

  class ADXL100xFFTInNode {
    consttructor(t) {
      RED.nodes.createNode(this, t);
      this.name = t.name;
      this.input = !0;
      this.payloadFormat = t.payloadFormat;
      this.numOfPeaks = t.numOfPeaks;
      this.adxl100xFFTNodeId = t.adxl100xFFT;
      this.adxl100xFFTNode = RED.nodes.getNode(this.adxl100xFFTNodeId);
      if (this.adxl100xFFTNode) {
        this.on('connected', () => {
          const e =
            0 < arguments.length && void 0 !== arguments[0] ? arguments[0] : 0;
          this.status({
            fill: 'green',
            shape: 'dot',
            text: RED._('adxl100x-fft.status.connected', {
              n: e
            })
          });
        });
        ['disconnected', 'error'].forEach(e => {
          this.on(e, () => {
            this.status({
              fill: 'red',
              shape: 'ring',
              text: 'adxl100x-fft.status.' + e
            });
          });
        });
        this.on('close', () => {
          this.adxl100xFFTNode && this.adxl100xFFTNode.operations.remove(this);
        });
        this.adxl100xFFTNode.operations.register(this);
      }
    }
  }
  RED.nodes.registerType('ADXL100x FFT in', ADXL100xFFTInNode);

  RED.httpAdmin.get(
    '/adxl100x-fft-ports',
    RED.auth.needsPermission('serial.read'),
    (req, res) => {
      SerialPort.list()
        .then(t => {
          res.json(t);
        })
        .catch(e => {
          this.error(e);
          res.sendStatus(500);
        });
    }
  );
}
