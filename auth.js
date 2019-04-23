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

const {google} = require('googleapis');
const http = require('http');
const url = require('url');
const opn = require('opn');
const destroyer = require('server-destroy');
const fs = require('fs');
const path = require('path');
const level = require('level');

class Auth {
  constructor(options) {
    this._options = options || {
      keyPath: path.join(__dirname, 'client_secret.json'),
      dbPath: path.join(__dirname, 'credentials.db'),
      scopes: []};

    if (fs.existsSync(this._options.keyPath)) {
      const keyFile = require(this._options.keyPath);
      this.keys = keyFile.installed || keyFile.web;
    }

    this.db = level(this._options.dbPath);
  
    this.redirectUri = this.keys.redirect_uris.find(uri => {
        const parts = new url.URL(uri);
        return parts.hostname === 'localhost';
    });

    this.oAuth2Client = new google.auth.OAuth2(
      this.keys.client_id,
      this.keys.client_secret,
      this.redirectUri
    );
  }

  async loadUserCredentials(userKey) {
    let key = `${this.oAuth2Client._clientId}/${userKey}`;
    try {
      return await this.db.get(key);
    } catch (e) {
      return undefined;
    }
  }

  async saveUserCredentials(userKey, credentials) {
    let key = `${this.oAuth2Client._clientId}/${userKey}`;
    return this.db.put(key, JSON.stringify(credentials));
  }

  async getCredentialsOrAuthorize(userKey, scopes) {
    let credentials = await this.loadUserCredentials(userKey);
    if (credentials) {
      this.oAuth2Client.credentials = JSON.parse(credentials);
      return this.oAuth2Client;
    }
    return this._authWithLocalServer(userKey, scopes);
  }

  async _authWithLocalServer(userKey, scopes) {
    let redirectUri = (port) => {
      let u = new url.URL(this.redirectUri);
      u.port = port;
      return u.toString();
    }
    return new Promise((resolve, reject) => {
      // grab the url that will be used for authorization
      const server = http.createServer(async (req, res) => {
        const reqUrl = url.parse(req.url, true);
        const qs = reqUrl.query;

        if (!qs || !qs.code) {
          res.statusCode = 404;
          res.end();
          return;
        }

        try {
          res.end(
            'Authentication successful! Please return to the console.'
          );
          const { tokens } = await this.oAuth2Client.getToken({
              code: qs.code,
              redirect_uri: redirectUri(server.address().port)
          });
          this.oAuth2Client.credentials = tokens;
          await this.saveUserCredentials(userKey, tokens);
          server.destroy();
          resolve(this.oAuth2Client);
        } catch (e) {
          reject(e);
        }
      }).listen(0, () => {
        // open the browser to the authorize url to start the workflow
        this.authorizeUrl = this.oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes.join(' '),
          redirect_uri: redirectUri(server.address().port)
        });
        opn(this.authorizeUrl, {wait: false}).then(cp => cp.unref());
      });
      destroyer(server);
    });
  }
}

exports.LocalAuth = Auth;