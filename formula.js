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
const { GifUtil } = require('gifwrap');
const { google } = require('googleapis');
const { LocalAuth } = require('./auth');
const { buildResizeRequests, numberToColor, getColorForPixel } = require('./utils');

const auth = new LocalAuth();
const sheets = google.sheets({
  version: 'v4',
  auth: auth.oAuth2Client,
});

let frameRef = '$A$1';

async function processImage(fileName) {
    let res = await sheets.spreadsheets.create({});
    let spreadsheetId = res.data.spreadsheetId;

    opn(res.data.spreadsheetUrl);

    let gif = await GifUtil.read(fileName);
    GifUtil.quantizeDekker(gif.frames, 16);

    let requests = buildResizeRequests(gif.height, gif.width, 1, 1);

    requests.push({
        updateCells: {
            range: {
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 2
            },
            fields: '*',
            rows: [
                {
                    values: [
                        {
                            userEnteredValue: {
                                numberValue: 1
                            }
                        },
                        {
                            userEnteredValue: {
                                numberValue: gif.frames.length
                            }
                        }
                    ]
                }
            ]
        }
    });

    let rows = [];    
    for(let y = 0; y < gif.height; ++y) {
        let row = []
        for(let x = 0; x < gif.width; ++x) {
            row.push({
                userEnteredValue: {
                    formulaValue: cellValue(x, y, gif)
                }
            });
        }
        rows.push({
            values: row
        });
    }
    // Image data
    requests.push({
        updateCells: {
            range: {
                startRowIndex: 1,
                startColumnIndex: 1,
            },
            fields: '*',
            rows: rows
        }  
    });
    
    let imageRange = {
        startRowIndex: 2,
        endRowIndex: 2 + gif.height,
        startColumnIndex: 2,
        endColumnIndex: 2 + gif.width
    };
    let colors = Array.from(getPalette(gif).values());
    let formatRequests = colors.map((c, i) => conditionalFormatRuleForColor(c, i, imageRange));
    requests = requests.concat(formatRequests);

    res = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
            requests: requests,
            includeSpreadsheetInResponse: false
        }
    });
    return spreadsheetId
}

function conditionalFormatRuleForColor(color, index, range) {
    let parsedColor = numberToColor(color);
    return {
        addConditionalFormatRule: {
            rule: {
                ranges: [
                    range
                ],
                booleanRule: {
                    condition: {
                        type: 'NUMBER_EQ',
                        values: [
                            {
                                userEnteredValue: `${color}`
                            }
                        ]
                    },
                    format: {
                        backgroundColor: parsedColor,
                        textFormat: {
                            foregroundColor: parsedColor
                        }
                    }
                },
            },
            index: index
        }
    }
}

function getPalette(gif) {
    let palette = [];
    gif.frames.forEach((f,i) => {
        palette = palette.concat(f.getPalette().colors);
    })
    return new Set(palette);
}

function cellValue(x, y, gif) {
    let values = gif.frames.map((frame, i) => getColorForPixel(gif, x, y, i));
    return `=CHOOSE(${frameRef}, ${values.join(', ')})`;
}

if (module === require.main) {
    const scopes = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/spreadsheets',
    ];
    const [filename] = process.argv.slice(2);
    auth.getCredentialsOrAuthorize('default', scopes)
    .then(() => processImage(filename))
    .then(id => console.log('Spreadsheet ID: ', id))
    .catch(console.error);  
}
