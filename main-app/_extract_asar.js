const asar = require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/asar/lib/asar.js');
const path = require('path');
const srcDir = path.join('d:\\融媒体发布助手\\帝意传媒-mini\\release2\\win-unpacked\\resources', 'app');
const destFile = path.join('d:\\融媒体发布助手\\帝意传媒-mini\\release2\\win-unpacked\\resources', 'app.asar');
asar.extractAll(destFile, srcDir);
console.log('Extracted to:', srcDir);
