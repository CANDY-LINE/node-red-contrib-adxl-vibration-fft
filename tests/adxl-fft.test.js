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

import 'source-map-support/register';
import * as sinon from 'sinon';
import { assert } from 'chai';
import EventEmitter from 'events';
import adxl100xfftModule from '../dist/adxl-fft';

const RED = {};

describe('ADXL100xFFT node', () => {
  RED.debug = true;
  let sandbox;
  let types;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    types = {};
    RED._ = sinon.spy();
    RED.events = sandbox.stub(new EventEmitter());
    RED.nodes = {
      createNode: () => {},
      getNode: () => {},
      registerType: (n, t) => {
        types[n] = t;
        t.prototype.on = () => {};
        t.prototype.emit = () => {};
        t.prototype.error = () => {};
      }
    };
    RED.log = sandbox.stub({
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    });
    RED.httpAdmin = sandbox.stub({
      get: () => {}
    });
    RED.auth = sandbox.stub({
      needsPermission: () => {}
    });
  });
  afterEach(() => {
    sandbox = sandbox.restore();
  });
  it('should be successfully imported', () => {
    assert.isNotNull(RED);
    adxl100xfftModule(RED);
    assert.isNotNull(new types['ADXL100x FFT']({}));
    assert.isNotNull(new types['ADXL100x FFT in']({}));
  });
});
