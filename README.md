# Animated Sheet

Experiments with animating Google Sheets

# To run

The sample code requires a Google Cloud project and OAuth 2 credentials to run. You can follow the instructions at the
[Sheets API Quickstart](https://developers.google.com/sheets/api/quickstart/nodejs) to get the credentials. Save them in a file named `client_secret.json` in the same directory as the source.

You'll also need a small animated GIF (e.g. 64x64) to run this.

```
git clone https://github.com/sqrrrl/animated-sheet.git
npm install
node run frames.js <filename>
```