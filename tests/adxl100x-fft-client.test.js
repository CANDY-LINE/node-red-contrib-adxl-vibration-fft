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

/*jshint camelcase: false */

'use strict';

import 'source-map-support/register';
import { assert } from 'chai';
import { ADXL100xFFTClient } from '../dist/adxl100x-fft-client';

describe('ADXL100xFFTClient', () => {
  let testData;
  let client;
  before(() => {
    testData = require('./fft-data-001.json');
    client = new ADXL100xFFTClient();
  });
  it('should parse notifyBuf for XFD command', () => {
    const cmd = client._parseNotifyBuf(Buffer.from(testData[0].notify_buf, 'hex'));
    assert.equal('XFD', cmd.command);
    assert.equal(4096, cmd.size);
  });
  it('should parse dataBuf (1)', () => {
    const data = client._parseDataBuf(Buffer.from(testData[0].data_buf, 'hex'));
    assert.equal(testData[0]['Peak Freq 1'], data.peaks[0].frequency);
    assert.equal(testData[0]['Peak Value 1'], data.peaks[0].amplitude);
    assert.equal(testData[0]['Peak Freq 8'], data.peaks[7].frequency);
    assert.equal(testData[0]['Peak Value 8'], data.peaks[7].amplitude);
  });
  it('should parse dataBuf (2)', () => {
    const data = client._parseDataBuf(Buffer.from(testData[1].data_buf, 'hex'));
    assert.equal(testData[1]['Peak Freq 1'], data.peaks[0].frequency);
    assert.equal(testData[1]['Peak Value 1'], data.peaks[0].amplitude);
    assert.equal(testData[1]['Peak Freq 8'], data.peaks[7].frequency);
    assert.equal(testData[1]['Peak Value 8'], data.peaks[7].amplitude);
  });  
});
