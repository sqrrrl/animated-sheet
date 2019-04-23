// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const opn = require('opn');
const {GifUtil} = require('gifwrap');
const {google} = require('googleapis');
const {LocalAuth} = require('./auth');
const {buildResizeRequests, numberToColor, getColorForPixel} = require('./utils');

const auth = new LocalAuth();
const sheets = google.sheets({
  version: 'v4',
  auth: auth.oAuth2Client,
});

async function processImage(fileName, spreadsheetId) {
  if (!spreadsheetId) {
    const res = await sheets.spreadsheets.create({
    });
    spreadsheetId = res.data.spreadsheetId;
    opn(res.data.spreadsheetUrl);
  }

  const gif = await GifUtil.read(fileName);

  const requests = buildResizeRequests(gif.height, gif.width, 0, 0);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId,
    requestBody: {
      requests: requests,
      includeSpreadsheetInResponse: false,
    },
  });

  let frame = 0;
  for (let i = 0; i < 100; ++i) {
    const frameRequests = buildFrameRequests(gif, frame);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: frameRequests,
        includeSpreadsheetInResponse: false,
      },
    });

    frame = (frame + 1) % gif.frames.length;
  }
  return spreadsheetId;
}

function buildFrameRequests(gif, frame) {
  const frameRequests = [];
  const rows = [];
  for (let y = 0; y < gif.height; ++y) {
    const row = [];
    for (let x = 0; x < gif.width; ++x) {
      const color = getColorForPixel(gif, x, y, frame);
      row.push({
        userEnteredFormat: {
          backgroundColor: numberToColor(color),
        },
      });
    }
    rows.push({
      values: row,
    });
  }
  // Image data
  frameRequests.push({
    updateCells: {
      range: {
        startRowIndex: 0,
        startColumnIndex: 0,
      },
      fields: '*',
      rows: rows,
    },
  });
  return frameRequests;
}


if (module === require.main) {
  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
  ];
  const [filename, spreadsheetId] = process.argv.slice(2);
  auth.getCredentialsOrAuthorize('default', scopes)
      .then(() => processImage(filename, spreadsheetId))
      .then((id) => console.log('Spreadsheet ID: ', id))
      .catch(console.error);
}
