
const asar = require('asar');
const fs = require('fs');
const path = require('path');
const src = process.argv[2];
const dst = process.argv[3];
asar.extractPackage(src, dst)
  .then(() => console.log('extracted:', dst))
  .catch(e => console.error('error:', e.message));
