/* Strosa QR — liten, beroendefri QR-generator (byte-läge, version 1–40).
   Port av Nayuki:s public-domain "QR Code generator" (förenklad, byte-only).
   Exponerar window.StrosaQR med:
     StrosaQR.matrix(text, eccName)  → { size, modules:[[bool]] }
     StrosaQR.svg(text, opts)        → SVG-sträng
   Ren ES5/UMD, inget byggsteg. */
(function (root) {
  'use strict';

  // ---- Reed–Solomon / GF(256) ----
  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function rsDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree; i++) result.push(0);
    result[degree - 1] = 1;
    var root = 1;
    for (var i = 0; i < degree; i++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    data.forEach(function (b) {
      var factor = b ^ result.shift();
      result.push(0);
      divisor.forEach(function (coef, i) { result[i] ^= gfMul(coef, factor); });
    });
    return result;
  }

  // ---- Tabeller (index = version 0..40; 0 är ogiltig) ----
  var ECC_CW_PER_BLOCK = [
    [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
  ];
  var NUM_EC_BLOCKS = [
    [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
  ];
  // ECC-ordning: L,M,Q,H med format-bitar
  var ECC = { L:{i:0,bits:1}, M:{i:1,bits:0}, Q:{i:2,bits:3}, H:{i:3,bits:2} };

  function numDataCodewords(ver, eccI) {
    var totalCw = Math.floor(getNumRawDataModules(ver) / 8);
    var ecPerBlock = ECC_CW_PER_BLOCK[eccI][ver];
    var numBlocks = NUM_EC_BLOCKS[eccI][ver];
    return totalCw - ecPerBlock * numBlocks;
  }
  function getNumRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  // ---- Bygg QR-matris ----
  function makeQr(dataCodewords, ver, eccI) {
    var size = ver * 4 + 17;
    var modules = [], isFunction = [];
    for (var i = 0; i < size; i++) {
      modules.push(new Array(size).fill(false));
      isFunction.push(new Array(size).fill(false));
    }
    function setFn(x, y, val) { modules[y][x] = val; isFunction[y][x] = true; }

    // Finder patterns
    function finder(x, y) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy));
        var xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size)
          setFn(xx, yy, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);

    // Timing
    for (var i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }

    // Alignment
    var alignPos = getAlignPositions(ver);
    for (var ai = 0; ai < alignPos.length; ai++) for (var aj = 0; aj < alignPos.length; aj++) {
      var ax = alignPos[ai], ay = alignPos[aj];
      var skip = (ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6);
      if (skip) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++)
        setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }

    // Reservera format/version (fylls efter mask)
    reserveFormat(size, setFn);
    if (ver >= 7) reserveVersion(size, setFn);
    if (ver >= 7) drawVersion(modules, size, ver);

    // Interleave data + ECC
    var allCw = interleave(dataCodewords, ver, eccI);

    // Lägg ut databitar (zig-zag)
    var bitIdx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x] && bitIdx < allCw.length * 8) {
            modules[y][x] = ((allCw[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
        }
      }
    }

    // Välj bästa mask
    var bestMask = 0, minPenalty = Infinity, bestModules = null;
    for (var m = 0; m < 8; m++) {
      var cloned = modules.map(function (r) { return r.slice(); });
      applyMask(cloned, isFunction, m);
      drawFormat(cloned, size, eccI, m, setFnNoop(cloned, isFunction));
      var p = penalty(cloned, size);
      if (p < minPenalty) { minPenalty = p; bestMask = m; bestModules = cloned; }
    }
    return { size: size, modules: bestModules };
  }

  function setFnNoop(modules) {
    return function (x, y, val) { modules[y][x] = val; };
  }

  function getAlignPositions(ver) {
    if (ver === 1) return [];
    var numAlign = Math.floor(ver / 7) + 2;
    var size = ver * 4 + 17;
    var step = Math.ceil((size - 13) / (2 * numAlign - 2)) * 2;
    var result = [6];
    for (var pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  function reserveFormat(size, setFn) {
    for (var i = 0; i <= 8; i++) { if (i !== 6) { setFn(8, i, false); setFn(i, 8, false); } }
    setFn(8, 8, false);
    for (var i = 0; i < 8; i++) setFn(size - 1 - i, 8, false);
    for (var i = 0; i < 7; i++) setFn(8, size - 1 - i, false);
    setFn(8, size - 8, true); // mörk modul
  }
  function reserveVersion(size, setFn) {
    for (var i = 0; i < 18; i++) {
      var a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFn(a, b, false); setFn(b, a, false);
    }
  }
  function drawVersion(modules, size, ver) {
    if (ver < 7) return;
    var rem = ver;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (ver << 12) | rem; // 18 bitar
    for (var i = 0; i < 18; i++) {
      var bit = getBit(bits, i);
      var a = size - 11 + (i % 3), b = Math.floor(i / 3);
      modules[b][a] = bit; modules[a][b] = bit;
    }
  }

  function drawFormat(modules, size, eccI, mask, set) {
    var eccBits = [1, 0, 3, 2][eccI];
    var data = (eccBits << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    for (var i = 0; i <= 5; i++) set(8, i, getBit(bits, i));
    set(8, 7, getBit(bits, 6)); set(8, 8, getBit(bits, 7)); set(7, 8, getBit(bits, 8));
    for (var i = 9; i < 15; i++) set(14 - i, 8, getBit(bits, i));
    for (var i = 0; i < 8; i++) set(size - 1 - i, 8, getBit(bits, i));
    for (var i = 8; i < 15; i++) set(8, size - 15 + i, getBit(bits, i));
    set(8, size - 8, true);
  }
  function getBit(x, i) { return ((x >>> i) & 1) !== 0; }

  function interleave(data, ver, eccI) {
    var numBlocks = NUM_EC_BLOCKS[eccI][ver];
    var blockEccLen = ECC_CW_PER_BLOCK[eccI][ver];
    var rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    var numShortBlocks = numBlocks - rawCodewords % numBlocks;
    var shortBlockLen = Math.floor(rawCodewords / numBlocks);

    var blocks = [], rsDiv = rsDivisor(blockEccLen);
    var k = 0;
    for (var i = 0; i < numBlocks; i++) {
      var datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
      var dat = data.slice(k, k + datLen); k += datLen;
      var ecc = rsRemainder(dat, rsDiv);
      if (i < numShortBlocks) dat.push(0); // platshållare
      blocks.push({ dat: dat, ecc: ecc });
    }

    var result = [];
    for (var i = 0; i < blocks[0].dat.length; i++) {
      for (var j = 0; j < blocks.length; j++) {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
          result.push(blocks[j].dat[i]);
      }
    }
    for (var i = 0; i < blockEccLen; i++)
      for (var j = 0; j < blocks.length; j++) result.push(blocks[j].ecc[i]);
    return result;
  }

  function applyMask(modules, isFunction, mask) {
    var size = modules.length;
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      if (isFunction[y][x]) continue;
      var invert;
      switch (mask) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
        case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
        case 7: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
      }
      if (invert) modules[y][x] = !modules[y][x];
    }
  }

  function penalty(modules, size) {
    var p = 0, dark = 0;
    // Regler 1 & 3 (rad + kolumn)
    for (var y = 0; y < size; y++) {
      var runColor = false, runX = 0;
      for (var x = 0; x < size; x++) {
        if (modules[y][x] === runColor) { runX++; if (runX === 5) p += 3; else if (runX > 5) p++; }
        else { runColor = modules[y][x]; runX = 1; }
        if (modules[y][x]) dark++;
      }
    }
    for (var x = 0; x < size; x++) {
      var runColor = false, runY = 0;
      for (var y = 0; y < size; y++) {
        if (modules[y][x] === runColor) { runY++; if (runY === 5) p += 3; else if (runY > 5) p++; }
        else { runColor = modules[y][x]; runY = 1; }
      }
    }
    // Regel 2 (2x2-block)
    for (var y = 0; y < size - 1; y++) for (var x = 0; x < size - 1; x++) {
      var c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) p += 3;
    }
    // Regel 4 (mörk-andel)
    var total = size * size;
    var k = Math.floor((Math.abs(dark * 20 - total * 10) + total - 1) / total) - 1;
    p += Math.max(k, 0) * 10;
    return p;
  }

  // ---- Encoder (byte-läge) ----
  function encode(text, eccName) {
    var ecc = ECC[eccName] || ECC.M;
    var bytes = utf8Bytes(text);

    // Hitta minsta version som rymmer datan
    var ver;
    for (ver = 1; ver <= 40; ver++) {
      var cap = numDataCodewords(ver, ecc.i) * 8;
      var ccBits = ver <= 9 ? 8 : 16; // byte-läge teckenräknare
      var used = 4 + ccBits + bytes.length * 8;
      if (used <= cap) break;
    }
    if (ver > 40) throw new Error('Data för stor för QR');

    // Bygg bitström
    var bits = [];
    function append(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    append(0x4, 4); // byte-läge
    append(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(function (b) { append(b, 8); });

    var capacity = numDataCodewords(ver, ecc.i) * 8;
    append(0, Math.min(4, capacity - bits.length)); // terminator
    while (bits.length % 8 !== 0) bits.push(0);
    // Pad-bytes
    for (var pad = 0xEC; bits.length < capacity; pad ^= 0xEC ^ 0x11) append(pad, 8);

    var dataCw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      dataCw.push(b);
    }
    return makeQr(dataCw, ver, ecc.i);
  }

  function utf8Bytes(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
      else if (c < 0xD800 || c >= 0xE000) { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
      else {
        i++; c = 0x10000 + (((c & 0x3FF) << 10) | (str.charCodeAt(i) & 0x3FF));
        out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
      }
    }
    return out;
  }

  // ---- Publikt API ----
  function matrix(text, eccName) { return encode(text, eccName || 'M'); }

  function svg(text, opts) {
    opts = opts || {};
    var border = opts.border != null ? opts.border : 4;
    var scale = opts.scale || 4;
    var dark = opts.dark || '#2F2A20';
    var light = opts.light || '#FFFDF7';
    var qr = encode(text, opts.ecc || 'M');
    var dim = (qr.size + border * 2) * scale;
    var parts = [];
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) {
      if (qr.modules[y][x])
        parts.push('M' + ((x + border) * scale) + ',' + ((y + border) * scale) + 'h' + scale + 'v' + scale + 'h-' + scale + 'z');
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" ' +
      'width="' + dim + '" height="' + dim + '" shape-rendering="crispEdges" role="img" aria-label="QR-kod">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>' +
      '<path d="' + parts.join('') + '" fill="' + dark + '"/></svg>';
  }

  var api = { matrix: matrix, svg: svg };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StrosaQR = api;
})(typeof self !== 'undefined' ? self : this);
