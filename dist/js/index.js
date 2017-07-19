"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var app = function () {
  'use strict';

  var global$1 = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};

  var lookup = [];
  var revLookup = [];
  var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
  var inited = false;
  function init() {
    inited = true;
    var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (var i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }

    revLookup['-'.charCodeAt(0)] = 62;
    revLookup['_'.charCodeAt(0)] = 63;
  }

  function toByteArray(b64) {
    if (!inited) {
      init();
    }
    var i, j, l, tmp, placeHolders, arr;
    var len = b64.length;

    if (len % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4');
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr(len * 3 / 4 - placeHolders);

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? len - 4 : len;

    var L = 0;

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
      arr[L++] = tmp >> 16 & 0xFF;
      arr[L++] = tmp >> 8 & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    if (placeHolders === 2) {
      tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
      arr[L++] = tmp & 0xFF;
    } else if (placeHolders === 1) {
      tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
      arr[L++] = tmp >> 8 & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    return arr;
  }

  function tripletToBase64(num) {
    return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
  }

  function encodeChunk(uint8, start, end) {
    var tmp;
    var output = [];
    for (var i = start; i < end; i += 3) {
      tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + uint8[i + 2];
      output.push(tripletToBase64(tmp));
    }
    return output.join('');
  }

  function fromByteArray(uint8) {
    if (!inited) {
      init();
    }
    var tmp;
    var len = uint8.length;
    var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
    var output = '';
    var parts = [];
    var maxChunkLength = 16383; // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    if (extraBytes === 1) {
      tmp = uint8[len - 1];
      output += lookup[tmp >> 2];
      output += lookup[tmp << 4 & 0x3F];
      output += '==';
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + uint8[len - 1];
      output += lookup[tmp >> 10];
      output += lookup[tmp >> 4 & 0x3F];
      output += lookup[tmp << 2 & 0x3F];
      output += '=';
    }

    parts.push(output);

    return parts.join('');
  }

  function read(buffer, offset, isLE, mLen, nBytes) {
    var e, m;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var nBits = -7;
    var i = isLE ? nBytes - 1 : 0;
    var d = isLE ? -1 : 1;
    var s = buffer[offset + i];

    i += d;

    e = s & (1 << -nBits) - 1;
    s >>= -nBits;
    nBits += eLen;
    for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    m = e & (1 << -nBits) - 1;
    e >>= -nBits;
    nBits += mLen;
    for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    if (e === 0) {
      e = 1 - eBias;
    } else if (e === eMax) {
      return m ? NaN : (s ? -1 : 1) * Infinity;
    } else {
      m = m + Math.pow(2, mLen);
      e = e - eBias;
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
  }

  function write(buffer, value, offset, isLE, mLen, nBytes) {
    var e, m, c;
    var eLen = nBytes * 8 - mLen - 1;
    var eMax = (1 << eLen) - 1;
    var eBias = eMax >> 1;
    var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
    var i = isLE ? 0 : nBytes - 1;
    var d = isLE ? 1 : -1;
    var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;

    value = Math.abs(value);

    if (isNaN(value) || value === Infinity) {
      m = isNaN(value) ? 1 : 0;
      e = eMax;
    } else {
      e = Math.floor(Math.log(value) / Math.LN2);
      if (value * (c = Math.pow(2, -e)) < 1) {
        e--;
        c *= 2;
      }
      if (e + eBias >= 1) {
        value += rt / c;
      } else {
        value += rt * Math.pow(2, 1 - eBias);
      }
      if (value * c >= 2) {
        e++;
        c /= 2;
      }

      if (e + eBias >= eMax) {
        m = 0;
        e = eMax;
      } else if (e + eBias >= 1) {
        m = (value * c - 1) * Math.pow(2, mLen);
        e = e + eBias;
      } else {
        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
        e = 0;
      }
    }

    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

    e = e << mLen | m;
    eLen += mLen;
    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

    buffer[offset + i - d] |= s * 128;
  }

  var toString = {}.toString;

  var isArray = Array.isArray || function (arr) {
    return toString.call(arr) == '[object Array]';
  };

  /*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
   * @license  MIT
   */
  /* eslint-disable no-proto */

  var INSPECT_MAX_BYTES = 50;

  /**
   * If `Buffer.TYPED_ARRAY_SUPPORT`:
   *   === true    Use Uint8Array implementation (fastest)
   *   === false   Use Object implementation (most compatible, even IE6)
   *
   * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
   * Opera 11.6+, iOS 4.2+.
   *
   * Due to various browser bugs, sometimes the Object implementation will be used even
   * when the browser supports typed arrays.
   *
   * Note:
   *
   *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
   *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
   *
   *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
   *
   *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
   *     incorrect length in some situations.
  
   * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
   * get the Object implementation, which is slower but behaves correctly.
   */
  Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined ? global$1.TYPED_ARRAY_SUPPORT : true;

  function kMaxLength() {
    return Buffer.TYPED_ARRAY_SUPPORT ? 0x7fffffff : 0x3fffffff;
  }

  function createBuffer(that, length) {
    if (kMaxLength() < length) {
      throw new RangeError('Invalid typed array length');
    }
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = new Uint8Array(length);
      that.__proto__ = Buffer.prototype;
    } else {
      // Fallback: Return an object instance of the Buffer class
      if (that === null) {
        that = new Buffer(length);
      }
      that.length = length;
    }

    return that;
  }

  /**
   * The Buffer constructor returns instances of `Uint8Array` that have their
   * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
   * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
   * and the `Uint8Array` methods. Square bracket notation works as expected -- it
   * returns a single octet.
   *
   * The `Uint8Array` prototype remains unmodified.
   */

  function Buffer(arg, encodingOrOffset, length) {
    if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
      return new Buffer(arg, encodingOrOffset, length);
    }

    // Common case.
    if (typeof arg === 'number') {
      if (typeof encodingOrOffset === 'string') {
        throw new Error('If encoding is specified then the first argument must be a string');
      }
      return allocUnsafe(this, arg);
    }
    return from(this, arg, encodingOrOffset, length);
  }

  Buffer.poolSize = 8192; // not used by this implementation

  // TODO: Legacy, not needed anymore. Remove in next major version.
  Buffer._augment = function (arr) {
    arr.__proto__ = Buffer.prototype;
    return arr;
  };

  function from(that, value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('"value" argument must not be a number');
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return fromArrayBuffer(that, value, encodingOrOffset, length);
    }

    if (typeof value === 'string') {
      return fromString(that, value, encodingOrOffset);
    }

    return fromObject(that, value);
  }

  /**
   * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
   * if value is a number.
   * Buffer.from(str[, encoding])
   * Buffer.from(array)
   * Buffer.from(buffer)
   * Buffer.from(arrayBuffer[, byteOffset[, length]])
   **/
  Buffer.from = function (value, encodingOrOffset, length) {
    return from(null, value, encodingOrOffset, length);
  };

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    Buffer.prototype.__proto__ = Uint8Array.prototype;
    Buffer.__proto__ = Uint8Array;
    if (typeof Symbol !== 'undefined' && Symbol.species && Buffer[Symbol.species] === Buffer) {
      // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
      // Object.defineProperty(Buffer, Symbol.species, {
      //   value: null,
      //   configurable: true
      // })
    }
  }

  function assertSize(size) {
    if (typeof size !== 'number') {
      throw new TypeError('"size" argument must be a number');
    } else if (size < 0) {
      throw new RangeError('"size" argument must not be negative');
    }
  }

  function alloc(that, size, fill, encoding) {
    assertSize(size);
    if (size <= 0) {
      return createBuffer(that, size);
    }
    if (fill !== undefined) {
      // Only pay attention to encoding if it's a string. This
      // prevents accidentally sending in a number that would
      // be interpretted as a start offset.
      return typeof encoding === 'string' ? createBuffer(that, size).fill(fill, encoding) : createBuffer(that, size).fill(fill);
    }
    return createBuffer(that, size);
  }

  /**
   * Creates a new filled Buffer instance.
   * alloc(size[, fill[, encoding]])
   **/
  Buffer.alloc = function (size, fill, encoding) {
    return alloc(null, size, fill, encoding);
  };

  function allocUnsafe(that, size) {
    assertSize(size);
    that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
    if (!Buffer.TYPED_ARRAY_SUPPORT) {
      for (var i = 0; i < size; ++i) {
        that[i] = 0;
      }
    }
    return that;
  }

  /**
   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
   * */
  Buffer.allocUnsafe = function (size) {
    return allocUnsafe(null, size);
  };
  /**
   * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
   */
  Buffer.allocUnsafeSlow = function (size) {
    return allocUnsafe(null, size);
  };

  function fromString(that, string, encoding) {
    if (typeof encoding !== 'string' || encoding === '') {
      encoding = 'utf8';
    }

    if (!Buffer.isEncoding(encoding)) {
      throw new TypeError('"encoding" must be a valid string encoding');
    }

    var length = byteLength(string, encoding) | 0;
    that = createBuffer(that, length);

    var actual = that.write(string, encoding);

    if (actual !== length) {
      // Writing a hex string, for example, that contains invalid characters will
      // cause everything after the first invalid character to be ignored. (e.g.
      // 'abxxcd' will be treated as 'ab')
      that = that.slice(0, actual);
    }

    return that;
  }

  function fromArrayLike(that, array) {
    var length = array.length < 0 ? 0 : checked(array.length) | 0;
    that = createBuffer(that, length);
    for (var i = 0; i < length; i += 1) {
      that[i] = array[i] & 255;
    }
    return that;
  }

  function fromArrayBuffer(that, array, byteOffset, length) {
    array.byteLength; // this throws if `array` is not a valid ArrayBuffer

    if (byteOffset < 0 || array.byteLength < byteOffset) {
      throw new RangeError('\'offset\' is out of bounds');
    }

    if (array.byteLength < byteOffset + (length || 0)) {
      throw new RangeError('\'length\' is out of bounds');
    }

    if (byteOffset === undefined && length === undefined) {
      array = new Uint8Array(array);
    } else if (length === undefined) {
      array = new Uint8Array(array, byteOffset);
    } else {
      array = new Uint8Array(array, byteOffset, length);
    }

    if (Buffer.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = array;
      that.__proto__ = Buffer.prototype;
    } else {
      // Fallback: Return an object instance of the Buffer class
      that = fromArrayLike(that, array);
    }
    return that;
  }

  function fromObject(that, obj) {
    if (internalIsBuffer(obj)) {
      var len = checked(obj.length) | 0;
      that = createBuffer(that, len);

      if (that.length === 0) {
        return that;
      }

      obj.copy(that, 0, 0, len);
      return that;
    }

    if (obj) {
      if (typeof ArrayBuffer !== 'undefined' && obj.buffer instanceof ArrayBuffer || 'length' in obj) {
        if (typeof obj.length !== 'number' || isnan(obj.length)) {
          return createBuffer(that, 0);
        }
        return fromArrayLike(that, obj);
      }

      if (obj.type === 'Buffer' && isArray(obj.data)) {
        return fromArrayLike(that, obj.data);
      }
    }

    throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.');
  }

  function checked(length) {
    // Note: cannot use `length < kMaxLength()` here because that fails when
    // length is NaN (which is otherwise coerced to zero.)
    if (length >= kMaxLength()) {
      throw new RangeError('Attempt to allocate Buffer larger than maximum ' + 'size: 0x' + kMaxLength().toString(16) + ' bytes');
    }
    return length | 0;
  }

  Buffer.isBuffer = isBuffer;
  function internalIsBuffer(b) {
    return !!(b != null && b._isBuffer);
  }

  Buffer.compare = function compare(a, b) {
    if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
      throw new TypeError('Arguments must be Buffers');
    }

    if (a === b) return 0;

    var x = a.length;
    var y = b.length;

    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a[i] !== b[i]) {
        x = a[i];
        y = b[i];
        break;
      }
    }

    if (x < y) return -1;
    if (y < x) return 1;
    return 0;
  };

  Buffer.isEncoding = function isEncoding(encoding) {
    switch (String(encoding).toLowerCase()) {
      case 'hex':
      case 'utf8':
      case 'utf-8':
      case 'ascii':
      case 'latin1':
      case 'binary':
      case 'base64':
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return true;
      default:
        return false;
    }
  };

  Buffer.concat = function concat(list, length) {
    if (!isArray(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers');
    }

    if (list.length === 0) {
      return Buffer.alloc(0);
    }

    var i;
    if (length === undefined) {
      length = 0;
      for (i = 0; i < list.length; ++i) {
        length += list[i].length;
      }
    }

    var buffer = Buffer.allocUnsafe(length);
    var pos = 0;
    for (i = 0; i < list.length; ++i) {
      var buf = list[i];
      if (!internalIsBuffer(buf)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      }
      buf.copy(buffer, pos);
      pos += buf.length;
    }
    return buffer;
  };

  function byteLength(string, encoding) {
    if (internalIsBuffer(string)) {
      return string.length;
    }
    if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' && (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
      return string.byteLength;
    }
    if (typeof string !== 'string') {
      string = '' + string;
    }

    var len = string.length;
    if (len === 0) return 0;

    // Use a for loop to avoid recursion
    var loweredCase = false;
    for (;;) {
      switch (encoding) {
        case 'ascii':
        case 'latin1':
        case 'binary':
          return len;
        case 'utf8':
        case 'utf-8':
        case undefined:
          return utf8ToBytes(string).length;
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return len * 2;
        case 'hex':
          return len >>> 1;
        case 'base64':
          return base64ToBytes(string).length;
        default:
          if (loweredCase) return utf8ToBytes(string).length; // assume utf8
          encoding = ('' + encoding).toLowerCase();
          loweredCase = true;
      }
    }
  }
  Buffer.byteLength = byteLength;

  function slowToString(encoding, start, end) {
    var loweredCase = false;

    // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
    // property of a typed array.

    // This behaves neither like String nor Uint8Array in that we set start/end
    // to their upper/lower bounds if the value passed is out of range.
    // undefined is handled specially as per ECMA-262 6th Edition,
    // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
    if (start === undefined || start < 0) {
      start = 0;
    }
    // Return early if start > this.length. Done here to prevent potential uint32
    // coercion fail below.
    if (start > this.length) {
      return '';
    }

    if (end === undefined || end > this.length) {
      end = this.length;
    }

    if (end <= 0) {
      return '';
    }

    // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
    end >>>= 0;
    start >>>= 0;

    if (end <= start) {
      return '';
    }

    if (!encoding) encoding = 'utf8';

    while (true) {
      switch (encoding) {
        case 'hex':
          return hexSlice(this, start, end);

        case 'utf8':
        case 'utf-8':
          return utf8Slice(this, start, end);

        case 'ascii':
          return asciiSlice(this, start, end);

        case 'latin1':
        case 'binary':
          return latin1Slice(this, start, end);

        case 'base64':
          return base64Slice(this, start, end);

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return utf16leSlice(this, start, end);

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
          encoding = (encoding + '').toLowerCase();
          loweredCase = true;
      }
    }
  }

  // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
  // Buffer instances.
  Buffer.prototype._isBuffer = true;

  function swap(b, n, m) {
    var i = b[n];
    b[n] = b[m];
    b[m] = i;
  }

  Buffer.prototype.swap16 = function swap16() {
    var len = this.length;
    if (len % 2 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 16-bits');
    }
    for (var i = 0; i < len; i += 2) {
      swap(this, i, i + 1);
    }
    return this;
  };

  Buffer.prototype.swap32 = function swap32() {
    var len = this.length;
    if (len % 4 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 32-bits');
    }
    for (var i = 0; i < len; i += 4) {
      swap(this, i, i + 3);
      swap(this, i + 1, i + 2);
    }
    return this;
  };

  Buffer.prototype.swap64 = function swap64() {
    var len = this.length;
    if (len % 8 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 64-bits');
    }
    for (var i = 0; i < len; i += 8) {
      swap(this, i, i + 7);
      swap(this, i + 1, i + 6);
      swap(this, i + 2, i + 5);
      swap(this, i + 3, i + 4);
    }
    return this;
  };

  Buffer.prototype.toString = function toString() {
    var length = this.length | 0;
    if (length === 0) return '';
    if (arguments.length === 0) return utf8Slice(this, 0, length);
    return slowToString.apply(this, arguments);
  };

  Buffer.prototype.equals = function equals(b) {
    if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer');
    if (this === b) return true;
    return Buffer.compare(this, b) === 0;
  };

  Buffer.prototype.inspect = function inspect() {
    var str = '';
    var max = INSPECT_MAX_BYTES;
    if (this.length > 0) {
      str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
      if (this.length > max) str += ' ... ';
    }
    return '<Buffer ' + str + '>';
  };

  Buffer.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
    if (!internalIsBuffer(target)) {
      throw new TypeError('Argument must be a Buffer');
    }

    if (start === undefined) {
      start = 0;
    }
    if (end === undefined) {
      end = target ? target.length : 0;
    }
    if (thisStart === undefined) {
      thisStart = 0;
    }
    if (thisEnd === undefined) {
      thisEnd = this.length;
    }

    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
      throw new RangeError('out of range index');
    }

    if (thisStart >= thisEnd && start >= end) {
      return 0;
    }
    if (thisStart >= thisEnd) {
      return -1;
    }
    if (start >= end) {
      return 1;
    }

    start >>>= 0;
    end >>>= 0;
    thisStart >>>= 0;
    thisEnd >>>= 0;

    if (this === target) return 0;

    var x = thisEnd - thisStart;
    var y = end - start;
    var len = Math.min(x, y);

    var thisCopy = this.slice(thisStart, thisEnd);
    var targetCopy = target.slice(start, end);

    for (var i = 0; i < len; ++i) {
      if (thisCopy[i] !== targetCopy[i]) {
        x = thisCopy[i];
        y = targetCopy[i];
        break;
      }
    }

    if (x < y) return -1;
    if (y < x) return 1;
    return 0;
  };

  // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
  // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
  //
  // Arguments:
  // - buffer - a Buffer to search
  // - val - a string, Buffer, or number
  // - byteOffset - an index into `buffer`; will be clamped to an int32
  // - encoding - an optional encoding, relevant is val is a string
  // - dir - true for indexOf, false for lastIndexOf
  function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
    // Empty buffer means no match
    if (buffer.length === 0) return -1;

    // Normalize byteOffset
    if (typeof byteOffset === 'string') {
      encoding = byteOffset;
      byteOffset = 0;
    } else if (byteOffset > 0x7fffffff) {
      byteOffset = 0x7fffffff;
    } else if (byteOffset < -0x80000000) {
      byteOffset = -0x80000000;
    }
    byteOffset = +byteOffset; // Coerce to Number.
    if (isNaN(byteOffset)) {
      // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
      byteOffset = dir ? 0 : buffer.length - 1;
    }

    // Normalize byteOffset: negative offsets start from the end of the buffer
    if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
    if (byteOffset >= buffer.length) {
      if (dir) return -1;else byteOffset = buffer.length - 1;
    } else if (byteOffset < 0) {
      if (dir) byteOffset = 0;else return -1;
    }

    // Normalize val
    if (typeof val === 'string') {
      val = Buffer.from(val, encoding);
    }

    // Finally, search either indexOf (if dir is true) or lastIndexOf
    if (internalIsBuffer(val)) {
      // Special case: looking for empty string/buffer always fails
      if (val.length === 0) {
        return -1;
      }
      return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
    } else if (typeof val === 'number') {
      val = val & 0xFF; // Search for a byte value [0-255]
      if (Buffer.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf === 'function') {
        if (dir) {
          return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
        } else {
          return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
        }
      }
      return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
    }

    throw new TypeError('val must be string, number or Buffer');
  }

  function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
    var indexSize = 1;
    var arrLength = arr.length;
    var valLength = val.length;

    if (encoding !== undefined) {
      encoding = String(encoding).toLowerCase();
      if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
        if (arr.length < 2 || val.length < 2) {
          return -1;
        }
        indexSize = 2;
        arrLength /= 2;
        valLength /= 2;
        byteOffset /= 2;
      }
    }

    function read$$1(buf, i) {
      if (indexSize === 1) {
        return buf[i];
      } else {
        return buf.readUInt16BE(i * indexSize);
      }
    }

    var i;
    if (dir) {
      var foundIndex = -1;
      for (i = byteOffset; i < arrLength; i++) {
        if (read$$1(arr, i) === read$$1(val, foundIndex === -1 ? 0 : i - foundIndex)) {
          if (foundIndex === -1) foundIndex = i;
          if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
        } else {
          if (foundIndex !== -1) i -= i - foundIndex;
          foundIndex = -1;
        }
      }
    } else {
      if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
      for (i = byteOffset; i >= 0; i--) {
        var found = true;
        for (var j = 0; j < valLength; j++) {
          if (read$$1(arr, i + j) !== read$$1(val, j)) {
            found = false;
            break;
          }
        }
        if (found) return i;
      }
    }

    return -1;
  }

  Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1;
  };

  Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
  };

  Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
  };

  function hexWrite(buf, string, offset, length) {
    offset = Number(offset) || 0;
    var remaining = buf.length - offset;
    if (!length) {
      length = remaining;
    } else {
      length = Number(length);
      if (length > remaining) {
        length = remaining;
      }
    }

    // must be an even number of digits
    var strLen = string.length;
    if (strLen % 2 !== 0) throw new TypeError('Invalid hex string');

    if (length > strLen / 2) {
      length = strLen / 2;
    }
    for (var i = 0; i < length; ++i) {
      var parsed = parseInt(string.substr(i * 2, 2), 16);
      if (isNaN(parsed)) return i;
      buf[offset + i] = parsed;
    }
    return i;
  }

  function utf8Write(buf, string, offset, length) {
    return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
  }

  function asciiWrite(buf, string, offset, length) {
    return blitBuffer(asciiToBytes(string), buf, offset, length);
  }

  function latin1Write(buf, string, offset, length) {
    return asciiWrite(buf, string, offset, length);
  }

  function base64Write(buf, string, offset, length) {
    return blitBuffer(base64ToBytes(string), buf, offset, length);
  }

  function ucs2Write(buf, string, offset, length) {
    return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
  }

  Buffer.prototype.write = function write$$1(string, offset, length, encoding) {
    // Buffer#write(string)
    if (offset === undefined) {
      encoding = 'utf8';
      length = this.length;
      offset = 0;
      // Buffer#write(string, encoding)
    } else if (length === undefined && typeof offset === 'string') {
      encoding = offset;
      length = this.length;
      offset = 0;
      // Buffer#write(string, offset[, length][, encoding])
    } else if (isFinite(offset)) {
      offset = offset | 0;
      if (isFinite(length)) {
        length = length | 0;
        if (encoding === undefined) encoding = 'utf8';
      } else {
        encoding = length;
        length = undefined;
      }
      // legacy write(string, encoding, offset, length) - remove in v0.13
    } else {
      throw new Error('Buffer.write(string, encoding, offset[, length]) is no longer supported');
    }

    var remaining = this.length - offset;
    if (length === undefined || length > remaining) length = remaining;

    if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
      throw new RangeError('Attempt to write outside buffer bounds');
    }

    if (!encoding) encoding = 'utf8';

    var loweredCase = false;
    for (;;) {
      switch (encoding) {
        case 'hex':
          return hexWrite(this, string, offset, length);

        case 'utf8':
        case 'utf-8':
          return utf8Write(this, string, offset, length);

        case 'ascii':
          return asciiWrite(this, string, offset, length);

        case 'latin1':
        case 'binary':
          return latin1Write(this, string, offset, length);

        case 'base64':
          // Warning: maxLength not taken into account in base64Write
          return base64Write(this, string, offset, length);

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return ucs2Write(this, string, offset, length);

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
          encoding = ('' + encoding).toLowerCase();
          loweredCase = true;
      }
    }
  };

  Buffer.prototype.toJSON = function toJSON() {
    return {
      type: 'Buffer',
      data: Array.prototype.slice.call(this._arr || this, 0)
    };
  };

  function base64Slice(buf, start, end) {
    if (start === 0 && end === buf.length) {
      return fromByteArray(buf);
    } else {
      return fromByteArray(buf.slice(start, end));
    }
  }

  function utf8Slice(buf, start, end) {
    end = Math.min(buf.length, end);
    var res = [];

    var i = start;
    while (i < end) {
      var firstByte = buf[i];
      var codePoint = null;
      var bytesPerSequence = firstByte > 0xEF ? 4 : firstByte > 0xDF ? 3 : firstByte > 0xBF ? 2 : 1;

      if (i + bytesPerSequence <= end) {
        var secondByte, thirdByte, fourthByte, tempCodePoint;

        switch (bytesPerSequence) {
          case 1:
            if (firstByte < 0x80) {
              codePoint = firstByte;
            }
            break;
          case 2:
            secondByte = buf[i + 1];
            if ((secondByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0x1F) << 0x6 | secondByte & 0x3F;
              if (tempCodePoint > 0x7F) {
                codePoint = tempCodePoint;
              }
            }
            break;
          case 3:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | thirdByte & 0x3F;
              if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                codePoint = tempCodePoint;
              }
            }
            break;
          case 4:
            secondByte = buf[i + 1];
            thirdByte = buf[i + 2];
            fourthByte = buf[i + 3];
            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
              tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | fourthByte & 0x3F;
              if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                codePoint = tempCodePoint;
              }
            }
        }
      }

      if (codePoint === null) {
        // we did not generate a valid codePoint so insert a
        // replacement char (U+FFFD) and advance only 1 byte
        codePoint = 0xFFFD;
        bytesPerSequence = 1;
      } else if (codePoint > 0xFFFF) {
        // encode to utf16 (surrogate pair dance)
        codePoint -= 0x10000;
        res.push(codePoint >>> 10 & 0x3FF | 0xD800);
        codePoint = 0xDC00 | codePoint & 0x3FF;
      }

      res.push(codePoint);
      i += bytesPerSequence;
    }

    return decodeCodePointsArray(res);
  }

  // Based on http://stackoverflow.com/a/22747272/680742, the browser with
  // the lowest limit is Chrome, with 0x10000 args.
  // We go 1 magnitude less, for safety
  var MAX_ARGUMENTS_LENGTH = 0x1000;

  function decodeCodePointsArray(codePoints) {
    var len = codePoints.length;
    if (len <= MAX_ARGUMENTS_LENGTH) {
      return String.fromCharCode.apply(String, codePoints); // avoid extra slice()
    }

    // Decode in chunks to avoid "call stack size exceeded".
    var res = '';
    var i = 0;
    while (i < len) {
      res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
    }
    return res;
  }

  function asciiSlice(buf, start, end) {
    var ret = '';
    end = Math.min(buf.length, end);

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i] & 0x7F);
    }
    return ret;
  }

  function latin1Slice(buf, start, end) {
    var ret = '';
    end = Math.min(buf.length, end);

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i]);
    }
    return ret;
  }

  function hexSlice(buf, start, end) {
    var len = buf.length;

    if (!start || start < 0) start = 0;
    if (!end || end < 0 || end > len) end = len;

    var out = '';
    for (var i = start; i < end; ++i) {
      out += toHex(buf[i]);
    }
    return out;
  }

  function utf16leSlice(buf, start, end) {
    var bytes = buf.slice(start, end);
    var res = '';
    for (var i = 0; i < bytes.length; i += 2) {
      res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
    }
    return res;
  }

  Buffer.prototype.slice = function slice(start, end) {
    var len = this.length;
    start = ~~start;
    end = end === undefined ? len : ~~end;

    if (start < 0) {
      start += len;
      if (start < 0) start = 0;
    } else if (start > len) {
      start = len;
    }

    if (end < 0) {
      end += len;
      if (end < 0) end = 0;
    } else if (end > len) {
      end = len;
    }

    if (end < start) end = start;

    var newBuf;
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      newBuf = this.subarray(start, end);
      newBuf.__proto__ = Buffer.prototype;
    } else {
      var sliceLen = end - start;
      newBuf = new Buffer(sliceLen, undefined);
      for (var i = 0; i < sliceLen; ++i) {
        newBuf[i] = this[i + start];
      }
    }

    return newBuf;
  };

  /*
   * Need to make sure that buffer isn't trying to write out of bounds.
   */
  function checkOffset(offset, ext, length) {
    if (offset % 1 !== 0 || offset < 0) throw new RangeError('offset is not uint');
    if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length');
  }

  Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var val = this[offset];
    var mul = 1;
    var i = 0;
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }

    return val;
  };

  Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      checkOffset(offset, byteLength, this.length);
    }

    var val = this[offset + --byteLength];
    var mul = 1;
    while (byteLength > 0 && (mul *= 0x100)) {
      val += this[offset + --byteLength] * mul;
    }

    return val;
  };

  Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    return this[offset];
  };

  Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return this[offset] | this[offset + 1] << 8;
  };

  Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return this[offset] << 8 | this[offset + 1];
  };

  Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 0x1000000;
  };

  Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return this[offset] * 0x1000000 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
  };

  Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var val = this[offset];
    var mul = 1;
    var i = 0;
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul;
    }
    mul *= 0x80;

    if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    return val;
  };

  Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) checkOffset(offset, byteLength, this.length);

    var i = byteLength;
    var mul = 1;
    var val = this[offset + --i];
    while (i > 0 && (mul *= 0x100)) {
      val += this[offset + --i] * mul;
    }
    mul *= 0x80;

    if (val >= mul) val -= Math.pow(2, 8 * byteLength);

    return val;
  };

  Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    if (!(this[offset] & 0x80)) return this[offset];
    return (0xff - this[offset] + 1) * -1;
  };

  Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset] | this[offset + 1] << 8;
    return val & 0x8000 ? val | 0xFFFF0000 : val;
  };

  Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset + 1] | this[offset] << 8;
    return val & 0x8000 ? val | 0xFFFF0000 : val;
  };

  Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
  };

  Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
  };

  Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, true, 23, 4);
  };

  Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, false, 23, 4);
  };

  Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, true, 52, 8);
  };

  Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, false, 52, 8);
  };

  function checkInt(buf, value, offset, ext, max, min) {
    if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
    if (offset + ext > buf.length) throw new RangeError('Index out of range');
  }

  Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
      checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    var mul = 1;
    var i = 0;
    this[offset] = value & 0xFF;
    while (++i < byteLength && (mul *= 0x100)) {
      this[offset + i] = value / mul & 0xFF;
    }

    return offset + byteLength;
  };

  Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    byteLength = byteLength | 0;
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
      checkInt(this, value, offset, byteLength, maxBytes, 0);
    }

    var i = byteLength - 1;
    var mul = 1;
    this[offset + i] = value & 0xFF;
    while (--i >= 0 && (mul *= 0x100)) {
      this[offset + i] = value / mul & 0xFF;
    }

    return offset + byteLength;
  };

  Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    this[offset] = value & 0xff;
    return offset + 1;
  };

  function objectWriteUInt16(buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffff + value + 1;
    for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
      buf[offset + i] = (value & 0xff << 8 * (littleEndian ? i : 1 - i)) >>> (littleEndian ? i : 1 - i) * 8;
    }
  }

  Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = value & 0xff;
      this[offset + 1] = value >>> 8;
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2;
  };

  Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = value >>> 8;
      this[offset + 1] = value & 0xff;
    } else {
      objectWriteUInt16(this, value, offset, false);
    }
    return offset + 2;
  };

  function objectWriteUInt32(buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffffffff + value + 1;
    for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
      buf[offset + i] = value >>> (littleEndian ? i : 3 - i) * 8 & 0xff;
    }
  }

  Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset + 3] = value >>> 24;
      this[offset + 2] = value >>> 16;
      this[offset + 1] = value >>> 8;
      this[offset] = value & 0xff;
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4;
  };

  Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 0xff;
    } else {
      objectWriteUInt32(this, value, offset, false);
    }
    return offset + 4;
  };

  Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1);

      checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    var i = 0;
    var mul = 1;
    var sub = 0;
    this[offset] = value & 0xFF;
    while (++i < byteLength && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
        sub = 1;
      }
      this[offset + i] = (value / mul >> 0) - sub & 0xFF;
    }

    return offset + byteLength;
  };

  Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1);

      checkInt(this, value, offset, byteLength, limit - 1, -limit);
    }

    var i = byteLength - 1;
    var mul = 1;
    var sub = 0;
    this[offset + i] = value & 0xFF;
    while (--i >= 0 && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
        sub = 1;
      }
      this[offset + i] = (value / mul >> 0) - sub & 0xFF;
    }

    return offset + byteLength;
  };

  Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
    if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    if (value < 0) value = 0xff + value + 1;
    this[offset] = value & 0xff;
    return offset + 1;
  };

  Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = value & 0xff;
      this[offset + 1] = value >>> 8;
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2;
  };

  Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = value >>> 8;
      this[offset + 1] = value & 0xff;
    } else {
      objectWriteUInt16(this, value, offset, false);
    }
    return offset + 2;
  };

  Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = value & 0xff;
      this[offset + 1] = value >>> 8;
      this[offset + 2] = value >>> 16;
      this[offset + 3] = value >>> 24;
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4;
  };

  Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    if (value < 0) value = 0xffffffff + value + 1;
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 0xff;
    } else {
      objectWriteUInt32(this, value, offset, false);
    }
    return offset + 4;
  };

  function checkIEEE754(buf, value, offset, ext, max, min) {
    if (offset + ext > buf.length) throw new RangeError('Index out of range');
    if (offset < 0) throw new RangeError('Index out of range');
  }

  function writeFloat(buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38);
    }
    write(buf, value, offset, littleEndian, 23, 4);
    return offset + 4;
  }

  Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
    return writeFloat(this, value, offset, true, noAssert);
  };

  Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
    return writeFloat(this, value, offset, false, noAssert);
  };

  function writeDouble(buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308);
    }
    write(buf, value, offset, littleEndian, 52, 8);
    return offset + 8;
  }

  Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
    return writeDouble(this, value, offset, true, noAssert);
  };

  Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
    return writeDouble(this, value, offset, false, noAssert);
  };

  // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
  Buffer.prototype.copy = function copy(target, targetStart, start, end) {
    if (!start) start = 0;
    if (!end && end !== 0) end = this.length;
    if (targetStart >= target.length) targetStart = target.length;
    if (!targetStart) targetStart = 0;
    if (end > 0 && end < start) end = start;

    // Copy 0 bytes; we're done
    if (end === start) return 0;
    if (target.length === 0 || this.length === 0) return 0;

    // Fatal error conditions
    if (targetStart < 0) {
      throw new RangeError('targetStart out of bounds');
    }
    if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds');
    if (end < 0) throw new RangeError('sourceEnd out of bounds');

    // Are we oob?
    if (end > this.length) end = this.length;
    if (target.length - targetStart < end - start) {
      end = target.length - targetStart + start;
    }

    var len = end - start;
    var i;

    if (this === target && start < targetStart && targetStart < end) {
      // descending copy from end
      for (i = len - 1; i >= 0; --i) {
        target[i + targetStart] = this[i + start];
      }
    } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
      // ascending copy from start
      for (i = 0; i < len; ++i) {
        target[i + targetStart] = this[i + start];
      }
    } else {
      Uint8Array.prototype.set.call(target, this.subarray(start, start + len), targetStart);
    }

    return len;
  };

  // Usage:
  //    buffer.fill(number[, offset[, end]])
  //    buffer.fill(buffer[, offset[, end]])
  //    buffer.fill(string[, offset[, end]][, encoding])
  Buffer.prototype.fill = function fill(val, start, end, encoding) {
    // Handle string cases:
    if (typeof val === 'string') {
      if (typeof start === 'string') {
        encoding = start;
        start = 0;
        end = this.length;
      } else if (typeof end === 'string') {
        encoding = end;
        end = this.length;
      }
      if (val.length === 1) {
        var code = val.charCodeAt(0);
        if (code < 256) {
          val = code;
        }
      }
      if (encoding !== undefined && typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string');
      }
      if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
        throw new TypeError('Unknown encoding: ' + encoding);
      }
    } else if (typeof val === 'number') {
      val = val & 255;
    }

    // Invalid ranges are not set to a default, so can range check early.
    if (start < 0 || this.length < start || this.length < end) {
      throw new RangeError('Out of range index');
    }

    if (end <= start) {
      return this;
    }

    start = start >>> 0;
    end = end === undefined ? this.length : end >>> 0;

    if (!val) val = 0;

    var i;
    if (typeof val === 'number') {
      for (i = start; i < end; ++i) {
        this[i] = val;
      }
    } else {
      var bytes = internalIsBuffer(val) ? val : utf8ToBytes(new Buffer(val, encoding).toString());
      var len = bytes.length;
      for (i = 0; i < end - start; ++i) {
        this[i + start] = bytes[i % len];
      }
    }

    return this;
  };

  // HELPER FUNCTIONS
  // ================

  var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

  function base64clean(str) {
    // Node strips out invalid characters like \n and \t from the string, base64-js does not
    str = stringtrim(str).replace(INVALID_BASE64_RE, '');
    // Node converts strings with length < 2 to ''
    if (str.length < 2) return '';
    // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
    while (str.length % 4 !== 0) {
      str = str + '=';
    }
    return str;
  }

  function stringtrim(str) {
    if (str.trim) return str.trim();
    return str.replace(/^\s+|\s+$/g, '');
  }

  function toHex(n) {
    if (n < 16) return '0' + n.toString(16);
    return n.toString(16);
  }

  function utf8ToBytes(string, units) {
    units = units || Infinity;
    var codePoint;
    var length = string.length;
    var leadSurrogate = null;
    var bytes = [];

    for (var i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i);

      // is surrogate component
      if (codePoint > 0xD7FF && codePoint < 0xE000) {
        // last char was a lead
        if (!leadSurrogate) {
          // no lead yet
          if (codePoint > 0xDBFF) {
            // unexpected trail
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
            continue;
          } else if (i + 1 === length) {
            // unpaired lead
            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
            continue;
          }

          // valid lead
          leadSurrogate = codePoint;

          continue;
        }

        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          leadSurrogate = codePoint;
          continue;
        }

        // valid surrogate pair
        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
      } else if (leadSurrogate) {
        // valid bmp char, but last char was a lead
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
      }

      leadSurrogate = null;

      // encode utf8
      if (codePoint < 0x80) {
        if ((units -= 1) < 0) break;
        bytes.push(codePoint);
      } else if (codePoint < 0x800) {
        if ((units -= 2) < 0) break;
        bytes.push(codePoint >> 0x6 | 0xC0, codePoint & 0x3F | 0x80);
      } else if (codePoint < 0x10000) {
        if ((units -= 3) < 0) break;
        bytes.push(codePoint >> 0xC | 0xE0, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
      } else if (codePoint < 0x110000) {
        if ((units -= 4) < 0) break;
        bytes.push(codePoint >> 0x12 | 0xF0, codePoint >> 0xC & 0x3F | 0x80, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
      } else {
        throw new Error('Invalid code point');
      }
    }

    return bytes;
  }

  function asciiToBytes(str) {
    var byteArray = [];
    for (var i = 0; i < str.length; ++i) {
      // Node's code seems to be doing this and not & 0x7F..
      byteArray.push(str.charCodeAt(i) & 0xFF);
    }
    return byteArray;
  }

  function utf16leToBytes(str, units) {
    var c, hi, lo;
    var byteArray = [];
    for (var i = 0; i < str.length; ++i) {
      if ((units -= 2) < 0) break;

      c = str.charCodeAt(i);
      hi = c >> 8;
      lo = c % 256;
      byteArray.push(lo);
      byteArray.push(hi);
    }

    return byteArray;
  }

  function base64ToBytes(str) {
    return toByteArray(base64clean(str));
  }

  function blitBuffer(src, dst, offset, length) {
    for (var i = 0; i < length; ++i) {
      if (i + offset >= dst.length || i >= src.length) break;
      dst[i + offset] = src[i];
    }
    return i;
  }

  function isnan(val) {
    return val !== val; // eslint-disable-line no-self-compare
  }

  // the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
  // The _isBuffer check is for Safari 5-7 support, because it's missing
  // Object.prototype.constructor. Remove this eventually
  function isBuffer(obj) {
    return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj));
  }

  function isFastBuffer(obj) {
    return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj);
  }

  // For Node v0.10 support. Remove this eventually.
  function isSlowBuffer(obj) {
    return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0));
  }

  // shim for using process in browser
  // based off https://github.com/defunctzombie/node-process/blob/master/browser.js

  function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
  }
  function defaultClearTimeout() {
    throw new Error('clearTimeout has not been defined');
  }
  var cachedSetTimeout = defaultSetTimout;
  var cachedClearTimeout = defaultClearTimeout;
  if (typeof global$1.setTimeout === 'function') {
    cachedSetTimeout = setTimeout;
  }
  if (typeof global$1.clearTimeout === 'function') {
    cachedClearTimeout = clearTimeout;
  }

  function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
      //normal enviroments in sane situations
      return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
      cachedSetTimeout = setTimeout;
      return setTimeout(fun, 0);
    }
    try {
      // when when somebody has screwed with setTimeout but no I.E. maddness
      return cachedSetTimeout(fun, 0);
    } catch (e) {
      try {
        // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
        return cachedSetTimeout.call(null, fun, 0);
      } catch (e) {
        // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
        return cachedSetTimeout.call(this, fun, 0);
      }
    }
  }
  function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
      //normal enviroments in sane situations
      return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
      cachedClearTimeout = clearTimeout;
      return clearTimeout(marker);
    }
    try {
      // when when somebody has screwed with setTimeout but no I.E. maddness
      return cachedClearTimeout(marker);
    } catch (e) {
      try {
        // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
        return cachedClearTimeout.call(null, marker);
      } catch (e) {
        // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
        // Some versions of I.E. have different rules for clearTimeout vs setTimeout
        return cachedClearTimeout.call(this, marker);
      }
    }
  }
  var queue = [];
  var draining = false;
  var currentQueue;
  var queueIndex = -1;

  function cleanUpNextTick() {
    if (!draining || !currentQueue) {
      return;
    }
    draining = false;
    if (currentQueue.length) {
      queue = currentQueue.concat(queue);
    } else {
      queueIndex = -1;
    }
    if (queue.length) {
      drainQueue();
    }
  }

  function drainQueue() {
    if (draining) {
      return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while (len) {
      currentQueue = queue;
      queue = [];
      while (++queueIndex < len) {
        if (currentQueue) {
          currentQueue[queueIndex].run();
        }
      }
      queueIndex = -1;
      len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
  }
  function nextTick(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
      runTimeout(drainQueue);
    }
  }
  // v8 likes predictible objects
  function Item(fun, array) {
    this.fun = fun;
    this.array = array;
  }
  Item.prototype.run = function () {
    this.fun.apply(null, this.array);
  };
  var title = 'browser';
  var platform = 'browser';
  var browser = true;
  var env = {};
  var argv = [];
  var version = ''; // empty string to avoid regexp issues
  var versions = {};
  var release = {};
  var config = {};

  function noop() {}

  var on = noop;
  var addListener = noop;
  var once = noop;
  var off = noop;
  var removeListener = noop;
  var removeAllListeners = noop;
  var emit = noop;

  function binding(name) {
    throw new Error('process.binding is not supported');
  }

  function cwd() {
    return '/';
  }
  function chdir(dir) {
    throw new Error('process.chdir is not supported');
  }
  function umask() {
    return 0;
  }

  // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
  var performance = global$1.performance || {};
  var performanceNow = performance.now || performance.mozNow || performance.msNow || performance.oNow || performance.webkitNow || function () {
    return new Date().getTime();
  };

  // generate timestamp or delta
  // see http://nodejs.org/api/process.html#process_process_hrtime
  function hrtime(previousTimestamp) {
    var clocktime = performanceNow.call(performance) * 1e-3;
    var seconds = Math.floor(clocktime);
    var nanoseconds = Math.floor(clocktime % 1 * 1e9);
    if (previousTimestamp) {
      seconds = seconds - previousTimestamp[0];
      nanoseconds = nanoseconds - previousTimestamp[1];
      if (nanoseconds < 0) {
        seconds--;
        nanoseconds += 1e9;
      }
    }
    return [seconds, nanoseconds];
  }

  var startTime = new Date();
  function uptime() {
    var currentTime = new Date();
    var dif = currentTime - startTime;
    return dif / 1000;
  }

  var process = {
    nextTick: nextTick,
    title: title,
    browser: browser,
    env: env,
    argv: argv,
    version: version,
    versions: versions,
    on: on,
    addListener: addListener,
    once: once,
    off: off,
    removeListener: removeListener,
    removeAllListeners: removeAllListeners,
    emit: emit,
    binding: binding,
    cwd: cwd,
    chdir: chdir,
    umask: umask,
    hrtime: hrtime,
    platform: platform,
    release: release,
    config: config,
    uptime: uptime
  };

  var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
    return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var index$2 = createCommonjsModule(function (module, exports) {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports["default"] = pickOneByWeight;

    function pickOneByWeight(anObj) {
      var _keys = Object.keys(anObj);
      var sum = _keys.reduce(function (p, c) {
        return p + anObj[c];
      }, 0);
      if (!Number.isFinite(sum)) {
        throw new Error("All values in object must be a numeric value");
      }
      var choose = ~~(Math.random() * sum);
      for (var i = 0, count = 0; i < _keys.length; i++) {
        count += anObj[_keys[i]];
        if (count > choose) {
          return _keys[i];
        }
      }
    }

    module.exports = exports["default"];
  });

  var name = "markovchain";
  var version$1 = "1.0.2";
  var description = "generates a markov chain of words based on input files";
  var main = "lib/index.js";
  var directories = { "test": "test" };
  var scripts = { "test": "mocha test/test*.js", "babel-watch": "babel src --watch --out-dir lib", "compile": "babel src --out-dir lib", "preversion": "npm test", "prepublish": "npm run compile && npm test", "postpublish": "rm -rf ./lib/*.js" };
  var repository = { "type": "git", "url": "https://github.com/swang/markovchain" };
  var keywords = ["markov chain", "markov"];
  var dependencies = { "pick-one-by-weight": "~1.0.0" };
  var devDependencies = { "babel": "~5.8.23", "chai": "~3.4.1", "mocha": "~2.3.4" };
  var author = "Shuan Wang";
  var license = "ISC";
  var bugs = { "url": "https://github.com/swang/markovchain/issues" };
  var engines = { "node": ">=0.8" };
  var _package = {
    name: name,
    version: version$1,
    description: description,
    main: main,
    directories: directories,
    scripts: scripts,
    repository: repository,
    keywords: keywords,
    dependencies: dependencies,
    devDependencies: devDependencies,
    author: author,
    license: license,
    bugs: bugs,
    engines: engines
  };

  var _package$1 = Object.freeze({
    name: name,
    version: version$1,
    description: description,
    main: main,
    directories: directories,
    scripts: scripts,
    repository: repository,
    keywords: keywords,
    dependencies: dependencies,
    devDependencies: devDependencies,
    author: author,
    license: license,
    bugs: bugs,
    engines: engines,
    default: _package
  });

  var async = createCommonjsModule(function (module, exports) {
    (function (global, factory) {
      factory(exports);
    })(commonjsGlobal, function (exports) {
      'use strict';

      function slice(arrayLike, start) {
        start = start | 0;
        var newLen = Math.max(arrayLike.length - start, 0);
        var newArr = Array(newLen);
        for (var idx = 0; idx < newLen; idx++) {
          newArr[idx] = arrayLike[start + idx];
        }
        return newArr;
      }

      var initialParams = function initialParams(fn) {
        return function () /*...args, callback*/{
          var args = slice(arguments);
          var callback = args.pop();
          fn.call(this, args, callback);
        };
      };

      /**
       * Checks if `value` is the
       * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
       * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
       *
       * @static
       * @memberOf _
       * @since 0.1.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is an object, else `false`.
       * @example
       *
       * _.isObject({});
       * // => true
       *
       * _.isObject([1, 2, 3]);
       * // => true
       *
       * _.isObject(_.noop);
       * // => true
       *
       * _.isObject(null);
       * // => false
       */
      function isObject(value) {
        var type = typeof value === "undefined" ? "undefined" : _typeof(value);
        return value != null && (type == 'object' || type == 'function');
      }

      var hasSetImmediate = typeof setImmediate === 'function' && setImmediate;
      var hasNextTick = (typeof process === "undefined" ? "undefined" : _typeof(process)) === 'object' && typeof nextTick === 'function';

      function fallback(fn) {
        setTimeout(fn, 0);
      }

      function wrap(defer) {
        return function (fn /*, ...args*/) {
          var args = slice(arguments, 1);
          defer(function () {
            fn.apply(null, args);
          });
        };
      }

      var _defer;

      if (hasSetImmediate) {
        _defer = setImmediate;
      } else if (hasNextTick) {
        _defer = nextTick;
      } else {
        _defer = fallback;
      }

      var setImmediate$1 = wrap(_defer);

      /**
       * Take a sync function and make it async, passing its return value to a
       * callback. This is useful for plugging sync functions into a waterfall,
       * series, or other async functions. Any arguments passed to the generated
       * function will be passed to the wrapped function (except for the final
       * callback argument). Errors thrown will be passed to the callback.
       *
       * If the function passed to `asyncify` returns a Promise, that promises's
       * resolved/rejected state will be used to call the callback, rather than simply
       * the synchronous return value.
       *
       * This also means you can asyncify ES2017 `async` functions.
       *
       * @name asyncify
       * @static
       * @memberOf module:Utils
       * @method
       * @alias wrapSync
       * @category Util
       * @param {Function} func - The synchronous function, or Promise-returning
       * function to convert to an {@link AsyncFunction}.
       * @returns {AsyncFunction} An asynchronous wrapper of the `func`. To be
       * invoked with `(args..., callback)`.
       * @example
       *
       * // passing a regular synchronous function
       * async.waterfall([
       *     async.apply(fs.readFile, filename, "utf8"),
       *     async.asyncify(JSON.parse),
       *     function (data, next) {
       *         // data is the result of parsing the text.
       *         // If there was a parsing error, it would have been caught.
       *     }
       * ], callback);
       *
       * // passing a function returning a promise
       * async.waterfall([
       *     async.apply(fs.readFile, filename, "utf8"),
       *     async.asyncify(function (contents) {
       *         return db.model.create(contents);
       *     }),
       *     function (model, next) {
       *         // `model` is the instantiated model object.
       *         // If there was an error, this function would be skipped.
       *     }
       * ], callback);
       *
       * // es2017 example, though `asyncify` is not needed if your JS environment
       * // supports async functions out of the box
       * var q = async.queue(async.asyncify(async function(file) {
       *     var intermediateStep = await processFile(file);
       *     return await somePromise(intermediateStep)
       * }));
       *
       * q.push(files);
       */
      function asyncify(func) {
        return initialParams(function (args, callback) {
          var result;
          try {
            result = func.apply(this, args);
          } catch (e) {
            return callback(e);
          }
          // if result is Promise object
          if (isObject(result) && typeof result.then === 'function') {
            result.then(function (value) {
              invokeCallback(callback, null, value);
            }, function (err) {
              invokeCallback(callback, err.message ? err : new Error(err));
            });
          } else {
            callback(null, result);
          }
        });
      }

      function invokeCallback(callback, error, value) {
        try {
          callback(error, value);
        } catch (e) {
          setImmediate$1(rethrow, e);
        }
      }

      function rethrow(error) {
        throw error;
      }

      var supportsSymbol = typeof Symbol === 'function';

      function isAsync(fn) {
        return supportsSymbol && fn[Symbol.toStringTag] === 'AsyncFunction';
      }

      function wrapAsync(asyncFn) {
        return isAsync(asyncFn) ? asyncify(asyncFn) : asyncFn;
      }

      function applyEach$1(eachfn) {
        return function (fns /*, ...args*/) {
          var args = slice(arguments, 1);
          var go = initialParams(function (args, callback) {
            var that = this;
            return eachfn(fns, function (fn, cb) {
              wrapAsync(fn).apply(that, args.concat(cb));
            }, callback);
          });
          if (args.length) {
            return go.apply(this, args);
          } else {
            return go;
          }
        };
      }

      /** Detect free variable `global` from Node.js. */
      var freeGlobal = (typeof commonjsGlobal === "undefined" ? "undefined" : _typeof(commonjsGlobal)) == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

      /** Detect free variable `self`. */
      var freeSelf = (typeof self === "undefined" ? "undefined" : _typeof(self)) == 'object' && self && self.Object === Object && self;

      /** Used as a reference to the global object. */
      var root = freeGlobal || freeSelf || Function('return this')();

      /** Built-in value references. */
      var Symbol$1 = root.Symbol;

      /** Used for built-in method references. */
      var objectProto = Object.prototype;

      /** Used to check objects for own properties. */
      var hasOwnProperty = objectProto.hasOwnProperty;

      /**
       * Used to resolve the
       * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
       * of values.
       */
      var nativeObjectToString = objectProto.toString;

      /** Built-in value references. */
      var symToStringTag$1 = Symbol$1 ? Symbol$1.toStringTag : undefined;

      /**
       * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
       *
       * @private
       * @param {*} value The value to query.
       * @returns {string} Returns the raw `toStringTag`.
       */
      function getRawTag(value) {
        var isOwn = hasOwnProperty.call(value, symToStringTag$1),
            tag = value[symToStringTag$1];

        try {
          value[symToStringTag$1] = undefined;
          var unmasked = true;
        } catch (e) {}

        var result = nativeObjectToString.call(value);
        if (unmasked) {
          if (isOwn) {
            value[symToStringTag$1] = tag;
          } else {
            delete value[symToStringTag$1];
          }
        }
        return result;
      }

      /** Used for built-in method references. */
      var objectProto$1 = Object.prototype;

      /**
       * Used to resolve the
       * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
       * of values.
       */
      var nativeObjectToString$1 = objectProto$1.toString;

      /**
       * Converts `value` to a string using `Object.prototype.toString`.
       *
       * @private
       * @param {*} value The value to convert.
       * @returns {string} Returns the converted string.
       */
      function objectToString(value) {
        return nativeObjectToString$1.call(value);
      }

      /** `Object#toString` result references. */
      var nullTag = '[object Null]';
      var undefinedTag = '[object Undefined]';

      /** Built-in value references. */
      var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : undefined;

      /**
       * The base implementation of `getTag` without fallbacks for buggy environments.
       *
       * @private
       * @param {*} value The value to query.
       * @returns {string} Returns the `toStringTag`.
       */
      function baseGetTag(value) {
        if (value == null) {
          return value === undefined ? undefinedTag : nullTag;
        }
        value = Object(value);
        return symToStringTag && symToStringTag in value ? getRawTag(value) : objectToString(value);
      }

      /** `Object#toString` result references. */
      var asyncTag = '[object AsyncFunction]';
      var funcTag = '[object Function]';
      var genTag = '[object GeneratorFunction]';
      var proxyTag = '[object Proxy]';

      /**
       * Checks if `value` is classified as a `Function` object.
       *
       * @static
       * @memberOf _
       * @since 0.1.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a function, else `false`.
       * @example
       *
       * _.isFunction(_);
       * // => true
       *
       * _.isFunction(/abc/);
       * // => false
       */
      function isFunction(value) {
        if (!isObject(value)) {
          return false;
        }
        // The use of `Object#toString` avoids issues with the `typeof` operator
        // in Safari 9 which returns 'object' for typed arrays and other constructors.
        var tag = baseGetTag(value);
        return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
      }

      /** Used as references for various `Number` constants. */
      var MAX_SAFE_INTEGER = 9007199254740991;

      /**
       * Checks if `value` is a valid array-like length.
       *
       * **Note:** This method is loosely based on
       * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
       *
       * @static
       * @memberOf _
       * @since 4.0.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
       * @example
       *
       * _.isLength(3);
       * // => true
       *
       * _.isLength(Number.MIN_VALUE);
       * // => false
       *
       * _.isLength(Infinity);
       * // => false
       *
       * _.isLength('3');
       * // => false
       */
      function isLength(value) {
        return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
      }

      /**
       * Checks if `value` is array-like. A value is considered array-like if it's
       * not a function and has a `value.length` that's an integer greater than or
       * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
       *
       * @static
       * @memberOf _
       * @since 4.0.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
       * @example
       *
       * _.isArrayLike([1, 2, 3]);
       * // => true
       *
       * _.isArrayLike(document.body.children);
       * // => true
       *
       * _.isArrayLike('abc');
       * // => true
       *
       * _.isArrayLike(_.noop);
       * // => false
       */
      function isArrayLike(value) {
        return value != null && isLength(value.length) && !isFunction(value);
      }

      // A temporary value used to identify if the loop should be broken.
      // See #1064, #1293
      var breakLoop = {};

      /**
       * This method returns `undefined`.
       *
       * @static
       * @memberOf _
       * @since 2.3.0
       * @category Util
       * @example
       *
       * _.times(2, _.noop);
       * // => [undefined, undefined]
       */
      function noop() {
        // No operation performed.
      }

      function once$$1(fn) {
        return function () {
          if (fn === null) return;
          var callFn = fn;
          fn = null;
          callFn.apply(this, arguments);
        };
      }

      var iteratorSymbol = typeof Symbol === 'function' && Symbol.iterator;

      var getIterator = function getIterator(coll) {
        return iteratorSymbol && coll[iteratorSymbol] && coll[iteratorSymbol]();
      };

      /**
       * The base implementation of `_.times` without support for iteratee shorthands
       * or max array length checks.
       *
       * @private
       * @param {number} n The number of times to invoke `iteratee`.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Array} Returns the array of results.
       */
      function baseTimes(n, iteratee) {
        var index = -1,
            result = Array(n);

        while (++index < n) {
          result[index] = iteratee(index);
        }
        return result;
      }

      /**
       * Checks if `value` is object-like. A value is object-like if it's not `null`
       * and has a `typeof` result of "object".
       *
       * @static
       * @memberOf _
       * @since 4.0.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
       * @example
       *
       * _.isObjectLike({});
       * // => true
       *
       * _.isObjectLike([1, 2, 3]);
       * // => true
       *
       * _.isObjectLike(_.noop);
       * // => false
       *
       * _.isObjectLike(null);
       * // => false
       */
      function isObjectLike(value) {
        return value != null && (typeof value === "undefined" ? "undefined" : _typeof(value)) == 'object';
      }

      /** `Object#toString` result references. */
      var argsTag = '[object Arguments]';

      /**
       * The base implementation of `_.isArguments`.
       *
       * @private
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is an `arguments` object,
       */
      function baseIsArguments(value) {
        return isObjectLike(value) && baseGetTag(value) == argsTag;
      }

      /** Used for built-in method references. */
      var objectProto$3 = Object.prototype;

      /** Used to check objects for own properties. */
      var hasOwnProperty$2 = objectProto$3.hasOwnProperty;

      /** Built-in value references. */
      var propertyIsEnumerable = objectProto$3.propertyIsEnumerable;

      /**
       * Checks if `value` is likely an `arguments` object.
       *
       * @static
       * @memberOf _
       * @since 0.1.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is an `arguments` object,
       *  else `false`.
       * @example
       *
       * _.isArguments(function() { return arguments; }());
       * // => true
       *
       * _.isArguments([1, 2, 3]);
       * // => false
       */
      var isArguments = baseIsArguments(function () {
        return arguments;
      }()) ? baseIsArguments : function (value) {
        return isObjectLike(value) && hasOwnProperty$2.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
      };

      /**
       * Checks if `value` is classified as an `Array` object.
       *
       * @static
       * @memberOf _
       * @since 0.1.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is an array, else `false`.
       * @example
       *
       * _.isArray([1, 2, 3]);
       * // => true
       *
       * _.isArray(document.body.children);
       * // => false
       *
       * _.isArray('abc');
       * // => false
       *
       * _.isArray(_.noop);
       * // => false
       */
      var isArray = Array.isArray;

      /**
       * This method returns `false`.
       *
       * @static
       * @memberOf _
       * @since 4.13.0
       * @category Util
       * @returns {boolean} Returns `false`.
       * @example
       *
       * _.times(2, _.stubFalse);
       * // => [false, false]
       */
      function stubFalse() {
        return false;
      }

      /** Detect free variable `exports`. */
      var freeExports = (typeof exports === "undefined" ? "undefined" : _typeof(exports)) == 'object' && exports && !exports.nodeType && exports;

      /** Detect free variable `module`. */
      var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;

      /** Detect the popular CommonJS extension `module.exports`. */
      var moduleExports = freeModule && freeModule.exports === freeExports;

      /** Built-in value references. */
      var Buffer = moduleExports ? root.Buffer : undefined;

      /* Built-in method references for those with the same name as other `lodash` methods. */
      var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

      /**
       * Checks if `value` is a buffer.
       *
       * @static
       * @memberOf _
       * @since 4.3.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
       * @example
       *
       * _.isBuffer(new Buffer(2));
       * // => true
       *
       * _.isBuffer(new Uint8Array(2));
       * // => false
       */
      var isBuffer = nativeIsBuffer || stubFalse;

      /** Used as references for various `Number` constants. */
      var MAX_SAFE_INTEGER$1 = 9007199254740991;

      /** Used to detect unsigned integer values. */
      var reIsUint = /^(?:0|[1-9]\d*)$/;

      /**
       * Checks if `value` is a valid array-like index.
       *
       * @private
       * @param {*} value The value to check.
       * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
       * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
       */
      function isIndex(value, length) {
        length = length == null ? MAX_SAFE_INTEGER$1 : length;
        return !!length && (typeof value == 'number' || reIsUint.test(value)) && value > -1 && value % 1 == 0 && value < length;
      }

      /** `Object#toString` result references. */
      var argsTag$1 = '[object Arguments]';
      var arrayTag = '[object Array]';
      var boolTag = '[object Boolean]';
      var dateTag = '[object Date]';
      var errorTag = '[object Error]';
      var funcTag$1 = '[object Function]';
      var mapTag = '[object Map]';
      var numberTag = '[object Number]';
      var objectTag = '[object Object]';
      var regexpTag = '[object RegExp]';
      var setTag = '[object Set]';
      var stringTag = '[object String]';
      var weakMapTag = '[object WeakMap]';

      var arrayBufferTag = '[object ArrayBuffer]';
      var dataViewTag = '[object DataView]';
      var float32Tag = '[object Float32Array]';
      var float64Tag = '[object Float64Array]';
      var int8Tag = '[object Int8Array]';
      var int16Tag = '[object Int16Array]';
      var int32Tag = '[object Int32Array]';
      var uint8Tag = '[object Uint8Array]';
      var uint8ClampedTag = '[object Uint8ClampedArray]';
      var uint16Tag = '[object Uint16Array]';
      var uint32Tag = '[object Uint32Array]';

      /** Used to identify `toStringTag` values of typed arrays. */
      var typedArrayTags = {};
      typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
      typedArrayTags[argsTag$1] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag$1] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

      /**
       * The base implementation of `_.isTypedArray` without Node.js optimizations.
       *
       * @private
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
       */
      function baseIsTypedArray(value) {
        return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
      }

      /**
       * The base implementation of `_.unary` without support for storing metadata.
       *
       * @private
       * @param {Function} func The function to cap arguments for.
       * @returns {Function} Returns the new capped function.
       */
      function baseUnary(func) {
        return function (value) {
          return func(value);
        };
      }

      /** Detect free variable `exports`. */
      var freeExports$1 = (typeof exports === "undefined" ? "undefined" : _typeof(exports)) == 'object' && exports && !exports.nodeType && exports;

      /** Detect free variable `module`. */
      var freeModule$1 = freeExports$1 && 'object' == 'object' && module && !module.nodeType && module;

      /** Detect the popular CommonJS extension `module.exports`. */
      var moduleExports$1 = freeModule$1 && freeModule$1.exports === freeExports$1;

      /** Detect free variable `process` from Node.js. */
      var freeProcess = moduleExports$1 && freeGlobal.process;

      /** Used to access faster Node.js helpers. */
      var nodeUtil = function () {
        try {
          return freeProcess && freeProcess.binding('util');
        } catch (e) {}
      }();

      /* Node.js helper references. */
      var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

      /**
       * Checks if `value` is classified as a typed array.
       *
       * @static
       * @memberOf _
       * @since 3.0.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
       * @example
       *
       * _.isTypedArray(new Uint8Array);
       * // => true
       *
       * _.isTypedArray([]);
       * // => false
       */
      var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

      /** Used for built-in method references. */
      var objectProto$2 = Object.prototype;

      /** Used to check objects for own properties. */
      var hasOwnProperty$1 = objectProto$2.hasOwnProperty;

      /**
       * Creates an array of the enumerable property names of the array-like `value`.
       *
       * @private
       * @param {*} value The value to query.
       * @param {boolean} inherited Specify returning inherited property names.
       * @returns {Array} Returns the array of property names.
       */
      function arrayLikeKeys(value, inherited) {
        var isArr = isArray(value),
            isArg = !isArr && isArguments(value),
            isBuff = !isArr && !isArg && isBuffer(value),
            isType = !isArr && !isArg && !isBuff && isTypedArray(value),
            skipIndexes = isArr || isArg || isBuff || isType,
            result = skipIndexes ? baseTimes(value.length, String) : [],
            length = result.length;

        for (var key in value) {
          if ((inherited || hasOwnProperty$1.call(value, key)) && !(skipIndexes && (
          // Safari 9 has enumerable `arguments.length` in strict mode.
          key == 'length' ||
          // Node.js 0.10 has enumerable non-index properties on buffers.
          isBuff && (key == 'offset' || key == 'parent') ||
          // PhantomJS 2 has enumerable non-index properties on typed arrays.
          isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset') ||
          // Skip index properties.
          isIndex(key, length)))) {
            result.push(key);
          }
        }
        return result;
      }

      /** Used for built-in method references. */
      var objectProto$5 = Object.prototype;

      /**
       * Checks if `value` is likely a prototype object.
       *
       * @private
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
       */
      function isPrototype(value) {
        var Ctor = value && value.constructor,
            proto = typeof Ctor == 'function' && Ctor.prototype || objectProto$5;

        return value === proto;
      }

      /**
       * Creates a unary function that invokes `func` with its argument transformed.
       *
       * @private
       * @param {Function} func The function to wrap.
       * @param {Function} transform The argument transform.
       * @returns {Function} Returns the new function.
       */
      function overArg(func, transform) {
        return function (arg) {
          return func(transform(arg));
        };
      }

      /* Built-in method references for those with the same name as other `lodash` methods. */
      var nativeKeys = overArg(Object.keys, Object);

      /** Used for built-in method references. */
      var objectProto$4 = Object.prototype;

      /** Used to check objects for own properties. */
      var hasOwnProperty$3 = objectProto$4.hasOwnProperty;

      /**
       * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
       *
       * @private
       * @param {Object} object The object to query.
       * @returns {Array} Returns the array of property names.
       */
      function baseKeys(object) {
        if (!isPrototype(object)) {
          return nativeKeys(object);
        }
        var result = [];
        for (var key in Object(object)) {
          if (hasOwnProperty$3.call(object, key) && key != 'constructor') {
            result.push(key);
          }
        }
        return result;
      }

      /**
       * Creates an array of the own enumerable property names of `object`.
       *
       * **Note:** Non-object values are coerced to objects. See the
       * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
       * for more details.
       *
       * @static
       * @since 0.1.0
       * @memberOf _
       * @category Object
       * @param {Object} object The object to query.
       * @returns {Array} Returns the array of property names.
       * @example
       *
       * function Foo() {
       *   this.a = 1;
       *   this.b = 2;
       * }
       *
       * Foo.prototype.c = 3;
       *
       * _.keys(new Foo);
       * // => ['a', 'b'] (iteration order is not guaranteed)
       *
       * _.keys('hi');
       * // => ['0', '1']
       */
      function keys(object) {
        return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
      }

      function createArrayIterator(coll) {
        var i = -1;
        var len = coll.length;
        return function next() {
          return ++i < len ? { value: coll[i], key: i } : null;
        };
      }

      function createES2015Iterator(iterator) {
        var i = -1;
        return function next() {
          var item = iterator.next();
          if (item.done) return null;
          i++;
          return { value: item.value, key: i };
        };
      }

      function createObjectIterator(obj) {
        var okeys = keys(obj);
        var i = -1;
        var len = okeys.length;
        return function next() {
          var key = okeys[++i];
          return i < len ? { value: obj[key], key: key } : null;
        };
      }

      function iterator(coll) {
        if (isArrayLike(coll)) {
          return createArrayIterator(coll);
        }

        var iterator = getIterator(coll);
        return iterator ? createES2015Iterator(iterator) : createObjectIterator(coll);
      }

      function onlyOnce(fn) {
        return function () {
          if (fn === null) throw new Error("Callback was already called.");
          var callFn = fn;
          fn = null;
          callFn.apply(this, arguments);
        };
      }

      function _eachOfLimit(limit) {
        return function (obj, iteratee, callback) {
          callback = once$$1(callback || noop);
          if (limit <= 0 || !obj) {
            return callback(null);
          }
          var nextElem = iterator(obj);
          var done = false;
          var running = 0;

          function iterateeCallback(err, value) {
            running -= 1;
            if (err) {
              done = true;
              callback(err);
            } else if (value === breakLoop || done && running <= 0) {
              done = true;
              return callback(null);
            } else {
              replenish();
            }
          }

          function replenish() {
            while (running < limit && !done) {
              var elem = nextElem();
              if (elem === null) {
                done = true;
                if (running <= 0) {
                  callback(null);
                }
                return;
              }
              running += 1;
              iteratee(elem.value, elem.key, onlyOnce(iterateeCallback));
            }
          }

          replenish();
        };
      }

      /**
       * The same as [`eachOf`]{@link module:Collections.eachOf} but runs a maximum of `limit` async operations at a
       * time.
       *
       * @name eachOfLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.eachOf]{@link module:Collections.eachOf}
       * @alias forEachOfLimit
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - An async function to apply to each
       * item in `coll`. The `key` is the item's key, or index in the case of an
       * array.
       * Invoked with (item, key, callback).
       * @param {Function} [callback] - A callback which is called when all
       * `iteratee` functions have finished, or an error occurs. Invoked with (err).
       */
      function eachOfLimit(coll, limit, iteratee, callback) {
        _eachOfLimit(limit)(coll, wrapAsync(iteratee), callback);
      }

      function doLimit(fn, limit) {
        return function (iterable, iteratee, callback) {
          return fn(iterable, limit, iteratee, callback);
        };
      }

      // eachOf implementation optimized for array-likes
      function eachOfArrayLike(coll, iteratee, callback) {
        callback = once$$1(callback || noop);
        var index = 0,
            completed = 0,
            length = coll.length;
        if (length === 0) {
          callback(null);
        }

        function iteratorCallback(err, value) {
          if (err) {
            callback(err);
          } else if (++completed === length || value === breakLoop) {
            callback(null);
          }
        }

        for (; index < length; index++) {
          iteratee(coll[index], index, onlyOnce(iteratorCallback));
        }
      }

      // a generic version of eachOf which can handle array, object, and iterator cases.
      var eachOfGeneric = doLimit(eachOfLimit, Infinity);

      /**
       * Like [`each`]{@link module:Collections.each}, except that it passes the key (or index) as the second argument
       * to the iteratee.
       *
       * @name eachOf
       * @static
       * @memberOf module:Collections
       * @method
       * @alias forEachOf
       * @category Collection
       * @see [async.each]{@link module:Collections.each}
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - A function to apply to each
       * item in `coll`.
       * The `key` is the item's key, or index in the case of an array.
       * Invoked with (item, key, callback).
       * @param {Function} [callback] - A callback which is called when all
       * `iteratee` functions have finished, or an error occurs. Invoked with (err).
       * @example
       *
       * var obj = {dev: "/dev.json", test: "/test.json", prod: "/prod.json"};
       * var configs = {};
       *
       * async.forEachOf(obj, function (value, key, callback) {
       *     fs.readFile(__dirname + value, "utf8", function (err, data) {
       *         if (err) return callback(err);
       *         try {
       *             configs[key] = JSON.parse(data);
       *         } catch (e) {
       *             return callback(e);
       *         }
       *         callback();
       *     });
       * }, function (err) {
       *     if (err) console.error(err.message);
       *     // configs is now a map of JSON data
       *     doSomethingWith(configs);
       * });
       */
      var eachOf = function eachOf(coll, iteratee, callback) {
        var eachOfImplementation = isArrayLike(coll) ? eachOfArrayLike : eachOfGeneric;
        eachOfImplementation(coll, wrapAsync(iteratee), callback);
      };

      function doParallel(fn) {
        return function (obj, iteratee, callback) {
          return fn(eachOf, obj, wrapAsync(iteratee), callback);
        };
      }

      function _asyncMap(eachfn, arr, iteratee, callback) {
        callback = callback || noop;
        arr = arr || [];
        var results = [];
        var counter = 0;
        var _iteratee = wrapAsync(iteratee);

        eachfn(arr, function (value, _, callback) {
          var index = counter++;
          _iteratee(value, function (err, v) {
            results[index] = v;
            callback(err);
          });
        }, function (err) {
          callback(err, results);
        });
      }

      /**
       * Produces a new collection of values by mapping each value in `coll` through
       * the `iteratee` function. The `iteratee` is called with an item from `coll`
       * and a callback for when it has finished processing. Each of these callback
       * takes 2 arguments: an `error`, and the transformed item from `coll`. If
       * `iteratee` passes an error to its callback, the main `callback` (for the
       * `map` function) is immediately called with the error.
       *
       * Note, that since this function applies the `iteratee` to each item in
       * parallel, there is no guarantee that the `iteratee` functions will complete
       * in order. However, the results array will be in the same order as the
       * original `coll`.
       *
       * If `map` is passed an Object, the results will be an Array.  The results
       * will roughly be in the order of the original Objects' keys (but this can
       * vary across JavaScript engines).
       *
       * @name map
       * @static
       * @memberOf module:Collections
       * @method
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async function to apply to each item in
       * `coll`.
       * The iteratee should complete with the transformed item.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. Results is an Array of the
       * transformed items from the `coll`. Invoked with (err, results).
       * @example
       *
       * async.map(['file1','file2','file3'], fs.stat, function(err, results) {
       *     // results is now an array of stats for each file
       * });
       */
      var map = doParallel(_asyncMap);

      /**
       * Applies the provided arguments to each function in the array, calling
       * `callback` after all functions have completed. If you only provide the first
       * argument, `fns`, then it will return a function which lets you pass in the
       * arguments as if it were a single function call. If more arguments are
       * provided, `callback` is required while `args` is still optional.
       *
       * @name applyEach
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {Array|Iterable|Object} fns - A collection of {@link AsyncFunction}s
       * to all call with the same arguments
       * @param {...*} [args] - any number of separate arguments to pass to the
       * function.
       * @param {Function} [callback] - the final argument should be the callback,
       * called when all functions have completed processing.
       * @returns {Function} - If only the first argument, `fns`, is provided, it will
       * return a function which lets you pass in the arguments as if it were a single
       * function call. The signature is `(..args, callback)`. If invoked with any
       * arguments, `callback` is required.
       * @example
       *
       * async.applyEach([enableSearch, updateSchema], 'bucket', callback);
       *
       * // partial application example:
       * async.each(
       *     buckets,
       *     async.applyEach([enableSearch, updateSchema]),
       *     callback
       * );
       */
      var applyEach = applyEach$1(map);

      function doParallelLimit(fn) {
        return function (obj, limit, iteratee, callback) {
          return fn(_eachOfLimit(limit), obj, wrapAsync(iteratee), callback);
        };
      }

      /**
       * The same as [`map`]{@link module:Collections.map} but runs a maximum of `limit` async operations at a time.
       *
       * @name mapLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.map]{@link module:Collections.map}
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - An async function to apply to each item in
       * `coll`.
       * The iteratee should complete with the transformed item.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. Results is an array of the
       * transformed items from the `coll`. Invoked with (err, results).
       */
      var mapLimit = doParallelLimit(_asyncMap);

      /**
       * The same as [`map`]{@link module:Collections.map} but runs only a single async operation at a time.
       *
       * @name mapSeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.map]{@link module:Collections.map}
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async function to apply to each item in
       * `coll`.
       * The iteratee should complete with the transformed item.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. Results is an array of the
       * transformed items from the `coll`. Invoked with (err, results).
       */
      var mapSeries = doLimit(mapLimit, 1);

      /**
       * The same as [`applyEach`]{@link module:ControlFlow.applyEach} but runs only a single async operation at a time.
       *
       * @name applyEachSeries
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.applyEach]{@link module:ControlFlow.applyEach}
       * @category Control Flow
       * @param {Array|Iterable|Object} fns - A collection of {@link AsyncFunction}s to all
       * call with the same arguments
       * @param {...*} [args] - any number of separate arguments to pass to the
       * function.
       * @param {Function} [callback] - the final argument should be the callback,
       * called when all functions have completed processing.
       * @returns {Function} - If only the first argument is provided, it will return
       * a function which lets you pass in the arguments as if it were a single
       * function call.
       */
      var applyEachSeries = applyEach$1(mapSeries);

      /**
       * Creates a continuation function with some arguments already applied.
       *
       * Useful as a shorthand when combined with other control flow functions. Any
       * arguments passed to the returned function are added to the arguments
       * originally passed to apply.
       *
       * @name apply
       * @static
       * @memberOf module:Utils
       * @method
       * @category Util
       * @param {Function} fn - The function you want to eventually apply all
       * arguments to. Invokes with (arguments...).
       * @param {...*} arguments... - Any number of arguments to automatically apply
       * when the continuation is called.
       * @returns {Function} the partially-applied function
       * @example
       *
       * // using apply
       * async.parallel([
       *     async.apply(fs.writeFile, 'testfile1', 'test1'),
       *     async.apply(fs.writeFile, 'testfile2', 'test2')
       * ]);
       *
       *
       * // the same process without using apply
       * async.parallel([
       *     function(callback) {
       *         fs.writeFile('testfile1', 'test1', callback);
       *     },
       *     function(callback) {
       *         fs.writeFile('testfile2', 'test2', callback);
       *     }
       * ]);
       *
       * // It's possible to pass any number of additional arguments when calling the
       * // continuation:
       *
       * node> var fn = async.apply(sys.puts, 'one');
       * node> fn('two', 'three');
       * one
       * two
       * three
       */
      var apply = function apply(fn /*, ...args*/) {
        var args = slice(arguments, 1);
        return function () /*callArgs*/{
          var callArgs = slice(arguments);
          return fn.apply(null, args.concat(callArgs));
        };
      };

      /**
       * A specialized version of `_.forEach` for arrays without support for
       * iteratee shorthands.
       *
       * @private
       * @param {Array} [array] The array to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Array} Returns `array`.
       */
      function arrayEach(array, iteratee) {
        var index = -1,
            length = array == null ? 0 : array.length;

        while (++index < length) {
          if (iteratee(array[index], index, array) === false) {
            break;
          }
        }
        return array;
      }

      /**
       * Creates a base function for methods like `_.forIn` and `_.forOwn`.
       *
       * @private
       * @param {boolean} [fromRight] Specify iterating from right to left.
       * @returns {Function} Returns the new base function.
       */
      function createBaseFor(fromRight) {
        return function (object, iteratee, keysFunc) {
          var index = -1,
              iterable = Object(object),
              props = keysFunc(object),
              length = props.length;

          while (length--) {
            var key = props[fromRight ? length : ++index];
            if (iteratee(iterable[key], key, iterable) === false) {
              break;
            }
          }
          return object;
        };
      }

      /**
       * The base implementation of `baseForOwn` which iterates over `object`
       * properties returned by `keysFunc` and invokes `iteratee` for each property.
       * Iteratee functions may exit iteration early by explicitly returning `false`.
       *
       * @private
       * @param {Object} object The object to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @param {Function} keysFunc The function to get the keys of `object`.
       * @returns {Object} Returns `object`.
       */
      var baseFor = createBaseFor();

      /**
       * The base implementation of `_.forOwn` without support for iteratee shorthands.
       *
       * @private
       * @param {Object} object The object to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Object} Returns `object`.
       */
      function baseForOwn(object, iteratee) {
        return object && baseFor(object, iteratee, keys);
      }

      /**
       * The base implementation of `_.findIndex` and `_.findLastIndex` without
       * support for iteratee shorthands.
       *
       * @private
       * @param {Array} array The array to inspect.
       * @param {Function} predicate The function invoked per iteration.
       * @param {number} fromIndex The index to search from.
       * @param {boolean} [fromRight] Specify iterating from right to left.
       * @returns {number} Returns the index of the matched value, else `-1`.
       */
      function baseFindIndex(array, predicate, fromIndex, fromRight) {
        var length = array.length,
            index = fromIndex + (fromRight ? 1 : -1);

        while (fromRight ? index-- : ++index < length) {
          if (predicate(array[index], index, array)) {
            return index;
          }
        }
        return -1;
      }

      /**
       * The base implementation of `_.isNaN` without support for number objects.
       *
       * @private
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
       */
      function baseIsNaN(value) {
        return value !== value;
      }

      /**
       * A specialized version of `_.indexOf` which performs strict equality
       * comparisons of values, i.e. `===`.
       *
       * @private
       * @param {Array} array The array to inspect.
       * @param {*} value The value to search for.
       * @param {number} fromIndex The index to search from.
       * @returns {number} Returns the index of the matched value, else `-1`.
       */
      function strictIndexOf(array, value, fromIndex) {
        var index = fromIndex - 1,
            length = array.length;

        while (++index < length) {
          if (array[index] === value) {
            return index;
          }
        }
        return -1;
      }

      /**
       * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
       *
       * @private
       * @param {Array} array The array to inspect.
       * @param {*} value The value to search for.
       * @param {number} fromIndex The index to search from.
       * @returns {number} Returns the index of the matched value, else `-1`.
       */
      function baseIndexOf(array, value, fromIndex) {
        return value === value ? strictIndexOf(array, value, fromIndex) : baseFindIndex(array, baseIsNaN, fromIndex);
      }

      /**
       * Determines the best order for running the {@link AsyncFunction}s in `tasks`, based on
       * their requirements. Each function can optionally depend on other functions
       * being completed first, and each function is run as soon as its requirements
       * are satisfied.
       *
       * If any of the {@link AsyncFunction}s pass an error to their callback, the `auto` sequence
       * will stop. Further tasks will not execute (so any other functions depending
       * on it will not run), and the main `callback` is immediately called with the
       * error.
       *
       * {@link AsyncFunction}s also receive an object containing the results of functions which
       * have completed so far as the first argument, if they have dependencies. If a
       * task function has no dependencies, it will only be passed a callback.
       *
       * @name auto
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {Object} tasks - An object. Each of its properties is either a
       * function or an array of requirements, with the {@link AsyncFunction} itself the last item
       * in the array. The object's key of a property serves as the name of the task
       * defined by that property, i.e. can be used when specifying requirements for
       * other tasks. The function receives one or two arguments:
       * * a `results` object, containing the results of the previously executed
       *   functions, only passed if the task has any dependencies,
       * * a `callback(err, result)` function, which must be called when finished,
       *   passing an `error` (which can be `null`) and the result of the function's
       *   execution.
       * @param {number} [concurrency=Infinity] - An optional `integer` for
       * determining the maximum number of tasks that can be run in parallel. By
       * default, as many as possible.
       * @param {Function} [callback] - An optional callback which is called when all
       * the tasks have been completed. It receives the `err` argument if any `tasks`
       * pass an error to their callback. Results are always returned; however, if an
       * error occurs, no further `tasks` will be performed, and the results object
       * will only contain partial results. Invoked with (err, results).
       * @returns undefined
       * @example
       *
       * async.auto({
       *     // this function will just be passed a callback
       *     readData: async.apply(fs.readFile, 'data.txt', 'utf-8'),
       *     showData: ['readData', function(results, cb) {
       *         // results.readData is the file's contents
       *         // ...
       *     }]
       * }, callback);
       *
       * async.auto({
       *     get_data: function(callback) {
       *         console.log('in get_data');
       *         // async code to get some data
       *         callback(null, 'data', 'converted to array');
       *     },
       *     make_folder: function(callback) {
       *         console.log('in make_folder');
       *         // async code to create a directory to store a file in
       *         // this is run at the same time as getting the data
       *         callback(null, 'folder');
       *     },
       *     write_file: ['get_data', 'make_folder', function(results, callback) {
       *         console.log('in write_file', JSON.stringify(results));
       *         // once there is some data and the directory exists,
       *         // write the data to a file in the directory
       *         callback(null, 'filename');
       *     }],
       *     email_link: ['write_file', function(results, callback) {
       *         console.log('in email_link', JSON.stringify(results));
       *         // once the file is written let's email a link to it...
       *         // results.write_file contains the filename returned by write_file.
       *         callback(null, {'file':results.write_file, 'email':'user@example.com'});
       *     }]
       * }, function(err, results) {
       *     console.log('err = ', err);
       *     console.log('results = ', results);
       * });
       */
      var auto = function auto(tasks, concurrency, callback) {
        if (typeof concurrency === 'function') {
          // concurrency is optional, shift the args.
          callback = concurrency;
          concurrency = null;
        }
        callback = once$$1(callback || noop);
        var keys$$1 = keys(tasks);
        var numTasks = keys$$1.length;
        if (!numTasks) {
          return callback(null);
        }
        if (!concurrency) {
          concurrency = numTasks;
        }

        var results = {};
        var runningTasks = 0;
        var hasError = false;

        var listeners = Object.create(null);

        var readyTasks = [];

        // for cycle detection:
        var readyToCheck = []; // tasks that have been identified as reachable
        // without the possibility of returning to an ancestor task
        var uncheckedDependencies = {};

        baseForOwn(tasks, function (task, key) {
          if (!isArray(task)) {
            // no dependencies
            enqueueTask(key, [task]);
            readyToCheck.push(key);
            return;
          }

          var dependencies = task.slice(0, task.length - 1);
          var remainingDependencies = dependencies.length;
          if (remainingDependencies === 0) {
            enqueueTask(key, task);
            readyToCheck.push(key);
            return;
          }
          uncheckedDependencies[key] = remainingDependencies;

          arrayEach(dependencies, function (dependencyName) {
            if (!tasks[dependencyName]) {
              throw new Error('async.auto task `' + key + '` has a non-existent dependency `' + dependencyName + '` in ' + dependencies.join(', '));
            }
            addListener$$1(dependencyName, function () {
              remainingDependencies--;
              if (remainingDependencies === 0) {
                enqueueTask(key, task);
              }
            });
          });
        });

        checkForDeadlocks();
        processQueue();

        function enqueueTask(key, task) {
          readyTasks.push(function () {
            runTask(key, task);
          });
        }

        function processQueue() {
          if (readyTasks.length === 0 && runningTasks === 0) {
            return callback(null, results);
          }
          while (readyTasks.length && runningTasks < concurrency) {
            var run = readyTasks.shift();
            run();
          }
        }

        function addListener$$1(taskName, fn) {
          var taskListeners = listeners[taskName];
          if (!taskListeners) {
            taskListeners = listeners[taskName] = [];
          }

          taskListeners.push(fn);
        }

        function taskComplete(taskName) {
          var taskListeners = listeners[taskName] || [];
          arrayEach(taskListeners, function (fn) {
            fn();
          });
          processQueue();
        }

        function runTask(key, task) {
          if (hasError) return;

          var taskCallback = onlyOnce(function (err, result) {
            runningTasks--;
            if (arguments.length > 2) {
              result = slice(arguments, 1);
            }
            if (err) {
              var safeResults = {};
              baseForOwn(results, function (val, rkey) {
                safeResults[rkey] = val;
              });
              safeResults[key] = result;
              hasError = true;
              listeners = Object.create(null);

              callback(err, safeResults);
            } else {
              results[key] = result;
              taskComplete(key);
            }
          });

          runningTasks++;
          var taskFn = wrapAsync(task[task.length - 1]);
          if (task.length > 1) {
            taskFn(results, taskCallback);
          } else {
            taskFn(taskCallback);
          }
        }

        function checkForDeadlocks() {
          // Kahn's algorithm
          // https://en.wikipedia.org/wiki/Topological_sorting#Kahn.27s_algorithm
          // http://connalle.blogspot.com/2013/10/topological-sortingkahn-algorithm.html
          var currentTask;
          var counter = 0;
          while (readyToCheck.length) {
            currentTask = readyToCheck.pop();
            counter++;
            arrayEach(getDependents(currentTask), function (dependent) {
              if (--uncheckedDependencies[dependent] === 0) {
                readyToCheck.push(dependent);
              }
            });
          }

          if (counter !== numTasks) {
            throw new Error('async.auto cannot execute tasks due to a recursive dependency');
          }
        }

        function getDependents(taskName) {
          var result = [];
          baseForOwn(tasks, function (task, key) {
            if (isArray(task) && baseIndexOf(task, taskName, 0) >= 0) {
              result.push(key);
            }
          });
          return result;
        }
      };

      /**
       * A specialized version of `_.map` for arrays without support for iteratee
       * shorthands.
       *
       * @private
       * @param {Array} [array] The array to iterate over.
       * @param {Function} iteratee The function invoked per iteration.
       * @returns {Array} Returns the new mapped array.
       */
      function arrayMap(array, iteratee) {
        var index = -1,
            length = array == null ? 0 : array.length,
            result = Array(length);

        while (++index < length) {
          result[index] = iteratee(array[index], index, array);
        }
        return result;
      }

      /** `Object#toString` result references. */
      var symbolTag = '[object Symbol]';

      /**
       * Checks if `value` is classified as a `Symbol` primitive or object.
       *
       * @static
       * @memberOf _
       * @since 4.0.0
       * @category Lang
       * @param {*} value The value to check.
       * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
       * @example
       *
       * _.isSymbol(Symbol.iterator);
       * // => true
       *
       * _.isSymbol('abc');
       * // => false
       */
      function isSymbol(value) {
        return (typeof value === "undefined" ? "undefined" : _typeof(value)) == 'symbol' || isObjectLike(value) && baseGetTag(value) == symbolTag;
      }

      /** Used as references for various `Number` constants. */
      var INFINITY = 1 / 0;

      /** Used to convert symbols to primitives and strings. */
      var symbolProto = Symbol$1 ? Symbol$1.prototype : undefined;
      var symbolToString = symbolProto ? symbolProto.toString : undefined;

      /**
       * The base implementation of `_.toString` which doesn't convert nullish
       * values to empty strings.
       *
       * @private
       * @param {*} value The value to process.
       * @returns {string} Returns the string.
       */
      function baseToString(value) {
        // Exit early for strings to avoid a performance hit in some environments.
        if (typeof value == 'string') {
          return value;
        }
        if (isArray(value)) {
          // Recursively convert values (susceptible to call stack limits).
          return arrayMap(value, baseToString) + '';
        }
        if (isSymbol(value)) {
          return symbolToString ? symbolToString.call(value) : '';
        }
        var result = value + '';
        return result == '0' && 1 / value == -INFINITY ? '-0' : result;
      }

      /**
       * The base implementation of `_.slice` without an iteratee call guard.
       *
       * @private
       * @param {Array} array The array to slice.
       * @param {number} [start=0] The start position.
       * @param {number} [end=array.length] The end position.
       * @returns {Array} Returns the slice of `array`.
       */
      function baseSlice(array, start, end) {
        var index = -1,
            length = array.length;

        if (start < 0) {
          start = -start > length ? 0 : length + start;
        }
        end = end > length ? length : end;
        if (end < 0) {
          end += length;
        }
        length = start > end ? 0 : end - start >>> 0;
        start >>>= 0;

        var result = Array(length);
        while (++index < length) {
          result[index] = array[index + start];
        }
        return result;
      }

      /**
       * Casts `array` to a slice if it's needed.
       *
       * @private
       * @param {Array} array The array to inspect.
       * @param {number} start The start position.
       * @param {number} [end=array.length] The end position.
       * @returns {Array} Returns the cast slice.
       */
      function castSlice(array, start, end) {
        var length = array.length;
        end = end === undefined ? length : end;
        return !start && end >= length ? array : baseSlice(array, start, end);
      }

      /**
       * Used by `_.trim` and `_.trimEnd` to get the index of the last string symbol
       * that is not found in the character symbols.
       *
       * @private
       * @param {Array} strSymbols The string symbols to inspect.
       * @param {Array} chrSymbols The character symbols to find.
       * @returns {number} Returns the index of the last unmatched string symbol.
       */
      function charsEndIndex(strSymbols, chrSymbols) {
        var index = strSymbols.length;

        while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
        return index;
      }

      /**
       * Used by `_.trim` and `_.trimStart` to get the index of the first string symbol
       * that is not found in the character symbols.
       *
       * @private
       * @param {Array} strSymbols The string symbols to inspect.
       * @param {Array} chrSymbols The character symbols to find.
       * @returns {number} Returns the index of the first unmatched string symbol.
       */
      function charsStartIndex(strSymbols, chrSymbols) {
        var index = -1,
            length = strSymbols.length;

        while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
        return index;
      }

      /**
       * Converts an ASCII `string` to an array.
       *
       * @private
       * @param {string} string The string to convert.
       * @returns {Array} Returns the converted array.
       */
      function asciiToArray(string) {
        return string.split('');
      }

      /** Used to compose unicode character classes. */
      var rsAstralRange = "\\ud800-\\udfff";
      var rsComboMarksRange = "\\u0300-\\u036f\\ufe20-\\ufe23";
      var rsComboSymbolsRange = "\\u20d0-\\u20f0";
      var rsVarRange = "\\ufe0e\\ufe0f";

      /** Used to compose unicode capture groups. */
      var rsZWJ = "\\u200d";

      /** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */
      var reHasUnicode = RegExp('[' + rsZWJ + rsAstralRange + rsComboMarksRange + rsComboSymbolsRange + rsVarRange + ']');

      /**
       * Checks if `string` contains Unicode symbols.
       *
       * @private
       * @param {string} string The string to inspect.
       * @returns {boolean} Returns `true` if a symbol is found, else `false`.
       */
      function hasUnicode(string) {
        return reHasUnicode.test(string);
      }

      /** Used to compose unicode character classes. */
      var rsAstralRange$1 = "\\ud800-\\udfff";
      var rsComboMarksRange$1 = "\\u0300-\\u036f\\ufe20-\\ufe23";
      var rsComboSymbolsRange$1 = "\\u20d0-\\u20f0";
      var rsVarRange$1 = "\\ufe0e\\ufe0f";

      /** Used to compose unicode capture groups. */
      var rsAstral = '[' + rsAstralRange$1 + ']';
      var rsCombo = '[' + rsComboMarksRange$1 + rsComboSymbolsRange$1 + ']';
      var rsFitz = "\\ud83c[\\udffb-\\udfff]";
      var rsModifier = '(?:' + rsCombo + '|' + rsFitz + ')';
      var rsNonAstral = '[^' + rsAstralRange$1 + ']';
      var rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}";
      var rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]";
      var rsZWJ$1 = "\\u200d";

      /** Used to compose unicode regexes. */
      var reOptMod = rsModifier + '?';
      var rsOptVar = '[' + rsVarRange$1 + ']?';
      var rsOptJoin = '(?:' + rsZWJ$1 + '(?:' + [rsNonAstral, rsRegional, rsSurrPair].join('|') + ')' + rsOptVar + reOptMod + ')*';
      var rsSeq = rsOptVar + reOptMod + rsOptJoin;
      var rsSymbol = '(?:' + [rsNonAstral + rsCombo + '?', rsCombo, rsRegional, rsSurrPair, rsAstral].join('|') + ')';

      /** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
      var reUnicode = RegExp(rsFitz + '(?=' + rsFitz + ')|' + rsSymbol + rsSeq, 'g');

      /**
       * Converts a Unicode `string` to an array.
       *
       * @private
       * @param {string} string The string to convert.
       * @returns {Array} Returns the converted array.
       */
      function unicodeToArray(string) {
        return string.match(reUnicode) || [];
      }

      /**
       * Converts `string` to an array.
       *
       * @private
       * @param {string} string The string to convert.
       * @returns {Array} Returns the converted array.
       */
      function stringToArray(string) {
        return hasUnicode(string) ? unicodeToArray(string) : asciiToArray(string);
      }

      /**
       * Converts `value` to a string. An empty string is returned for `null`
       * and `undefined` values. The sign of `-0` is preserved.
       *
       * @static
       * @memberOf _
       * @since 4.0.0
       * @category Lang
       * @param {*} value The value to convert.
       * @returns {string} Returns the converted string.
       * @example
       *
       * _.toString(null);
       * // => ''
       *
       * _.toString(-0);
       * // => '-0'
       *
       * _.toString([1, 2, 3]);
       * // => '1,2,3'
       */
      function toString(value) {
        return value == null ? '' : baseToString(value);
      }

      /** Used to match leading and trailing whitespace. */
      var reTrim = /^\s+|\s+$/g;

      /**
       * Removes leading and trailing whitespace or specified characters from `string`.
       *
       * @static
       * @memberOf _
       * @since 3.0.0
       * @category String
       * @param {string} [string=''] The string to trim.
       * @param {string} [chars=whitespace] The characters to trim.
       * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
       * @returns {string} Returns the trimmed string.
       * @example
       *
       * _.trim('  abc  ');
       * // => 'abc'
       *
       * _.trim('-_-abc-_-', '_-');
       * // => 'abc'
       *
       * _.map(['  foo  ', '  bar  '], _.trim);
       * // => ['foo', 'bar']
       */
      function trim(string, chars, guard) {
        string = toString(string);
        if (string && (guard || chars === undefined)) {
          return string.replace(reTrim, '');
        }
        if (!string || !(chars = baseToString(chars))) {
          return string;
        }
        var strSymbols = stringToArray(string),
            chrSymbols = stringToArray(chars),
            start = charsStartIndex(strSymbols, chrSymbols),
            end = charsEndIndex(strSymbols, chrSymbols) + 1;

        return castSlice(strSymbols, start, end).join('');
      }

      var FN_ARGS = /^(?:async\s+)?(function)?\s*[^\(]*\(\s*([^\)]*)\)/m;
      var FN_ARG_SPLIT = /,/;
      var FN_ARG = /(=.+)?(\s*)$/;
      var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

      function parseParams(func) {
        func = func.toString().replace(STRIP_COMMENTS, '');
        func = func.match(FN_ARGS)[2].replace(' ', '');
        func = func ? func.split(FN_ARG_SPLIT) : [];
        func = func.map(function (arg) {
          return trim(arg.replace(FN_ARG, ''));
        });
        return func;
      }

      /**
       * A dependency-injected version of the [async.auto]{@link module:ControlFlow.auto} function. Dependent
       * tasks are specified as parameters to the function, after the usual callback
       * parameter, with the parameter names matching the names of the tasks it
       * depends on. This can provide even more readable task graphs which can be
       * easier to maintain.
       *
       * If a final callback is specified, the task results are similarly injected,
       * specified as named parameters after the initial error parameter.
       *
       * The autoInject function is purely syntactic sugar and its semantics are
       * otherwise equivalent to [async.auto]{@link module:ControlFlow.auto}.
       *
       * @name autoInject
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.auto]{@link module:ControlFlow.auto}
       * @category Control Flow
       * @param {Object} tasks - An object, each of whose properties is an {@link AsyncFunction} of
       * the form 'func([dependencies...], callback). The object's key of a property
       * serves as the name of the task defined by that property, i.e. can be used
       * when specifying requirements for other tasks.
       * * The `callback` parameter is a `callback(err, result)` which must be called
       *   when finished, passing an `error` (which can be `null`) and the result of
       *   the function's execution. The remaining parameters name other tasks on
       *   which the task is dependent, and the results from those tasks are the
       *   arguments of those parameters.
       * @param {Function} [callback] - An optional callback which is called when all
       * the tasks have been completed. It receives the `err` argument if any `tasks`
       * pass an error to their callback, and a `results` object with any completed
       * task results, similar to `auto`.
       * @example
       *
       * //  The example from `auto` can be rewritten as follows:
       * async.autoInject({
       *     get_data: function(callback) {
       *         // async code to get some data
       *         callback(null, 'data', 'converted to array');
       *     },
       *     make_folder: function(callback) {
       *         // async code to create a directory to store a file in
       *         // this is run at the same time as getting the data
       *         callback(null, 'folder');
       *     },
       *     write_file: function(get_data, make_folder, callback) {
       *         // once there is some data and the directory exists,
       *         // write the data to a file in the directory
       *         callback(null, 'filename');
       *     },
       *     email_link: function(write_file, callback) {
       *         // once the file is written let's email a link to it...
       *         // write_file contains the filename returned by write_file.
       *         callback(null, {'file':write_file, 'email':'user@example.com'});
       *     }
       * }, function(err, results) {
       *     console.log('err = ', err);
       *     console.log('email_link = ', results.email_link);
       * });
       *
       * // If you are using a JS minifier that mangles parameter names, `autoInject`
       * // will not work with plain functions, since the parameter names will be
       * // collapsed to a single letter identifier.  To work around this, you can
       * // explicitly specify the names of the parameters your task function needs
       * // in an array, similar to Angular.js dependency injection.
       *
       * // This still has an advantage over plain `auto`, since the results a task
       * // depends on are still spread into arguments.
       * async.autoInject({
       *     //...
       *     write_file: ['get_data', 'make_folder', function(get_data, make_folder, callback) {
       *         callback(null, 'filename');
       *     }],
       *     email_link: ['write_file', function(write_file, callback) {
       *         callback(null, {'file':write_file, 'email':'user@example.com'});
       *     }]
       *     //...
       * }, function(err, results) {
       *     console.log('err = ', err);
       *     console.log('email_link = ', results.email_link);
       * });
       */
      function autoInject(tasks, callback) {
        var newTasks = {};

        baseForOwn(tasks, function (taskFn, key) {
          var params;
          var fnIsAsync = isAsync(taskFn);
          var hasNoDeps = !fnIsAsync && taskFn.length === 1 || fnIsAsync && taskFn.length === 0;

          if (isArray(taskFn)) {
            params = taskFn.slice(0, -1);
            taskFn = taskFn[taskFn.length - 1];

            newTasks[key] = params.concat(params.length > 0 ? newTask : taskFn);
          } else if (hasNoDeps) {
            // no dependencies, use the function as-is
            newTasks[key] = taskFn;
          } else {
            params = parseParams(taskFn);
            if (taskFn.length === 0 && !fnIsAsync && params.length === 0) {
              throw new Error("autoInject task functions require explicit parameters.");
            }

            // remove callback param
            if (!fnIsAsync) params.pop();

            newTasks[key] = params.concat(newTask);
          }

          function newTask(results, taskCb) {
            var newArgs = arrayMap(params, function (name) {
              return results[name];
            });
            newArgs.push(taskCb);
            wrapAsync(taskFn).apply(null, newArgs);
          }
        });

        auto(newTasks, callback);
      }

      // Simple doubly linked list (https://en.wikipedia.org/wiki/Doubly_linked_list) implementation
      // used for queues. This implementation assumes that the node provided by the user can be modified
      // to adjust the next and last properties. We implement only the minimal functionality
      // for queue support.
      function DLL() {
        this.head = this.tail = null;
        this.length = 0;
      }

      function setInitial(dll, node) {
        dll.length = 1;
        dll.head = dll.tail = node;
      }

      DLL.prototype.removeLink = function (node) {
        if (node.prev) node.prev.next = node.next;else this.head = node.next;
        if (node.next) node.next.prev = node.prev;else this.tail = node.prev;

        node.prev = node.next = null;
        this.length -= 1;
        return node;
      };

      DLL.prototype.empty = function () {
        while (this.head) {
          this.shift();
        }return this;
      };

      DLL.prototype.insertAfter = function (node, newNode) {
        newNode.prev = node;
        newNode.next = node.next;
        if (node.next) node.next.prev = newNode;else this.tail = newNode;
        node.next = newNode;
        this.length += 1;
      };

      DLL.prototype.insertBefore = function (node, newNode) {
        newNode.prev = node.prev;
        newNode.next = node;
        if (node.prev) node.prev.next = newNode;else this.head = newNode;
        node.prev = newNode;
        this.length += 1;
      };

      DLL.prototype.unshift = function (node) {
        if (this.head) this.insertBefore(this.head, node);else setInitial(this, node);
      };

      DLL.prototype.push = function (node) {
        if (this.tail) this.insertAfter(this.tail, node);else setInitial(this, node);
      };

      DLL.prototype.shift = function () {
        return this.head && this.removeLink(this.head);
      };

      DLL.prototype.pop = function () {
        return this.tail && this.removeLink(this.tail);
      };

      DLL.prototype.toArray = function () {
        var arr = Array(this.length);
        var curr = this.head;
        for (var idx = 0; idx < this.length; idx++) {
          arr[idx] = curr.data;
          curr = curr.next;
        }
        return arr;
      };

      DLL.prototype.remove = function (testFn) {
        var curr = this.head;
        while (!!curr) {
          var next = curr.next;
          if (testFn(curr)) {
            this.removeLink(curr);
          }
          curr = next;
        }
        return this;
      };

      function queue(worker, concurrency, payload) {
        if (concurrency == null) {
          concurrency = 1;
        } else if (concurrency === 0) {
          throw new Error('Concurrency must not be zero');
        }

        var _worker = wrapAsync(worker);
        var numRunning = 0;
        var _workersList = [];

        function _insert(data, insertAtFront, callback) {
          if (callback != null && typeof callback !== 'function') {
            throw new Error('task callback must be a function');
          }
          q.started = true;
          if (!isArray(data)) {
            data = [data];
          }
          if (data.length === 0 && q.idle()) {
            // call drain immediately if there are no tasks
            return setImmediate$1(function () {
              q.drain();
            });
          }

          for (var i = 0, l = data.length; i < l; i++) {
            var item = {
              data: data[i],
              callback: callback || noop
            };

            if (insertAtFront) {
              q._tasks.unshift(item);
            } else {
              q._tasks.push(item);
            }
          }
          setImmediate$1(q.process);
        }

        function _next(tasks) {
          return function (err) {
            numRunning -= 1;

            for (var i = 0, l = tasks.length; i < l; i++) {
              var task = tasks[i];

              var index = baseIndexOf(_workersList, task, 0);
              if (index >= 0) {
                _workersList.splice(index, 1);
              }

              task.callback.apply(task, arguments);

              if (err != null) {
                q.error(err, task.data);
              }
            }

            if (numRunning <= q.concurrency - q.buffer) {
              q.unsaturated();
            }

            if (q.idle()) {
              q.drain();
            }
            q.process();
          };
        }

        var isProcessing = false;
        var q = {
          _tasks: new DLL(),
          concurrency: concurrency,
          payload: payload,
          saturated: noop,
          unsaturated: noop,
          buffer: concurrency / 4,
          empty: noop,
          drain: noop,
          error: noop,
          started: false,
          paused: false,
          push: function push(data, callback) {
            _insert(data, false, callback);
          },
          kill: function kill() {
            q.drain = noop;
            q._tasks.empty();
          },
          unshift: function unshift(data, callback) {
            _insert(data, true, callback);
          },
          remove: function remove(testFn) {
            q._tasks.remove(testFn);
          },
          process: function process() {
            // Avoid trying to start too many processing operations. This can occur
            // when callbacks resolve synchronously (#1267).
            if (isProcessing) {
              return;
            }
            isProcessing = true;
            while (!q.paused && numRunning < q.concurrency && q._tasks.length) {
              var tasks = [],
                  data = [];
              var l = q._tasks.length;
              if (q.payload) l = Math.min(l, q.payload);
              for (var i = 0; i < l; i++) {
                var node = q._tasks.shift();
                tasks.push(node);
                _workersList.push(node);
                data.push(node.data);
              }

              numRunning += 1;

              if (q._tasks.length === 0) {
                q.empty();
              }

              if (numRunning === q.concurrency) {
                q.saturated();
              }

              var cb = onlyOnce(_next(tasks));
              _worker(data, cb);
            }
            isProcessing = false;
          },
          length: function length() {
            return q._tasks.length;
          },
          running: function running() {
            return numRunning;
          },
          workersList: function workersList() {
            return _workersList;
          },
          idle: function idle() {
            return q._tasks.length + numRunning === 0;
          },
          pause: function pause() {
            q.paused = true;
          },
          resume: function resume() {
            if (q.paused === false) {
              return;
            }
            q.paused = false;
            setImmediate$1(q.process);
          }
        };
        return q;
      }

      /**
       * A cargo of tasks for the worker function to complete. Cargo inherits all of
       * the same methods and event callbacks as [`queue`]{@link module:ControlFlow.queue}.
       * @typedef {Object} CargoObject
       * @memberOf module:ControlFlow
       * @property {Function} length - A function returning the number of items
       * waiting to be processed. Invoke like `cargo.length()`.
       * @property {number} payload - An `integer` for determining how many tasks
       * should be process per round. This property can be changed after a `cargo` is
       * created to alter the payload on-the-fly.
       * @property {Function} push - Adds `task` to the `queue`. The callback is
       * called once the `worker` has finished processing the task. Instead of a
       * single task, an array of `tasks` can be submitted. The respective callback is
       * used for every task in the list. Invoke like `cargo.push(task, [callback])`.
       * @property {Function} saturated - A callback that is called when the
       * `queue.length()` hits the concurrency and further tasks will be queued.
       * @property {Function} empty - A callback that is called when the last item
       * from the `queue` is given to a `worker`.
       * @property {Function} drain - A callback that is called when the last item
       * from the `queue` has returned from the `worker`.
       * @property {Function} idle - a function returning false if there are items
       * waiting or being processed, or true if not. Invoke like `cargo.idle()`.
       * @property {Function} pause - a function that pauses the processing of tasks
       * until `resume()` is called. Invoke like `cargo.pause()`.
       * @property {Function} resume - a function that resumes the processing of
       * queued tasks when the queue is paused. Invoke like `cargo.resume()`.
       * @property {Function} kill - a function that removes the `drain` callback and
       * empties remaining tasks from the queue forcing it to go idle. Invoke like `cargo.kill()`.
       */

      /**
       * Creates a `cargo` object with the specified payload. Tasks added to the
       * cargo will be processed altogether (up to the `payload` limit). If the
       * `worker` is in progress, the task is queued until it becomes available. Once
       * the `worker` has completed some tasks, each callback of those tasks is
       * called. Check out [these](https://camo.githubusercontent.com/6bbd36f4cf5b35a0f11a96dcd2e97711ffc2fb37/68747470733a2f2f662e636c6f75642e6769746875622e636f6d2f6173736574732f313637363837312f36383130382f62626330636662302d356632392d313165322d393734662d3333393763363464633835382e676966) [animations](https://camo.githubusercontent.com/f4810e00e1c5f5f8addbe3e9f49064fd5d102699/68747470733a2f2f662e636c6f75642e6769746875622e636f6d2f6173736574732f313637363837312f36383130312f38346339323036362d356632392d313165322d383134662d3964336430323431336266642e676966)
       * for how `cargo` and `queue` work.
       *
       * While [`queue`]{@link module:ControlFlow.queue} passes only one task to one of a group of workers
       * at a time, cargo passes an array of tasks to a single worker, repeating
       * when the worker is finished.
       *
       * @name cargo
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.queue]{@link module:ControlFlow.queue}
       * @category Control Flow
       * @param {AsyncFunction} worker - An asynchronous function for processing an array
       * of queued tasks. Invoked with `(tasks, callback)`.
       * @param {number} [payload=Infinity] - An optional `integer` for determining
       * how many tasks should be processed per round; if omitted, the default is
       * unlimited.
       * @returns {module:ControlFlow.CargoObject} A cargo object to manage the tasks. Callbacks can
       * attached as certain properties to listen for specific events during the
       * lifecycle of the cargo and inner queue.
       * @example
       *
       * // create a cargo object with payload 2
       * var cargo = async.cargo(function(tasks, callback) {
       *     for (var i=0; i<tasks.length; i++) {
       *         console.log('hello ' + tasks[i].name);
       *     }
       *     callback();
       * }, 2);
       *
       * // add some items
       * cargo.push({name: 'foo'}, function(err) {
       *     console.log('finished processing foo');
       * });
       * cargo.push({name: 'bar'}, function(err) {
       *     console.log('finished processing bar');
       * });
       * cargo.push({name: 'baz'}, function(err) {
       *     console.log('finished processing baz');
       * });
       */
      function cargo(worker, payload) {
        return queue(worker, 1, payload);
      }

      /**
       * The same as [`eachOf`]{@link module:Collections.eachOf} but runs only a single async operation at a time.
       *
       * @name eachOfSeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.eachOf]{@link module:Collections.eachOf}
       * @alias forEachOfSeries
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async function to apply to each item in
       * `coll`.
       * Invoked with (item, key, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. Invoked with (err).
       */
      var eachOfSeries = doLimit(eachOfLimit, 1);

      /**
       * Reduces `coll` into a single value using an async `iteratee` to return each
       * successive step. `memo` is the initial state of the reduction. This function
       * only operates in series.
       *
       * For performance reasons, it may make sense to split a call to this function
       * into a parallel map, and then use the normal `Array.prototype.reduce` on the
       * results. This function is for situations where each step in the reduction
       * needs to be async; if you can get the data before reducing it, then it's
       * probably a good idea to do so.
       *
       * @name reduce
       * @static
       * @memberOf module:Collections
       * @method
       * @alias inject
       * @alias foldl
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {*} memo - The initial state of the reduction.
       * @param {AsyncFunction} iteratee - A function applied to each item in the
       * array to produce the next step in the reduction.
       * The `iteratee` should complete with the next state of the reduction.
       * If the iteratee complete with an error, the reduction is stopped and the
       * main `callback` is immediately called with the error.
       * Invoked with (memo, item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Result is the reduced value. Invoked with
       * (err, result).
       * @example
       *
       * async.reduce([1,2,3], 0, function(memo, item, callback) {
       *     // pointless async:
       *     process.nextTick(function() {
       *         callback(null, memo + item)
       *     });
       * }, function(err, result) {
       *     // result is now equal to the last value of memo, which is 6
       * });
       */
      function reduce(coll, memo, iteratee, callback) {
        callback = once$$1(callback || noop);
        var _iteratee = wrapAsync(iteratee);
        eachOfSeries(coll, function (x, i, callback) {
          _iteratee(memo, x, function (err, v) {
            memo = v;
            callback(err);
          });
        }, function (err) {
          callback(err, memo);
        });
      }

      /**
       * Version of the compose function that is more natural to read. Each function
       * consumes the return value of the previous function. It is the equivalent of
       * [compose]{@link module:ControlFlow.compose} with the arguments reversed.
       *
       * Each function is executed with the `this` binding of the composed function.
       *
       * @name seq
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.compose]{@link module:ControlFlow.compose}
       * @category Control Flow
       * @param {...AsyncFunction} functions - the asynchronous functions to compose
       * @returns {Function} a function that composes the `functions` in order
       * @example
       *
       * // Requires lodash (or underscore), express3 and dresende's orm2.
       * // Part of an app, that fetches cats of the logged user.
       * // This example uses `seq` function to avoid overnesting and error
       * // handling clutter.
       * app.get('/cats', function(request, response) {
       *     var User = request.models.User;
       *     async.seq(
       *         _.bind(User.get, User),  // 'User.get' has signature (id, callback(err, data))
       *         function(user, fn) {
       *             user.getCats(fn);      // 'getCats' has signature (callback(err, data))
       *         }
       *     )(req.session.user_id, function (err, cats) {
       *         if (err) {
       *             console.error(err);
       *             response.json({ status: 'error', message: err.message });
       *         } else {
       *             response.json({ status: 'ok', message: 'Cats found', data: cats });
       *         }
       *     });
       * });
       */
      function seq() /*...functions*/{
        var _functions = arrayMap(arguments, wrapAsync);
        return function () /*...args*/{
          var args = slice(arguments);
          var that = this;

          var cb = args[args.length - 1];
          if (typeof cb == 'function') {
            args.pop();
          } else {
            cb = noop;
          }

          reduce(_functions, args, function (newargs, fn, cb) {
            fn.apply(that, newargs.concat(function (err /*, ...nextargs*/) {
              var nextargs = slice(arguments, 1);
              cb(err, nextargs);
            }));
          }, function (err, results) {
            cb.apply(that, [err].concat(results));
          });
        };
      }

      /**
       * Creates a function which is a composition of the passed asynchronous
       * functions. Each function consumes the return value of the function that
       * follows. Composing functions `f()`, `g()`, and `h()` would produce the result
       * of `f(g(h()))`, only this version uses callbacks to obtain the return values.
       *
       * Each function is executed with the `this` binding of the composed function.
       *
       * @name compose
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {...AsyncFunction} functions - the asynchronous functions to compose
       * @returns {Function} an asynchronous function that is the composed
       * asynchronous `functions`
       * @example
       *
       * function add1(n, callback) {
       *     setTimeout(function () {
       *         callback(null, n + 1);
       *     }, 10);
       * }
       *
       * function mul3(n, callback) {
       *     setTimeout(function () {
       *         callback(null, n * 3);
       *     }, 10);
       * }
       *
       * var add1mul3 = async.compose(mul3, add1);
       * add1mul3(4, function (err, result) {
       *     // result now equals 15
       * });
       */
      var compose = function compose() /*...args*/{
        return seq.apply(null, slice(arguments).reverse());
      };

      var _concat = Array.prototype.concat;

      /**
       * The same as [`concat`]{@link module:Collections.concat} but runs a maximum of `limit` async operations at a time.
       *
       * @name concatLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.concat]{@link module:Collections.concat}
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - A function to apply to each item in `coll`,
       * which should use an array as its result. Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished, or an error occurs. Results is an array
       * containing the concatenated results of the `iteratee` function. Invoked with
       * (err, results).
       */
      var concatLimit = function concatLimit(coll, limit, iteratee, callback) {
        callback = callback || noop;
        var _iteratee = wrapAsync(iteratee);
        mapLimit(coll, limit, function (val, callback) {
          _iteratee(val, function (err /*, ...args*/) {
            if (err) return callback(err);
            return callback(null, slice(arguments, 1));
          });
        }, function (err, mapResults) {
          var result = [];
          for (var i = 0; i < mapResults.length; i++) {
            if (mapResults[i]) {
              result = _concat.apply(result, mapResults[i]);
            }
          }

          return callback(err, result);
        });
      };

      /**
       * Applies `iteratee` to each item in `coll`, concatenating the results. Returns
       * the concatenated list. The `iteratee`s are called in parallel, and the
       * results are concatenated as they return. There is no guarantee that the
       * results array will be returned in the original order of `coll` passed to the
       * `iteratee` function.
       *
       * @name concat
       * @static
       * @memberOf module:Collections
       * @method
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - A function to apply to each item in `coll`,
       * which should use an array as its result. Invoked with (item, callback).
       * @param {Function} [callback(err)] - A callback which is called after all the
       * `iteratee` functions have finished, or an error occurs. Results is an array
       * containing the concatenated results of the `iteratee` function. Invoked with
       * (err, results).
       * @example
       *
       * async.concat(['dir1','dir2','dir3'], fs.readdir, function(err, files) {
       *     // files is now a list of filenames that exist in the 3 directories
       * });
       */
      var concat = doLimit(concatLimit, Infinity);

      /**
       * The same as [`concat`]{@link module:Collections.concat} but runs only a single async operation at a time.
       *
       * @name concatSeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.concat]{@link module:Collections.concat}
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - A function to apply to each item in `coll`.
       * The iteratee should complete with an array an array of results.
       * Invoked with (item, callback).
       * @param {Function} [callback(err)] - A callback which is called after all the
       * `iteratee` functions have finished, or an error occurs. Results is an array
       * containing the concatenated results of the `iteratee` function. Invoked with
       * (err, results).
       */
      var concatSeries = doLimit(concatLimit, 1);

      /**
       * Returns a function that when called, calls-back with the values provided.
       * Useful as the first function in a [`waterfall`]{@link module:ControlFlow.waterfall}, or for plugging values in to
       * [`auto`]{@link module:ControlFlow.auto}.
       *
       * @name constant
       * @static
       * @memberOf module:Utils
       * @method
       * @category Util
       * @param {...*} arguments... - Any number of arguments to automatically invoke
       * callback with.
       * @returns {AsyncFunction} Returns a function that when invoked, automatically
       * invokes the callback with the previous given arguments.
       * @example
       *
       * async.waterfall([
       *     async.constant(42),
       *     function (value, next) {
       *         // value === 42
       *     },
       *     //...
       * ], callback);
       *
       * async.waterfall([
       *     async.constant(filename, "utf8"),
       *     fs.readFile,
       *     function (fileData, next) {
       *         //...
       *     }
       *     //...
       * ], callback);
       *
       * async.auto({
       *     hostname: async.constant("https://server.net/"),
       *     port: findFreePort,
       *     launchServer: ["hostname", "port", function (options, cb) {
       *         startServer(options, cb);
       *     }],
       *     //...
       * }, callback);
       */
      var constant = function constant() /*...values*/{
        var values = slice(arguments);
        var args = [null].concat(values);
        return function () /*...ignoredArgs, callback*/{
          var callback = arguments[arguments.length - 1];
          return callback.apply(this, args);
        };
      };

      /**
       * This method returns the first argument it receives.
       *
       * @static
       * @since 0.1.0
       * @memberOf _
       * @category Util
       * @param {*} value Any value.
       * @returns {*} Returns `value`.
       * @example
       *
       * var object = { 'a': 1 };
       *
       * console.log(_.identity(object) === object);
       * // => true
       */
      function identity(value) {
        return value;
      }

      function _createTester(check, getResult) {
        return function (eachfn, arr, iteratee, cb) {
          cb = cb || noop;
          var testPassed = false;
          var testResult;
          eachfn(arr, function (value, _, callback) {
            iteratee(value, function (err, result) {
              if (err) {
                callback(err);
              } else if (check(result) && !testResult) {
                testPassed = true;
                testResult = getResult(true, value);
                callback(null, breakLoop);
              } else {
                callback();
              }
            });
          }, function (err) {
            if (err) {
              cb(err);
            } else {
              cb(null, testPassed ? testResult : getResult(false));
            }
          });
        };
      }

      function _findGetResult(v, x) {
        return x;
      }

      /**
       * Returns the first value in `coll` that passes an async truth test. The
       * `iteratee` is applied in parallel, meaning the first iteratee to return
       * `true` will fire the detect `callback` with that result. That means the
       * result might not be the first item in the original `coll` (in terms of order)
       * that passes the test.
      
       * If order within the original `coll` is important, then look at
       * [`detectSeries`]{@link module:Collections.detectSeries}.
       *
       * @name detect
       * @static
       * @memberOf module:Collections
       * @method
       * @alias find
       * @category Collections
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - A truth test to apply to each item in `coll`.
       * The iteratee must complete with a boolean value as its result.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called as soon as any
       * iteratee returns `true`, or after all the `iteratee` functions have finished.
       * Result will be the first item in the array that passes the truth test
       * (iteratee) or the value `undefined` if none passed. Invoked with
       * (err, result).
       * @example
       *
       * async.detect(['file1','file2','file3'], function(filePath, callback) {
       *     fs.access(filePath, function(err) {
       *         callback(null, !err)
       *     });
       * }, function(err, result) {
       *     // result now equals the first file in the list that exists
       * });
       */
      var detect = doParallel(_createTester(identity, _findGetResult));

      /**
       * The same as [`detect`]{@link module:Collections.detect} but runs a maximum of `limit` async operations at a
       * time.
       *
       * @name detectLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.detect]{@link module:Collections.detect}
       * @alias findLimit
       * @category Collections
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - A truth test to apply to each item in `coll`.
       * The iteratee must complete with a boolean value as its result.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called as soon as any
       * iteratee returns `true`, or after all the `iteratee` functions have finished.
       * Result will be the first item in the array that passes the truth test
       * (iteratee) or the value `undefined` if none passed. Invoked with
       * (err, result).
       */
      var detectLimit = doParallelLimit(_createTester(identity, _findGetResult));

      /**
       * The same as [`detect`]{@link module:Collections.detect} but runs only a single async operation at a time.
       *
       * @name detectSeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.detect]{@link module:Collections.detect}
       * @alias findSeries
       * @category Collections
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - A truth test to apply to each item in `coll`.
       * The iteratee must complete with a boolean value as its result.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called as soon as any
       * iteratee returns `true`, or after all the `iteratee` functions have finished.
       * Result will be the first item in the array that passes the truth test
       * (iteratee) or the value `undefined` if none passed. Invoked with
       * (err, result).
       */
      var detectSeries = doLimit(detectLimit, 1);

      function consoleFunc(name) {
        return function (fn /*, ...args*/) {
          var args = slice(arguments, 1);
          args.push(function (err /*, ...args*/) {
            var args = slice(arguments, 1);
            if ((typeof console === "undefined" ? "undefined" : _typeof(console)) === 'object') {
              if (err) {
                if (console.error) {
                  console.error(err);
                }
              } else if (console[name]) {
                arrayEach(args, function (x) {
                  console[name](x);
                });
              }
            }
          });
          wrapAsync(fn).apply(null, args);
        };
      }

      /**
       * Logs the result of an [`async` function]{@link AsyncFunction} to the
       * `console` using `console.dir` to display the properties of the resulting object.
       * Only works in Node.js or in browsers that support `console.dir` and
       * `console.error` (such as FF and Chrome).
       * If multiple arguments are returned from the async function,
       * `console.dir` is called on each argument in order.
       *
       * @name dir
       * @static
       * @memberOf module:Utils
       * @method
       * @category Util
       * @param {AsyncFunction} function - The function you want to eventually apply
       * all arguments to.
       * @param {...*} arguments... - Any number of arguments to apply to the function.
       * @example
       *
       * // in a module
       * var hello = function(name, callback) {
       *     setTimeout(function() {
       *         callback(null, {hello: name});
       *     }, 1000);
       * };
       *
       * // in the node repl
       * node> async.dir(hello, 'world');
       * {hello: 'world'}
       */
      var dir = consoleFunc('dir');

      /**
       * The post-check version of [`during`]{@link module:ControlFlow.during}. To reflect the difference in
       * the order of operations, the arguments `test` and `fn` are switched.
       *
       * Also a version of [`doWhilst`]{@link module:ControlFlow.doWhilst} with asynchronous `test` function.
       * @name doDuring
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.during]{@link module:ControlFlow.during}
       * @category Control Flow
       * @param {AsyncFunction} fn - An async function which is called each time
       * `test` passes. Invoked with (callback).
       * @param {AsyncFunction} test - asynchronous truth test to perform before each
       * execution of `fn`. Invoked with (...args, callback), where `...args` are the
       * non-error args from the previous callback of `fn`.
       * @param {Function} [callback] - A callback which is called after the test
       * function has failed and repeated execution of `fn` has stopped. `callback`
       * will be passed an error if one occurred, otherwise `null`.
       */
      function doDuring(fn, test, callback) {
        callback = onlyOnce(callback || noop);
        var _fn = wrapAsync(fn);
        var _test = wrapAsync(test);

        function next(err /*, ...args*/) {
          if (err) return callback(err);
          var args = slice(arguments, 1);
          args.push(check);
          _test.apply(this, args);
        }

        function check(err, truth) {
          if (err) return callback(err);
          if (!truth) return callback(null);
          _fn(next);
        }

        check(null, true);
      }

      /**
       * The post-check version of [`whilst`]{@link module:ControlFlow.whilst}. To reflect the difference in
       * the order of operations, the arguments `test` and `iteratee` are switched.
       *
       * `doWhilst` is to `whilst` as `do while` is to `while` in plain JavaScript.
       *
       * @name doWhilst
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.whilst]{@link module:ControlFlow.whilst}
       * @category Control Flow
       * @param {AsyncFunction} iteratee - A function which is called each time `test`
       * passes. Invoked with (callback).
       * @param {Function} test - synchronous truth test to perform after each
       * execution of `iteratee`. Invoked with any non-error callback results of
       * `iteratee`.
       * @param {Function} [callback] - A callback which is called after the test
       * function has failed and repeated execution of `iteratee` has stopped.
       * `callback` will be passed an error and any arguments passed to the final
       * `iteratee`'s callback. Invoked with (err, [results]);
       */
      function doWhilst(iteratee, test, callback) {
        callback = onlyOnce(callback || noop);
        var _iteratee = wrapAsync(iteratee);
        var next = function next(err /*, ...args*/) {
          if (err) return callback(err);
          var args = slice(arguments, 1);
          if (test.apply(this, args)) return _iteratee(next);
          callback.apply(null, [null].concat(args));
        };
        _iteratee(next);
      }

      /**
       * Like ['doWhilst']{@link module:ControlFlow.doWhilst}, except the `test` is inverted. Note the
       * argument ordering differs from `until`.
       *
       * @name doUntil
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.doWhilst]{@link module:ControlFlow.doWhilst}
       * @category Control Flow
       * @param {AsyncFunction} iteratee - An async function which is called each time
       * `test` fails. Invoked with (callback).
       * @param {Function} test - synchronous truth test to perform after each
       * execution of `iteratee`. Invoked with any non-error callback results of
       * `iteratee`.
       * @param {Function} [callback] - A callback which is called after the test
       * function has passed and repeated execution of `iteratee` has stopped. `callback`
       * will be passed an error and any arguments passed to the final `iteratee`'s
       * callback. Invoked with (err, [results]);
       */
      function doUntil(iteratee, test, callback) {
        doWhilst(iteratee, function () {
          return !test.apply(this, arguments);
        }, callback);
      }

      /**
       * Like [`whilst`]{@link module:ControlFlow.whilst}, except the `test` is an asynchronous function that
       * is passed a callback in the form of `function (err, truth)`. If error is
       * passed to `test` or `fn`, the main callback is immediately called with the
       * value of the error.
       *
       * @name during
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.whilst]{@link module:ControlFlow.whilst}
       * @category Control Flow
       * @param {AsyncFunction} test - asynchronous truth test to perform before each
       * execution of `fn`. Invoked with (callback).
       * @param {AsyncFunction} fn - An async function which is called each time
       * `test` passes. Invoked with (callback).
       * @param {Function} [callback] - A callback which is called after the test
       * function has failed and repeated execution of `fn` has stopped. `callback`
       * will be passed an error, if one occurred, otherwise `null`.
       * @example
       *
       * var count = 0;
       *
       * async.during(
       *     function (callback) {
       *         return callback(null, count < 5);
       *     },
       *     function (callback) {
       *         count++;
       *         setTimeout(callback, 1000);
       *     },
       *     function (err) {
       *         // 5 seconds have passed
       *     }
       * );
       */
      function during(test, fn, callback) {
        callback = onlyOnce(callback || noop);
        var _fn = wrapAsync(fn);
        var _test = wrapAsync(test);

        function next(err) {
          if (err) return callback(err);
          _test(check);
        }

        function check(err, truth) {
          if (err) return callback(err);
          if (!truth) return callback(null);
          _fn(next);
        }

        _test(check);
      }

      function _withoutIndex(iteratee) {
        return function (value, index, callback) {
          return iteratee(value, callback);
        };
      }

      /**
       * Applies the function `iteratee` to each item in `coll`, in parallel.
       * The `iteratee` is called with an item from the list, and a callback for when
       * it has finished. If the `iteratee` passes an error to its `callback`, the
       * main `callback` (for the `each` function) is immediately called with the
       * error.
       *
       * Note, that since this function applies `iteratee` to each item in parallel,
       * there is no guarantee that the iteratee functions will complete in order.
       *
       * @name each
       * @static
       * @memberOf module:Collections
       * @method
       * @alias forEach
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async function to apply to
       * each item in `coll`. Invoked with (item, callback).
       * The array index is not passed to the iteratee.
       * If you need the index, use `eachOf`.
       * @param {Function} [callback] - A callback which is called when all
       * `iteratee` functions have finished, or an error occurs. Invoked with (err).
       * @example
       *
       * // assuming openFiles is an array of file names and saveFile is a function
       * // to save the modified contents of that file:
       *
       * async.each(openFiles, saveFile, function(err){
       *   // if any of the saves produced an error, err would equal that error
       * });
       *
       * // assuming openFiles is an array of file names
       * async.each(openFiles, function(file, callback) {
       *
       *     // Perform operation on file here.
       *     console.log('Processing file ' + file);
       *
       *     if( file.length > 32 ) {
       *       console.log('This file name is too long');
       *       callback('File name too long');
       *     } else {
       *       // Do work to process file here
       *       console.log('File processed');
       *       callback();
       *     }
       * }, function(err) {
       *     // if any of the file processing produced an error, err would equal that error
       *     if( err ) {
       *       // One of the iterations produced an error.
       *       // All processing will now stop.
       *       console.log('A file failed to process');
       *     } else {
       *       console.log('All files have been processed successfully');
       *     }
       * });
       */
      function eachLimit(coll, iteratee, callback) {
        eachOf(coll, _withoutIndex(wrapAsync(iteratee)), callback);
      }

      /**
       * The same as [`each`]{@link module:Collections.each} but runs a maximum of `limit` async operations at a time.
       *
       * @name eachLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.each]{@link module:Collections.each}
       * @alias forEachLimit
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - An async function to apply to each item in
       * `coll`.
       * The array index is not passed to the iteratee.
       * If you need the index, use `eachOfLimit`.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called when all
       * `iteratee` functions have finished, or an error occurs. Invoked with (err).
       */
      function eachLimit$1(coll, limit, iteratee, callback) {
        _eachOfLimit(limit)(coll, _withoutIndex(wrapAsync(iteratee)), callback);
      }

      /**
       * The same as [`each`]{@link module:Collections.each} but runs only a single async operation at a time.
       *
       * @name eachSeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.each]{@link module:Collections.each}
       * @alias forEachSeries
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async function to apply to each
       * item in `coll`.
       * The array index is not passed to the iteratee.
       * If you need the index, use `eachOfSeries`.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called when all
       * `iteratee` functions have finished, or an error occurs. Invoked with (err).
       */
      var eachSeries = doLimit(eachLimit$1, 1);

      /**
       * Wrap an async function and ensure it calls its callback on a later tick of
       * the event loop.  If the function already calls its callback on a next tick,
       * no extra deferral is added. This is useful for preventing stack overflows
       * (`RangeError: Maximum call stack size exceeded`) and generally keeping
       * [Zalgo](http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony)
       * contained. ES2017 `async` functions are returned as-is -- they are immune
       * to Zalgo's corrupting influences, as they always resolve on a later tick.
       *
       * @name ensureAsync
       * @static
       * @memberOf module:Utils
       * @method
       * @category Util
       * @param {AsyncFunction} fn - an async function, one that expects a node-style
       * callback as its last argument.
       * @returns {AsyncFunction} Returns a wrapped function with the exact same call
       * signature as the function passed in.
       * @example
       *
       * function sometimesAsync(arg, callback) {
       *     if (cache[arg]) {
       *         return callback(null, cache[arg]); // this would be synchronous!!
       *     } else {
       *         doSomeIO(arg, callback); // this IO would be asynchronous
       *     }
       * }
       *
       * // this has a risk of stack overflows if many results are cached in a row
       * async.mapSeries(args, sometimesAsync, done);
       *
       * // this will defer sometimesAsync's callback if necessary,
       * // preventing stack overflows
       * async.mapSeries(args, async.ensureAsync(sometimesAsync), done);
       */
      function ensureAsync(fn) {
        if (isAsync(fn)) return fn;
        return initialParams(function (args, callback) {
          var sync = true;
          args.push(function () {
            var innerArgs = arguments;
            if (sync) {
              setImmediate$1(function () {
                callback.apply(null, innerArgs);
              });
            } else {
              callback.apply(null, innerArgs);
            }
          });
          fn.apply(this, args);
          sync = false;
        });
      }

      function notId(v) {
        return !v;
      }

      /**
       * Returns `true` if every element in `coll` satisfies an async test. If any
       * iteratee call returns `false`, the main `callback` is immediately called.
       *
       * @name every
       * @static
       * @memberOf module:Collections
       * @method
       * @alias all
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async truth test to apply to each item
       * in the collection in parallel.
       * The iteratee must complete with a boolean result value.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Result will be either `true` or `false`
       * depending on the values of the async tests. Invoked with (err, result).
       * @example
       *
       * async.every(['file1','file2','file3'], function(filePath, callback) {
       *     fs.access(filePath, function(err) {
       *         callback(null, !err)
       *     });
       * }, function(err, result) {
       *     // if result is true then every file exists
       * });
       */
      var every = doParallel(_createTester(notId, notId));

      /**
       * The same as [`every`]{@link module:Collections.every} but runs a maximum of `limit` async operations at a time.
       *
       * @name everyLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.every]{@link module:Collections.every}
       * @alias allLimit
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - An async truth test to apply to each item
       * in the collection in parallel.
       * The iteratee must complete with a boolean result value.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Result will be either `true` or `false`
       * depending on the values of the async tests. Invoked with (err, result).
       */
      var everyLimit = doParallelLimit(_createTester(notId, notId));

      /**
       * The same as [`every`]{@link module:Collections.every} but runs only a single async operation at a time.
       *
       * @name everySeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.every]{@link module:Collections.every}
       * @alias allSeries
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async truth test to apply to each item
       * in the collection in series.
       * The iteratee must complete with a boolean result value.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Result will be either `true` or `false`
       * depending on the values of the async tests. Invoked with (err, result).
       */
      var everySeries = doLimit(everyLimit, 1);

      /**
       * The base implementation of `_.property` without support for deep paths.
       *
       * @private
       * @param {string} key The key of the property to get.
       * @returns {Function} Returns the new accessor function.
       */
      function baseProperty(key) {
        return function (object) {
          return object == null ? undefined : object[key];
        };
      }

      function filterArray(eachfn, arr, iteratee, callback) {
        var truthValues = new Array(arr.length);
        eachfn(arr, function (x, index, callback) {
          iteratee(x, function (err, v) {
            truthValues[index] = !!v;
            callback(err);
          });
        }, function (err) {
          if (err) return callback(err);
          var results = [];
          for (var i = 0; i < arr.length; i++) {
            if (truthValues[i]) results.push(arr[i]);
          }
          callback(null, results);
        });
      }

      function filterGeneric(eachfn, coll, iteratee, callback) {
        var results = [];
        eachfn(coll, function (x, index, callback) {
          iteratee(x, function (err, v) {
            if (err) {
              callback(err);
            } else {
              if (v) {
                results.push({ index: index, value: x });
              }
              callback();
            }
          });
        }, function (err) {
          if (err) {
            callback(err);
          } else {
            callback(null, arrayMap(results.sort(function (a, b) {
              return a.index - b.index;
            }), baseProperty('value')));
          }
        });
      }

      function _filter(eachfn, coll, iteratee, callback) {
        var filter = isArrayLike(coll) ? filterArray : filterGeneric;
        filter(eachfn, coll, wrapAsync(iteratee), callback || noop);
      }

      /**
       * Returns a new array of all the values in `coll` which pass an async truth
       * test. This operation is performed in parallel, but the results array will be
       * in the same order as the original.
       *
       * @name filter
       * @static
       * @memberOf module:Collections
       * @method
       * @alias select
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {Function} iteratee - A truth test to apply to each item in `coll`.
       * The `iteratee` is passed a `callback(err, truthValue)`, which must be called
       * with a boolean argument once it has completed. Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Invoked with (err, results).
       * @example
       *
       * async.filter(['file1','file2','file3'], function(filePath, callback) {
       *     fs.access(filePath, function(err) {
       *         callback(null, !err)
       *     });
       * }, function(err, results) {
       *     // results now equals an array of the existing files
       * });
       */
      var filter = doParallel(_filter);

      /**
       * The same as [`filter`]{@link module:Collections.filter} but runs a maximum of `limit` async operations at a
       * time.
       *
       * @name filterLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.filter]{@link module:Collections.filter}
       * @alias selectLimit
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {Function} iteratee - A truth test to apply to each item in `coll`.
       * The `iteratee` is passed a `callback(err, truthValue)`, which must be called
       * with a boolean argument once it has completed. Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Invoked with (err, results).
       */
      var filterLimit = doParallelLimit(_filter);

      /**
       * The same as [`filter`]{@link module:Collections.filter} but runs only a single async operation at a time.
       *
       * @name filterSeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.filter]{@link module:Collections.filter}
       * @alias selectSeries
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {Function} iteratee - A truth test to apply to each item in `coll`.
       * The `iteratee` is passed a `callback(err, truthValue)`, which must be called
       * with a boolean argument once it has completed. Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Invoked with (err, results)
       */
      var filterSeries = doLimit(filterLimit, 1);

      /**
       * Calls the asynchronous function `fn` with a callback parameter that allows it
       * to call itself again, in series, indefinitely.
      
       * If an error is passed to the callback then `errback` is called with the
       * error, and execution stops, otherwise it will never be called.
       *
       * @name forever
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {AsyncFunction} fn - an async function to call repeatedly.
       * Invoked with (next).
       * @param {Function} [errback] - when `fn` passes an error to it's callback,
       * this function will be called, and execution stops. Invoked with (err).
       * @example
       *
       * async.forever(
       *     function(next) {
       *         // next is suitable for passing to things that need a callback(err [, whatever]);
       *         // it will result in this function being called again.
       *     },
       *     function(err) {
       *         // if next is called with a value in its first parameter, it will appear
       *         // in here as 'err', and execution will stop.
       *     }
       * );
       */
      function forever(fn, errback) {
        var done = onlyOnce(errback || noop);
        var task = wrapAsync(ensureAsync(fn));

        function next(err) {
          if (err) return done(err);
          task(next);
        }
        next();
      }

      /**
       * The same as [`groupBy`]{@link module:Collections.groupBy} but runs a maximum of `limit` async operations at a time.
       *
       * @name groupByLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.groupBy]{@link module:Collections.groupBy}
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - An async function to apply to each item in
       * `coll`.
       * The iteratee should complete with a `key` to group the value under.
       * Invoked with (value, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. Result is an `Object` whoses
       * properties are arrays of values which returned the corresponding key.
       */
      var groupByLimit = function groupByLimit(coll, limit, iteratee, callback) {
        callback = callback || noop;
        var _iteratee = wrapAsync(iteratee);
        mapLimit(coll, limit, function (val, callback) {
          _iteratee(val, function (err, key) {
            if (err) return callback(err);
            return callback(null, { key: key, val: val });
          });
        }, function (err, mapResults) {
          var result = {};
          // from MDN, handle object having an `hasOwnProperty` prop
          var hasOwnProperty = Object.prototype.hasOwnProperty;

          for (var i = 0; i < mapResults.length; i++) {
            if (mapResults[i]) {
              var key = mapResults[i].key;
              var val = mapResults[i].val;

              if (hasOwnProperty.call(result, key)) {
                result[key].push(val);
              } else {
                result[key] = [val];
              }
            }
          }

          return callback(err, result);
        });
      };

      /**
       * Returns a new object, where each value corresponds to an array of items, from
       * `coll`, that returned the corresponding key. That is, the keys of the object
       * correspond to the values passed to the `iteratee` callback.
       *
       * Note: Since this function applies the `iteratee` to each item in parallel,
       * there is no guarantee that the `iteratee` functions will complete in order.
       * However, the values for each key in the `result` will be in the same order as
       * the original `coll`. For Objects, the values will roughly be in the order of
       * the original Objects' keys (but this can vary across JavaScript engines).
       *
       * @name groupBy
       * @static
       * @memberOf module:Collections
       * @method
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async function to apply to each item in
       * `coll`.
       * The iteratee should complete with a `key` to group the value under.
       * Invoked with (value, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. Result is an `Object` whoses
       * properties are arrays of values which returned the corresponding key.
       * @example
       *
       * async.groupBy(['userId1', 'userId2', 'userId3'], function(userId, callback) {
       *     db.findById(userId, function(err, user) {
       *         if (err) return callback(err);
       *         return callback(null, user.age);
       *     });
       * }, function(err, result) {
       *     // result is object containing the userIds grouped by age
       *     // e.g. { 30: ['userId1', 'userId3'], 42: ['userId2']};
       * });
       */
      var groupBy = doLimit(groupByLimit, Infinity);

      /**
       * The same as [`groupBy`]{@link module:Collections.groupBy} but runs only a single async operation at a time.
       *
       * @name groupBySeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.groupBy]{@link module:Collections.groupBy}
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - An async function to apply to each item in
       * `coll`.
       * The iteratee should complete with a `key` to group the value under.
       * Invoked with (value, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. Result is an `Object` whoses
       * properties are arrays of values which returned the corresponding key.
       */
      var groupBySeries = doLimit(groupByLimit, 1);

      /**
       * Logs the result of an `async` function to the `console`. Only works in
       * Node.js or in browsers that support `console.log` and `console.error` (such
       * as FF and Chrome). If multiple arguments are returned from the async
       * function, `console.log` is called on each argument in order.
       *
       * @name log
       * @static
       * @memberOf module:Utils
       * @method
       * @category Util
       * @param {AsyncFunction} function - The function you want to eventually apply
       * all arguments to.
       * @param {...*} arguments... - Any number of arguments to apply to the function.
       * @example
       *
       * // in a module
       * var hello = function(name, callback) {
       *     setTimeout(function() {
       *         callback(null, 'hello ' + name);
       *     }, 1000);
       * };
       *
       * // in the node repl
       * node> async.log(hello, 'world');
       * 'hello world'
       */
      var log = consoleFunc('log');

      /**
       * The same as [`mapValues`]{@link module:Collections.mapValues} but runs a maximum of `limit` async operations at a
       * time.
       *
       * @name mapValuesLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.mapValues]{@link module:Collections.mapValues}
       * @category Collection
       * @param {Object} obj - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - A function to apply to each value and key
       * in `coll`.
       * The iteratee should complete with the transformed value as its result.
       * Invoked with (value, key, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. `result` is a new object consisting
       * of each key from `obj`, with each transformed value on the right-hand side.
       * Invoked with (err, result).
       */
      function mapValuesLimit(obj, limit, iteratee, callback) {
        callback = once$$1(callback || noop);
        var newObj = {};
        var _iteratee = wrapAsync(iteratee);
        eachOfLimit(obj, limit, function (val, key, next) {
          _iteratee(val, key, function (err, result) {
            if (err) return next(err);
            newObj[key] = result;
            next();
          });
        }, function (err) {
          callback(err, newObj);
        });
      }

      /**
       * A relative of [`map`]{@link module:Collections.map}, designed for use with objects.
       *
       * Produces a new Object by mapping each value of `obj` through the `iteratee`
       * function. The `iteratee` is called each `value` and `key` from `obj` and a
       * callback for when it has finished processing. Each of these callbacks takes
       * two arguments: an `error`, and the transformed item from `obj`. If `iteratee`
       * passes an error to its callback, the main `callback` (for the `mapValues`
       * function) is immediately called with the error.
       *
       * Note, the order of the keys in the result is not guaranteed.  The keys will
       * be roughly in the order they complete, (but this is very engine-specific)
       *
       * @name mapValues
       * @static
       * @memberOf module:Collections
       * @method
       * @category Collection
       * @param {Object} obj - A collection to iterate over.
       * @param {AsyncFunction} iteratee - A function to apply to each value and key
       * in `coll`.
       * The iteratee should complete with the transformed value as its result.
       * Invoked with (value, key, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. `result` is a new object consisting
       * of each key from `obj`, with each transformed value on the right-hand side.
       * Invoked with (err, result).
       * @example
       *
       * async.mapValues({
       *     f1: 'file1',
       *     f2: 'file2',
       *     f3: 'file3'
       * }, function (file, key, callback) {
       *   fs.stat(file, callback);
       * }, function(err, result) {
       *     // result is now a map of stats for each file, e.g.
       *     // {
       *     //     f1: [stats for file1],
       *     //     f2: [stats for file2],
       *     //     f3: [stats for file3]
       *     // }
       * });
       */

      var mapValues = doLimit(mapValuesLimit, Infinity);

      /**
       * The same as [`mapValues`]{@link module:Collections.mapValues} but runs only a single async operation at a time.
       *
       * @name mapValuesSeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.mapValues]{@link module:Collections.mapValues}
       * @category Collection
       * @param {Object} obj - A collection to iterate over.
       * @param {AsyncFunction} iteratee - A function to apply to each value and key
       * in `coll`.
       * The iteratee should complete with the transformed value as its result.
       * Invoked with (value, key, callback).
       * @param {Function} [callback] - A callback which is called when all `iteratee`
       * functions have finished, or an error occurs. `result` is a new object consisting
       * of each key from `obj`, with each transformed value on the right-hand side.
       * Invoked with (err, result).
       */
      var mapValuesSeries = doLimit(mapValuesLimit, 1);

      function has(obj, key) {
        return key in obj;
      }

      /**
       * Caches the results of an async function. When creating a hash to store
       * function results against, the callback is omitted from the hash and an
       * optional hash function can be used.
       *
       * If no hash function is specified, the first argument is used as a hash key,
       * which may work reasonably if it is a string or a data type that converts to a
       * distinct string. Note that objects and arrays will not behave reasonably.
       * Neither will cases where the other arguments are significant. In such cases,
       * specify your own hash function.
       *
       * The cache of results is exposed as the `memo` property of the function
       * returned by `memoize`.
       *
       * @name memoize
       * @static
       * @memberOf module:Utils
       * @method
       * @category Util
       * @param {AsyncFunction} fn - The async function to proxy and cache results from.
       * @param {Function} hasher - An optional function for generating a custom hash
       * for storing results. It has all the arguments applied to it apart from the
       * callback, and must be synchronous.
       * @returns {AsyncFunction} a memoized version of `fn`
       * @example
       *
       * var slow_fn = function(name, callback) {
       *     // do something
       *     callback(null, result);
       * };
       * var fn = async.memoize(slow_fn);
       *
       * // fn can now be used as if it were slow_fn
       * fn('some name', function() {
       *     // callback
       * });
       */
      function memoize(fn, hasher) {
        var memo = Object.create(null);
        var queues = Object.create(null);
        hasher = hasher || identity;
        var _fn = wrapAsync(fn);
        var memoized = initialParams(function memoized(args, callback) {
          var key = hasher.apply(null, args);
          if (has(memo, key)) {
            setImmediate$1(function () {
              callback.apply(null, memo[key]);
            });
          } else if (has(queues, key)) {
            queues[key].push(callback);
          } else {
            queues[key] = [callback];
            _fn.apply(null, args.concat(function () /*args*/{
              var args = slice(arguments);
              memo[key] = args;
              var q = queues[key];
              delete queues[key];
              for (var i = 0, l = q.length; i < l; i++) {
                q[i].apply(null, args);
              }
            }));
          }
        });
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
      }

      /**
       * Calls `callback` on a later loop around the event loop. In Node.js this just
       * calls `setImmediate`.  In the browser it will use `setImmediate` if
       * available, otherwise `setTimeout(callback, 0)`, which means other higher
       * priority events may precede the execution of `callback`.
       *
       * This is used internally for browser-compatibility purposes.
       *
       * @name nextTick
       * @static
       * @memberOf module:Utils
       * @method
       * @alias setImmediate
       * @category Util
       * @param {Function} callback - The function to call on a later loop around
       * the event loop. Invoked with (args...).
       * @param {...*} args... - any number of additional arguments to pass to the
       * callback on the next tick.
       * @example
       *
       * var call_order = [];
       * async.nextTick(function() {
       *     call_order.push('two');
       *     // call_order now equals ['one','two']
       * });
       * call_order.push('one');
       *
       * async.setImmediate(function (a, b, c) {
       *     // a, b, and c equal 1, 2, and 3
       * }, 1, 2, 3);
       */
      var _defer$1;

      if (hasNextTick) {
        _defer$1 = nextTick;
      } else if (hasSetImmediate) {
        _defer$1 = setImmediate;
      } else {
        _defer$1 = fallback;
      }

      var nextTick$$1 = wrap(_defer$1);

      function _parallel(eachfn, tasks, callback) {
        callback = callback || noop;
        var results = isArrayLike(tasks) ? [] : {};

        eachfn(tasks, function (task, key, callback) {
          wrapAsync(task)(function (err, result) {
            if (arguments.length > 2) {
              result = slice(arguments, 1);
            }
            results[key] = result;
            callback(err);
          });
        }, function (err) {
          callback(err, results);
        });
      }

      /**
       * Run the `tasks` collection of functions in parallel, without waiting until
       * the previous function has completed. If any of the functions pass an error to
       * its callback, the main `callback` is immediately called with the value of the
       * error. Once the `tasks` have completed, the results are passed to the final
       * `callback` as an array.
       *
       * **Note:** `parallel` is about kicking-off I/O tasks in parallel, not about
       * parallel execution of code.  If your tasks do not use any timers or perform
       * any I/O, they will actually be executed in series.  Any synchronous setup
       * sections for each task will happen one after the other.  JavaScript remains
       * single-threaded.
       *
       * **Hint:** Use [`reflect`]{@link module:Utils.reflect} to continue the
       * execution of other tasks when a task fails.
       *
       * It is also possible to use an object instead of an array. Each property will
       * be run as a function and the results will be passed to the final `callback`
       * as an object instead of an array. This can be a more readable way of handling
       * results from {@link async.parallel}.
       *
       * @name parallel
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {Array|Iterable|Object} tasks - A collection of
       * [async functions]{@link AsyncFunction} to run.
       * Each async function can complete with any number of optional `result` values.
       * @param {Function} [callback] - An optional callback to run once all the
       * functions have completed successfully. This function gets a results array
       * (or object) containing all the result arguments passed to the task callbacks.
       * Invoked with (err, results).
       *
       * @example
       * async.parallel([
       *     function(callback) {
       *         setTimeout(function() {
       *             callback(null, 'one');
       *         }, 200);
       *     },
       *     function(callback) {
       *         setTimeout(function() {
       *             callback(null, 'two');
       *         }, 100);
       *     }
       * ],
       * // optional callback
       * function(err, results) {
       *     // the results array will equal ['one','two'] even though
       *     // the second function had a shorter timeout.
       * });
       *
       * // an example using an object instead of an array
       * async.parallel({
       *     one: function(callback) {
       *         setTimeout(function() {
       *             callback(null, 1);
       *         }, 200);
       *     },
       *     two: function(callback) {
       *         setTimeout(function() {
       *             callback(null, 2);
       *         }, 100);
       *     }
       * }, function(err, results) {
       *     // results is now equals to: {one: 1, two: 2}
       * });
       */
      function parallelLimit(tasks, callback) {
        _parallel(eachOf, tasks, callback);
      }

      /**
       * The same as [`parallel`]{@link module:ControlFlow.parallel} but runs a maximum of `limit` async operations at a
       * time.
       *
       * @name parallelLimit
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.parallel]{@link module:ControlFlow.parallel}
       * @category Control Flow
       * @param {Array|Iterable|Object} tasks - A collection of
       * [async functions]{@link AsyncFunction} to run.
       * Each async function can complete with any number of optional `result` values.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {Function} [callback] - An optional callback to run once all the
       * functions have completed successfully. This function gets a results array
       * (or object) containing all the result arguments passed to the task callbacks.
       * Invoked with (err, results).
       */
      function parallelLimit$1(tasks, limit, callback) {
        _parallel(_eachOfLimit(limit), tasks, callback);
      }

      /**
       * A queue of tasks for the worker function to complete.
       * @typedef {Object} QueueObject
       * @memberOf module:ControlFlow
       * @property {Function} length - a function returning the number of items
       * waiting to be processed. Invoke with `queue.length()`.
       * @property {boolean} started - a boolean indicating whether or not any
       * items have been pushed and processed by the queue.
       * @property {Function} running - a function returning the number of items
       * currently being processed. Invoke with `queue.running()`.
       * @property {Function} workersList - a function returning the array of items
       * currently being processed. Invoke with `queue.workersList()`.
       * @property {Function} idle - a function returning false if there are items
       * waiting or being processed, or true if not. Invoke with `queue.idle()`.
       * @property {number} concurrency - an integer for determining how many `worker`
       * functions should be run in parallel. This property can be changed after a
       * `queue` is created to alter the concurrency on-the-fly.
       * @property {Function} push - add a new task to the `queue`. Calls `callback`
       * once the `worker` has finished processing the task. Instead of a single task,
       * a `tasks` array can be submitted. The respective callback is used for every
       * task in the list. Invoke with `queue.push(task, [callback])`,
       * @property {Function} unshift - add a new task to the front of the `queue`.
       * Invoke with `queue.unshift(task, [callback])`.
       * @property {Function} remove - remove items from the queue that match a test
       * function.  The test function will be passed an object with a `data` property,
       * and a `priority` property, if this is a
       * [priorityQueue]{@link module:ControlFlow.priorityQueue} object.
       * Invoked with `queue.remove(testFn)`, where `testFn` is of the form
       * `function ({data, priority}) {}` and returns a Boolean.
       * @property {Function} saturated - a callback that is called when the number of
       * running workers hits the `concurrency` limit, and further tasks will be
       * queued.
       * @property {Function} unsaturated - a callback that is called when the number
       * of running workers is less than the `concurrency` & `buffer` limits, and
       * further tasks will not be queued.
       * @property {number} buffer - A minimum threshold buffer in order to say that
       * the `queue` is `unsaturated`.
       * @property {Function} empty - a callback that is called when the last item
       * from the `queue` is given to a `worker`.
       * @property {Function} drain - a callback that is called when the last item
       * from the `queue` has returned from the `worker`.
       * @property {Function} error - a callback that is called when a task errors.
       * Has the signature `function(error, task)`.
       * @property {boolean} paused - a boolean for determining whether the queue is
       * in a paused state.
       * @property {Function} pause - a function that pauses the processing of tasks
       * until `resume()` is called. Invoke with `queue.pause()`.
       * @property {Function} resume - a function that resumes the processing of
       * queued tasks when the queue is paused. Invoke with `queue.resume()`.
       * @property {Function} kill - a function that removes the `drain` callback and
       * empties remaining tasks from the queue forcing it to go idle. No more tasks
       * should be pushed to the queue after calling this function. Invoke with `queue.kill()`.
       */

      /**
       * Creates a `queue` object with the specified `concurrency`. Tasks added to the
       * `queue` are processed in parallel (up to the `concurrency` limit). If all
       * `worker`s are in progress, the task is queued until one becomes available.
       * Once a `worker` completes a `task`, that `task`'s callback is called.
       *
       * @name queue
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {AsyncFunction} worker - An async function for processing a queued task.
       * If you want to handle errors from an individual task, pass a callback to
       * `q.push()`. Invoked with (task, callback).
       * @param {number} [concurrency=1] - An `integer` for determining how many
       * `worker` functions should be run in parallel.  If omitted, the concurrency
       * defaults to `1`.  If the concurrency is `0`, an error is thrown.
       * @returns {module:ControlFlow.QueueObject} A queue object to manage the tasks. Callbacks can
       * attached as certain properties to listen for specific events during the
       * lifecycle of the queue.
       * @example
       *
       * // create a queue object with concurrency 2
       * var q = async.queue(function(task, callback) {
       *     console.log('hello ' + task.name);
       *     callback();
       * }, 2);
       *
       * // assign a callback
       * q.drain = function() {
       *     console.log('all items have been processed');
       * };
       *
       * // add some items to the queue
       * q.push({name: 'foo'}, function(err) {
       *     console.log('finished processing foo');
       * });
       * q.push({name: 'bar'}, function (err) {
       *     console.log('finished processing bar');
       * });
       *
       * // add some items to the queue (batch-wise)
       * q.push([{name: 'baz'},{name: 'bay'},{name: 'bax'}], function(err) {
       *     console.log('finished processing item');
       * });
       *
       * // add some items to the front of the queue
       * q.unshift({name: 'bar'}, function (err) {
       *     console.log('finished processing bar');
       * });
       */
      var queue$1 = function queue$1(worker, concurrency) {
        var _worker = wrapAsync(worker);
        return queue(function (items, cb) {
          _worker(items[0], cb);
        }, concurrency, 1);
      };

      /**
       * The same as [async.queue]{@link module:ControlFlow.queue} only tasks are assigned a priority and
       * completed in ascending priority order.
       *
       * @name priorityQueue
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.queue]{@link module:ControlFlow.queue}
       * @category Control Flow
       * @param {AsyncFunction} worker - An async function for processing a queued task.
       * If you want to handle errors from an individual task, pass a callback to
       * `q.push()`.
       * Invoked with (task, callback).
       * @param {number} concurrency - An `integer` for determining how many `worker`
       * functions should be run in parallel.  If omitted, the concurrency defaults to
       * `1`.  If the concurrency is `0`, an error is thrown.
       * @returns {module:ControlFlow.QueueObject} A priorityQueue object to manage the tasks. There are two
       * differences between `queue` and `priorityQueue` objects:
       * * `push(task, priority, [callback])` - `priority` should be a number. If an
       *   array of `tasks` is given, all tasks will be assigned the same priority.
       * * The `unshift` method was removed.
       */
      var priorityQueue = function priorityQueue(worker, concurrency) {
        // Start with a normal queue
        var q = queue$1(worker, concurrency);

        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
          if (callback == null) callback = noop;
          if (typeof callback !== 'function') {
            throw new Error('task callback must be a function');
          }
          q.started = true;
          if (!isArray(data)) {
            data = [data];
          }
          if (data.length === 0) {
            // call drain immediately if there are no tasks
            return setImmediate$1(function () {
              q.drain();
            });
          }

          priority = priority || 0;
          var nextNode = q._tasks.head;
          while (nextNode && priority >= nextNode.priority) {
            nextNode = nextNode.next;
          }

          for (var i = 0, l = data.length; i < l; i++) {
            var item = {
              data: data[i],
              priority: priority,
              callback: callback
            };

            if (nextNode) {
              q._tasks.insertBefore(nextNode, item);
            } else {
              q._tasks.push(item);
            }
          }
          setImmediate$1(q.process);
        };

        // Remove unshift function
        delete q.unshift;

        return q;
      };

      /**
       * Runs the `tasks` array of functions in parallel, without waiting until the
       * previous function has completed. Once any of the `tasks` complete or pass an
       * error to its callback, the main `callback` is immediately called. It's
       * equivalent to `Promise.race()`.
       *
       * @name race
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {Array} tasks - An array containing [async functions]{@link AsyncFunction}
       * to run. Each function can complete with an optional `result` value.
       * @param {Function} callback - A callback to run once any of the functions have
       * completed. This function gets an error or result from the first function that
       * completed. Invoked with (err, result).
       * @returns undefined
       * @example
       *
       * async.race([
       *     function(callback) {
       *         setTimeout(function() {
       *             callback(null, 'one');
       *         }, 200);
       *     },
       *     function(callback) {
       *         setTimeout(function() {
       *             callback(null, 'two');
       *         }, 100);
       *     }
       * ],
       * // main callback
       * function(err, result) {
       *     // the result will be equal to 'two' as it finishes earlier
       * });
       */
      function race(tasks, callback) {
        callback = once$$1(callback || noop);
        if (!isArray(tasks)) return callback(new TypeError('First argument to race must be an array of functions'));
        if (!tasks.length) return callback();
        for (var i = 0, l = tasks.length; i < l; i++) {
          wrapAsync(tasks[i])(callback);
        }
      }

      /**
       * Same as [`reduce`]{@link module:Collections.reduce}, only operates on `array` in reverse order.
       *
       * @name reduceRight
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.reduce]{@link module:Collections.reduce}
       * @alias foldr
       * @category Collection
       * @param {Array} array - A collection to iterate over.
       * @param {*} memo - The initial state of the reduction.
       * @param {AsyncFunction} iteratee - A function applied to each item in the
       * array to produce the next step in the reduction.
       * The `iteratee` should complete with the next state of the reduction.
       * If the iteratee complete with an error, the reduction is stopped and the
       * main `callback` is immediately called with the error.
       * Invoked with (memo, item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Result is the reduced value. Invoked with
       * (err, result).
       */
      function reduceRight(array, memo, iteratee, callback) {
        var reversed = slice(array).reverse();
        reduce(reversed, memo, iteratee, callback);
      }

      /**
       * Wraps the async function in another function that always completes with a
       * result object, even when it errors.
       *
       * The result object has either the property `error` or `value`.
       *
       * @name reflect
       * @static
       * @memberOf module:Utils
       * @method
       * @category Util
       * @param {AsyncFunction} fn - The async function you want to wrap
       * @returns {Function} - A function that always passes null to it's callback as
       * the error. The second argument to the callback will be an `object` with
       * either an `error` or a `value` property.
       * @example
       *
       * async.parallel([
       *     async.reflect(function(callback) {
       *         // do some stuff ...
       *         callback(null, 'one');
       *     }),
       *     async.reflect(function(callback) {
       *         // do some more stuff but error ...
       *         callback('bad stuff happened');
       *     }),
       *     async.reflect(function(callback) {
       *         // do some more stuff ...
       *         callback(null, 'two');
       *     })
       * ],
       * // optional callback
       * function(err, results) {
       *     // values
       *     // results[0].value = 'one'
       *     // results[1].error = 'bad stuff happened'
       *     // results[2].value = 'two'
       * });
       */
      function reflect(fn) {
        var _fn = wrapAsync(fn);
        return initialParams(function reflectOn(args, reflectCallback) {
          args.push(function callback(error, cbArg) {
            if (error) {
              reflectCallback(null, { error: error });
            } else {
              var value;
              if (arguments.length <= 2) {
                value = cbArg;
              } else {
                value = slice(arguments, 1);
              }
              reflectCallback(null, { value: value });
            }
          });

          return _fn.apply(this, args);
        });
      }

      function reject$1(eachfn, arr, iteratee, callback) {
        _filter(eachfn, arr, function (value, cb) {
          iteratee(value, function (err, v) {
            cb(err, !v);
          });
        }, callback);
      }

      /**
       * The opposite of [`filter`]{@link module:Collections.filter}. Removes values that pass an `async` truth test.
       *
       * @name reject
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.filter]{@link module:Collections.filter}
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {Function} iteratee - An async truth test to apply to each item in
       * `coll`.
       * The should complete with a boolean value as its `result`.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Invoked with (err, results).
       * @example
       *
       * async.reject(['file1','file2','file3'], function(filePath, callback) {
       *     fs.access(filePath, function(err) {
       *         callback(null, !err)
       *     });
       * }, function(err, results) {
       *     // results now equals an array of missing files
       *     createFiles(results);
       * });
       */
      var reject = doParallel(reject$1);

      /**
       * A helper function that wraps an array or an object of functions with `reflect`.
       *
       * @name reflectAll
       * @static
       * @memberOf module:Utils
       * @method
       * @see [async.reflect]{@link module:Utils.reflect}
       * @category Util
       * @param {Array|Object|Iterable} tasks - The collection of
       * [async functions]{@link AsyncFunction} to wrap in `async.reflect`.
       * @returns {Array} Returns an array of async functions, each wrapped in
       * `async.reflect`
       * @example
       *
       * let tasks = [
       *     function(callback) {
       *         setTimeout(function() {
       *             callback(null, 'one');
       *         }, 200);
       *     },
       *     function(callback) {
       *         // do some more stuff but error ...
       *         callback(new Error('bad stuff happened'));
       *     },
       *     function(callback) {
       *         setTimeout(function() {
       *             callback(null, 'two');
       *         }, 100);
       *     }
       * ];
       *
       * async.parallel(async.reflectAll(tasks),
       * // optional callback
       * function(err, results) {
       *     // values
       *     // results[0].value = 'one'
       *     // results[1].error = Error('bad stuff happened')
       *     // results[2].value = 'two'
       * });
       *
       * // an example using an object instead of an array
       * let tasks = {
       *     one: function(callback) {
       *         setTimeout(function() {
       *             callback(null, 'one');
       *         }, 200);
       *     },
       *     two: function(callback) {
       *         callback('two');
       *     },
       *     three: function(callback) {
       *         setTimeout(function() {
       *             callback(null, 'three');
       *         }, 100);
       *     }
       * };
       *
       * async.parallel(async.reflectAll(tasks),
       * // optional callback
       * function(err, results) {
       *     // values
       *     // results.one.value = 'one'
       *     // results.two.error = 'two'
       *     // results.three.value = 'three'
       * });
       */
      function reflectAll(tasks) {
        var results;
        if (isArray(tasks)) {
          results = arrayMap(tasks, reflect);
        } else {
          results = {};
          baseForOwn(tasks, function (task, key) {
            results[key] = reflect.call(this, task);
          });
        }
        return results;
      }

      /**
       * The same as [`reject`]{@link module:Collections.reject} but runs a maximum of `limit` async operations at a
       * time.
       *
       * @name rejectLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.reject]{@link module:Collections.reject}
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {Function} iteratee - An async truth test to apply to each item in
       * `coll`.
       * The should complete with a boolean value as its `result`.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Invoked with (err, results).
       */
      var rejectLimit = doParallelLimit(reject$1);

      /**
       * The same as [`reject`]{@link module:Collections.reject} but runs only a single async operation at a time.
       *
       * @name rejectSeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.reject]{@link module:Collections.reject}
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {Function} iteratee - An async truth test to apply to each item in
       * `coll`.
       * The should complete with a boolean value as its `result`.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Invoked with (err, results).
       */
      var rejectSeries = doLimit(rejectLimit, 1);

      /**
       * Creates a function that returns `value`.
       *
       * @static
       * @memberOf _
       * @since 2.4.0
       * @category Util
       * @param {*} value The value to return from the new function.
       * @returns {Function} Returns the new constant function.
       * @example
       *
       * var objects = _.times(2, _.constant({ 'a': 1 }));
       *
       * console.log(objects);
       * // => [{ 'a': 1 }, { 'a': 1 }]
       *
       * console.log(objects[0] === objects[1]);
       * // => true
       */
      function constant$1(value) {
        return function () {
          return value;
        };
      }

      /**
       * Attempts to get a successful response from `task` no more than `times` times
       * before returning an error. If the task is successful, the `callback` will be
       * passed the result of the successful task. If all attempts fail, the callback
       * will be passed the error and result (if any) of the final attempt.
       *
       * @name retry
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @see [async.retryable]{@link module:ControlFlow.retryable}
       * @param {Object|number} [opts = {times: 5, interval: 0}| 5] - Can be either an
       * object with `times` and `interval` or a number.
       * * `times` - The number of attempts to make before giving up.  The default
       *   is `5`.
       * * `interval` - The time to wait between retries, in milliseconds.  The
       *   default is `0`. The interval may also be specified as a function of the
       *   retry count (see example).
       * * `errorFilter` - An optional synchronous function that is invoked on
       *   erroneous result. If it returns `true` the retry attempts will continue;
       *   if the function returns `false` the retry flow is aborted with the current
       *   attempt's error and result being returned to the final callback.
       *   Invoked with (err).
       * * If `opts` is a number, the number specifies the number of times to retry,
       *   with the default interval of `0`.
       * @param {AsyncFunction} task - An async function to retry.
       * Invoked with (callback).
       * @param {Function} [callback] - An optional callback which is called when the
       * task has succeeded, or after the final failed attempt. It receives the `err`
       * and `result` arguments of the last attempt at completing the `task`. Invoked
       * with (err, results).
       *
       * @example
       *
       * // The `retry` function can be used as a stand-alone control flow by passing
       * // a callback, as shown below:
       *
       * // try calling apiMethod 3 times
       * async.retry(3, apiMethod, function(err, result) {
       *     // do something with the result
       * });
       *
       * // try calling apiMethod 3 times, waiting 200 ms between each retry
       * async.retry({times: 3, interval: 200}, apiMethod, function(err, result) {
       *     // do something with the result
       * });
       *
       * // try calling apiMethod 10 times with exponential backoff
       * // (i.e. intervals of 100, 200, 400, 800, 1600, ... milliseconds)
       * async.retry({
       *   times: 10,
       *   interval: function(retryCount) {
       *     return 50 * Math.pow(2, retryCount);
       *   }
       * }, apiMethod, function(err, result) {
       *     // do something with the result
       * });
       *
       * // try calling apiMethod the default 5 times no delay between each retry
       * async.retry(apiMethod, function(err, result) {
       *     // do something with the result
       * });
       *
       * // try calling apiMethod only when error condition satisfies, all other
       * // errors will abort the retry control flow and return to final callback
       * async.retry({
       *   errorFilter: function(err) {
       *     return err.message === 'Temporary error'; // only retry on a specific error
       *   }
       * }, apiMethod, function(err, result) {
       *     // do something with the result
       * });
       *
       * // It can also be embedded within other control flow functions to retry
       * // individual methods that are not as reliable, like this:
       * async.auto({
       *     users: api.getUsers.bind(api),
       *     payments: async.retryable(3, api.getPayments.bind(api))
       * }, function(err, results) {
       *     // do something with the results
       * });
       *
       */
      function retry(opts, task, callback) {
        var DEFAULT_TIMES = 5;
        var DEFAULT_INTERVAL = 0;

        var options = {
          times: DEFAULT_TIMES,
          intervalFunc: constant$1(DEFAULT_INTERVAL)
        };

        function parseTimes(acc, t) {
          if ((typeof t === "undefined" ? "undefined" : _typeof(t)) === 'object') {
            acc.times = +t.times || DEFAULT_TIMES;

            acc.intervalFunc = typeof t.interval === 'function' ? t.interval : constant$1(+t.interval || DEFAULT_INTERVAL);

            acc.errorFilter = t.errorFilter;
          } else if (typeof t === 'number' || typeof t === 'string') {
            acc.times = +t || DEFAULT_TIMES;
          } else {
            throw new Error("Invalid arguments for async.retry");
          }
        }

        if (arguments.length < 3 && typeof opts === 'function') {
          callback = task || noop;
          task = opts;
        } else {
          parseTimes(options, opts);
          callback = callback || noop;
        }

        if (typeof task !== 'function') {
          throw new Error("Invalid arguments for async.retry");
        }

        var _task = wrapAsync(task);

        var attempt = 1;
        function retryAttempt() {
          _task(function (err) {
            if (err && attempt++ < options.times && (typeof options.errorFilter != 'function' || options.errorFilter(err))) {
              setTimeout(retryAttempt, options.intervalFunc(attempt));
            } else {
              callback.apply(null, arguments);
            }
          });
        }

        retryAttempt();
      }

      /**
       * A close relative of [`retry`]{@link module:ControlFlow.retry}.  This method
       * wraps a task and makes it retryable, rather than immediately calling it
       * with retries.
       *
       * @name retryable
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.retry]{@link module:ControlFlow.retry}
       * @category Control Flow
       * @param {Object|number} [opts = {times: 5, interval: 0}| 5] - optional
       * options, exactly the same as from `retry`
       * @param {AsyncFunction} task - the asynchronous function to wrap.
       * This function will be passed any arguments passed to the returned wrapper.
       * Invoked with (...args, callback).
       * @returns {AsyncFunction} The wrapped function, which when invoked, will
       * retry on an error, based on the parameters specified in `opts`.
       * This function will accept the same parameters as `task`.
       * @example
       *
       * async.auto({
       *     dep1: async.retryable(3, getFromFlakyService),
       *     process: ["dep1", async.retryable(3, function (results, cb) {
       *         maybeProcessData(results.dep1, cb);
       *     })]
       * }, callback);
       */
      var retryable = function retryable(opts, task) {
        if (!task) {
          task = opts;
          opts = null;
        }
        var _task = wrapAsync(task);
        return initialParams(function (args, callback) {
          function taskFn(cb) {
            _task.apply(null, args.concat(cb));
          }

          if (opts) retry(opts, taskFn, callback);else retry(taskFn, callback);
        });
      };

      /**
       * Run the functions in the `tasks` collection in series, each one running once
       * the previous function has completed. If any functions in the series pass an
       * error to its callback, no more functions are run, and `callback` is
       * immediately called with the value of the error. Otherwise, `callback`
       * receives an array of results when `tasks` have completed.
       *
       * It is also possible to use an object instead of an array. Each property will
       * be run as a function, and the results will be passed to the final `callback`
       * as an object instead of an array. This can be a more readable way of handling
       *  results from {@link async.series}.
       *
       * **Note** that while many implementations preserve the order of object
       * properties, the [ECMAScript Language Specification](http://www.ecma-international.org/ecma-262/5.1/#sec-8.6)
       * explicitly states that
       *
       * > The mechanics and order of enumerating the properties is not specified.
       *
       * So if you rely on the order in which your series of functions are executed,
       * and want this to work on all platforms, consider using an array.
       *
       * @name series
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {Array|Iterable|Object} tasks - A collection containing
       * [async functions]{@link AsyncFunction} to run in series.
       * Each function can complete with any number of optional `result` values.
       * @param {Function} [callback] - An optional callback to run once all the
       * functions have completed. This function gets a results array (or object)
       * containing all the result arguments passed to the `task` callbacks. Invoked
       * with (err, result).
       * @example
       * async.series([
       *     function(callback) {
       *         // do some stuff ...
       *         callback(null, 'one');
       *     },
       *     function(callback) {
       *         // do some more stuff ...
       *         callback(null, 'two');
       *     }
       * ],
       * // optional callback
       * function(err, results) {
       *     // results is now equal to ['one', 'two']
       * });
       *
       * async.series({
       *     one: function(callback) {
       *         setTimeout(function() {
       *             callback(null, 1);
       *         }, 200);
       *     },
       *     two: function(callback){
       *         setTimeout(function() {
       *             callback(null, 2);
       *         }, 100);
       *     }
       * }, function(err, results) {
       *     // results is now equal to: {one: 1, two: 2}
       * });
       */
      function series(tasks, callback) {
        _parallel(eachOfSeries, tasks, callback);
      }

      /**
       * Returns `true` if at least one element in the `coll` satisfies an async test.
       * If any iteratee call returns `true`, the main `callback` is immediately
       * called.
       *
       * @name some
       * @static
       * @memberOf module:Collections
       * @method
       * @alias any
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async truth test to apply to each item
       * in the collections in parallel.
       * The iteratee should complete with a boolean `result` value.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called as soon as any
       * iteratee returns `true`, or after all the iteratee functions have finished.
       * Result will be either `true` or `false` depending on the values of the async
       * tests. Invoked with (err, result).
       * @example
       *
       * async.some(['file1','file2','file3'], function(filePath, callback) {
       *     fs.access(filePath, function(err) {
       *         callback(null, !err)
       *     });
       * }, function(err, result) {
       *     // if result is true then at least one of the files exists
       * });
       */
      var some = doParallel(_createTester(Boolean, identity));

      /**
       * The same as [`some`]{@link module:Collections.some} but runs a maximum of `limit` async operations at a time.
       *
       * @name someLimit
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.some]{@link module:Collections.some}
       * @alias anyLimit
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - An async truth test to apply to each item
       * in the collections in parallel.
       * The iteratee should complete with a boolean `result` value.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called as soon as any
       * iteratee returns `true`, or after all the iteratee functions have finished.
       * Result will be either `true` or `false` depending on the values of the async
       * tests. Invoked with (err, result).
       */
      var someLimit = doParallelLimit(_createTester(Boolean, identity));

      /**
       * The same as [`some`]{@link module:Collections.some} but runs only a single async operation at a time.
       *
       * @name someSeries
       * @static
       * @memberOf module:Collections
       * @method
       * @see [async.some]{@link module:Collections.some}
       * @alias anySeries
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async truth test to apply to each item
       * in the collections in series.
       * The iteratee should complete with a boolean `result` value.
       * Invoked with (item, callback).
       * @param {Function} [callback] - A callback which is called as soon as any
       * iteratee returns `true`, or after all the iteratee functions have finished.
       * Result will be either `true` or `false` depending on the values of the async
       * tests. Invoked with (err, result).
       */
      var someSeries = doLimit(someLimit, 1);

      /**
       * Sorts a list by the results of running each `coll` value through an async
       * `iteratee`.
       *
       * @name sortBy
       * @static
       * @memberOf module:Collections
       * @method
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {AsyncFunction} iteratee - An async function to apply to each item in
       * `coll`.
       * The iteratee should complete with a value to use as the sort criteria as
       * its `result`.
       * Invoked with (item, callback).
       * @param {Function} callback - A callback which is called after all the
       * `iteratee` functions have finished, or an error occurs. Results is the items
       * from the original `coll` sorted by the values returned by the `iteratee`
       * calls. Invoked with (err, results).
       * @example
       *
       * async.sortBy(['file1','file2','file3'], function(file, callback) {
       *     fs.stat(file, function(err, stats) {
       *         callback(err, stats.mtime);
       *     });
       * }, function(err, results) {
       *     // results is now the original array of files sorted by
       *     // modified date
       * });
       *
       * // By modifying the callback parameter the
       * // sorting order can be influenced:
       *
       * // ascending order
       * async.sortBy([1,9,3,5], function(x, callback) {
       *     callback(null, x);
       * }, function(err,result) {
       *     // result callback
       * });
       *
       * // descending order
       * async.sortBy([1,9,3,5], function(x, callback) {
       *     callback(null, x*-1);    //<- x*-1 instead of x, turns the order around
       * }, function(err,result) {
       *     // result callback
       * });
       */
      function sortBy(coll, iteratee, callback) {
        var _iteratee = wrapAsync(iteratee);
        map(coll, function (x, callback) {
          _iteratee(x, function (err, criteria) {
            if (err) return callback(err);
            callback(null, { value: x, criteria: criteria });
          });
        }, function (err, results) {
          if (err) return callback(err);
          callback(null, arrayMap(results.sort(comparator), baseProperty('value')));
        });

        function comparator(left, right) {
          var a = left.criteria,
              b = right.criteria;
          return a < b ? -1 : a > b ? 1 : 0;
        }
      }

      /**
       * Sets a time limit on an asynchronous function. If the function does not call
       * its callback within the specified milliseconds, it will be called with a
       * timeout error. The code property for the error object will be `'ETIMEDOUT'`.
       *
       * @name timeout
       * @static
       * @memberOf module:Utils
       * @method
       * @category Util
       * @param {AsyncFunction} asyncFn - The async function to limit in time.
       * @param {number} milliseconds - The specified time limit.
       * @param {*} [info] - Any variable you want attached (`string`, `object`, etc)
       * to timeout Error for more information..
       * @returns {AsyncFunction} Returns a wrapped function that can be used with any
       * of the control flow functions.
       * Invoke this function with the same parameters as you would `asyncFunc`.
       * @example
       *
       * function myFunction(foo, callback) {
       *     doAsyncTask(foo, function(err, data) {
       *         // handle errors
       *         if (err) return callback(err);
       *
       *         // do some stuff ...
       *
       *         // return processed data
       *         return callback(null, data);
       *     });
       * }
       *
       * var wrapped = async.timeout(myFunction, 1000);
       *
       * // call `wrapped` as you would `myFunction`
       * wrapped({ bar: 'bar' }, function(err, data) {
       *     // if `myFunction` takes < 1000 ms to execute, `err`
       *     // and `data` will have their expected values
       *
       *     // else `err` will be an Error with the code 'ETIMEDOUT'
       * });
       */
      function timeout(asyncFn, milliseconds, info) {
        var fn = wrapAsync(asyncFn);

        return initialParams(function (args, callback) {
          var timedOut = false;
          var timer;

          function timeoutCallback() {
            var name = asyncFn.name || 'anonymous';
            var error = new Error('Callback function "' + name + '" timed out.');
            error.code = 'ETIMEDOUT';
            if (info) {
              error.info = info;
            }
            timedOut = true;
            callback(error);
          }

          args.push(function () {
            if (!timedOut) {
              callback.apply(null, arguments);
              clearTimeout(timer);
            }
          });

          // setup timer and call original function
          timer = setTimeout(timeoutCallback, milliseconds);
          fn.apply(null, args);
        });
      }

      /* Built-in method references for those with the same name as other `lodash` methods. */
      var nativeCeil = Math.ceil;
      var nativeMax = Math.max;

      /**
       * The base implementation of `_.range` and `_.rangeRight` which doesn't
       * coerce arguments.
       *
       * @private
       * @param {number} start The start of the range.
       * @param {number} end The end of the range.
       * @param {number} step The value to increment or decrement by.
       * @param {boolean} [fromRight] Specify iterating from right to left.
       * @returns {Array} Returns the range of numbers.
       */
      function baseRange(start, end, step, fromRight) {
        var index = -1,
            length = nativeMax(nativeCeil((end - start) / (step || 1)), 0),
            result = Array(length);

        while (length--) {
          result[fromRight ? length : ++index] = start;
          start += step;
        }
        return result;
      }

      /**
       * The same as [times]{@link module:ControlFlow.times} but runs a maximum of `limit` async operations at a
       * time.
       *
       * @name timesLimit
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.times]{@link module:ControlFlow.times}
       * @category Control Flow
       * @param {number} count - The number of times to run the function.
       * @param {number} limit - The maximum number of async operations at a time.
       * @param {AsyncFunction} iteratee - The async function to call `n` times.
       * Invoked with the iteration index and a callback: (n, next).
       * @param {Function} callback - see [async.map]{@link module:Collections.map}.
       */
      function timeLimit(count, limit, iteratee, callback) {
        var _iteratee = wrapAsync(iteratee);
        mapLimit(baseRange(0, count, 1), limit, _iteratee, callback);
      }

      /**
       * Calls the `iteratee` function `n` times, and accumulates results in the same
       * manner you would use with [map]{@link module:Collections.map}.
       *
       * @name times
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.map]{@link module:Collections.map}
       * @category Control Flow
       * @param {number} n - The number of times to run the function.
       * @param {AsyncFunction} iteratee - The async function to call `n` times.
       * Invoked with the iteration index and a callback: (n, next).
       * @param {Function} callback - see {@link module:Collections.map}.
       * @example
       *
       * // Pretend this is some complicated async factory
       * var createUser = function(id, callback) {
       *     callback(null, {
       *         id: 'user' + id
       *     });
       * };
       *
       * // generate 5 users
       * async.times(5, function(n, next) {
       *     createUser(n, function(err, user) {
       *         next(err, user);
       *     });
       * }, function(err, users) {
       *     // we should now have 5 users
       * });
       */
      var times = doLimit(timeLimit, Infinity);

      /**
       * The same as [times]{@link module:ControlFlow.times} but runs only a single async operation at a time.
       *
       * @name timesSeries
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.times]{@link module:ControlFlow.times}
       * @category Control Flow
       * @param {number} n - The number of times to run the function.
       * @param {AsyncFunction} iteratee - The async function to call `n` times.
       * Invoked with the iteration index and a callback: (n, next).
       * @param {Function} callback - see {@link module:Collections.map}.
       */
      var timesSeries = doLimit(timeLimit, 1);

      /**
       * A relative of `reduce`.  Takes an Object or Array, and iterates over each
       * element in series, each step potentially mutating an `accumulator` value.
       * The type of the accumulator defaults to the type of collection passed in.
       *
       * @name transform
       * @static
       * @memberOf module:Collections
       * @method
       * @category Collection
       * @param {Array|Iterable|Object} coll - A collection to iterate over.
       * @param {*} [accumulator] - The initial state of the transform.  If omitted,
       * it will default to an empty Object or Array, depending on the type of `coll`
       * @param {AsyncFunction} iteratee - A function applied to each item in the
       * collection that potentially modifies the accumulator.
       * Invoked with (accumulator, item, key, callback).
       * @param {Function} [callback] - A callback which is called after all the
       * `iteratee` functions have finished. Result is the transformed accumulator.
       * Invoked with (err, result).
       * @example
       *
       * async.transform([1,2,3], function(acc, item, index, callback) {
       *     // pointless async:
       *     process.nextTick(function() {
       *         acc.push(item * 2)
       *         callback(null)
       *     });
       * }, function(err, result) {
       *     // result is now equal to [2, 4, 6]
       * });
       *
       * @example
       *
       * async.transform({a: 1, b: 2, c: 3}, function (obj, val, key, callback) {
       *     setImmediate(function () {
       *         obj[key] = val * 2;
       *         callback();
       *     })
       * }, function (err, result) {
       *     // result is equal to {a: 2, b: 4, c: 6}
       * })
       */
      function transform(coll, accumulator, iteratee, callback) {
        if (arguments.length <= 3) {
          callback = iteratee;
          iteratee = accumulator;
          accumulator = isArray(coll) ? [] : {};
        }
        callback = once$$1(callback || noop);
        var _iteratee = wrapAsync(iteratee);

        eachOf(coll, function (v, k, cb) {
          _iteratee(accumulator, v, k, cb);
        }, function (err) {
          callback(err, accumulator);
        });
      }

      /**
       * It runs each task in series but stops whenever any of the functions were
       * successful. If one of the tasks were successful, the `callback` will be
       * passed the result of the successful task. If all tasks fail, the callback
       * will be passed the error and result (if any) of the final attempt.
       *
       * @name tryEach
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {Array|Iterable|Object} tasks - A collection containing functions to
       * run, each function is passed a `callback(err, result)` it must call on
       * completion with an error `err` (which can be `null`) and an optional `result`
       * value.
       * @param {Function} [callback] - An optional callback which is called when one
       * of the tasks has succeeded, or all have failed. It receives the `err` and
       * `result` arguments of the last attempt at completing the `task`. Invoked with
       * (err, results).
       * @example
       * async.try([
       *     function getDataFromFirstWebsite(callback) {
       *         // Try getting the data from the first website
       *         callback(err, data);
       *     },
       *     function getDataFromSecondWebsite(callback) {
       *         // First website failed,
       *         // Try getting the data from the backup website
       *         callback(err, data);
       *     }
       * ],
       * // optional callback
       * function(err, results) {
       *     Now do something with the data.
       * });
       *
       */
      function tryEach(tasks, callback) {
        var error = null;
        var result;
        callback = callback || noop;
        eachSeries(tasks, function (task, callback) {
          wrapAsync(task)(function (err, res /*, ...args*/) {
            if (arguments.length > 2) {
              result = slice(arguments, 1);
            } else {
              result = res;
            }
            error = err;
            callback(!err);
          });
        }, function () {
          callback(error, result);
        });
      }

      /**
       * Undoes a [memoize]{@link module:Utils.memoize}d function, reverting it to the original,
       * unmemoized form. Handy for testing.
       *
       * @name unmemoize
       * @static
       * @memberOf module:Utils
       * @method
       * @see [async.memoize]{@link module:Utils.memoize}
       * @category Util
       * @param {AsyncFunction} fn - the memoized function
       * @returns {AsyncFunction} a function that calls the original unmemoized function
       */
      function unmemoize(fn) {
        return function () {
          return (fn.unmemoized || fn).apply(null, arguments);
        };
      }

      /**
       * Repeatedly call `iteratee`, while `test` returns `true`. Calls `callback` when
       * stopped, or an error occurs.
       *
       * @name whilst
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {Function} test - synchronous truth test to perform before each
       * execution of `iteratee`. Invoked with ().
       * @param {AsyncFunction} iteratee - An async function which is called each time
       * `test` passes. Invoked with (callback).
       * @param {Function} [callback] - A callback which is called after the test
       * function has failed and repeated execution of `iteratee` has stopped. `callback`
       * will be passed an error and any arguments passed to the final `iteratee`'s
       * callback. Invoked with (err, [results]);
       * @returns undefined
       * @example
       *
       * var count = 0;
       * async.whilst(
       *     function() { return count < 5; },
       *     function(callback) {
       *         count++;
       *         setTimeout(function() {
       *             callback(null, count);
       *         }, 1000);
       *     },
       *     function (err, n) {
       *         // 5 seconds have passed, n = 5
       *     }
       * );
       */
      function whilst(test, iteratee, callback) {
        callback = onlyOnce(callback || noop);
        var _iteratee = wrapAsync(iteratee);
        if (!test()) return callback(null);
        var next = function next(err /*, ...args*/) {
          if (err) return callback(err);
          if (test()) return _iteratee(next);
          var args = slice(arguments, 1);
          callback.apply(null, [null].concat(args));
        };
        _iteratee(next);
      }

      /**
       * Repeatedly call `iteratee` until `test` returns `true`. Calls `callback` when
       * stopped, or an error occurs. `callback` will be passed an error and any
       * arguments passed to the final `iteratee`'s callback.
       *
       * The inverse of [whilst]{@link module:ControlFlow.whilst}.
       *
       * @name until
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @see [async.whilst]{@link module:ControlFlow.whilst}
       * @category Control Flow
       * @param {Function} test - synchronous truth test to perform before each
       * execution of `iteratee`. Invoked with ().
       * @param {AsyncFunction} iteratee - An async function which is called each time
       * `test` fails. Invoked with (callback).
       * @param {Function} [callback] - A callback which is called after the test
       * function has passed and repeated execution of `iteratee` has stopped. `callback`
       * will be passed an error and any arguments passed to the final `iteratee`'s
       * callback. Invoked with (err, [results]);
       */
      function until(test, iteratee, callback) {
        whilst(function () {
          return !test.apply(this, arguments);
        }, iteratee, callback);
      }

      /**
       * Runs the `tasks` array of functions in series, each passing their results to
       * the next in the array. However, if any of the `tasks` pass an error to their
       * own callback, the next function is not executed, and the main `callback` is
       * immediately called with the error.
       *
       * @name waterfall
       * @static
       * @memberOf module:ControlFlow
       * @method
       * @category Control Flow
       * @param {Array} tasks - An array of [async functions]{@link AsyncFunction}
       * to run.
       * Each function should complete with any number of `result` values.
       * The `result` values will be passed as arguments, in order, to the next task.
       * @param {Function} [callback] - An optional callback to run once all the
       * functions have completed. This will be passed the results of the last task's
       * callback. Invoked with (err, [results]).
       * @returns undefined
       * @example
       *
       * async.waterfall([
       *     function(callback) {
       *         callback(null, 'one', 'two');
       *     },
       *     function(arg1, arg2, callback) {
       *         // arg1 now equals 'one' and arg2 now equals 'two'
       *         callback(null, 'three');
       *     },
       *     function(arg1, callback) {
       *         // arg1 now equals 'three'
       *         callback(null, 'done');
       *     }
       * ], function (err, result) {
       *     // result now equals 'done'
       * });
       *
       * // Or, with named functions:
       * async.waterfall([
       *     myFirstFunction,
       *     mySecondFunction,
       *     myLastFunction,
       * ], function (err, result) {
       *     // result now equals 'done'
       * });
       * function myFirstFunction(callback) {
       *     callback(null, 'one', 'two');
       * }
       * function mySecondFunction(arg1, arg2, callback) {
       *     // arg1 now equals 'one' and arg2 now equals 'two'
       *     callback(null, 'three');
       * }
       * function myLastFunction(arg1, callback) {
       *     // arg1 now equals 'three'
       *     callback(null, 'done');
       * }
       */
      var waterfall = function waterfall(tasks, callback) {
        callback = once$$1(callback || noop);
        if (!isArray(tasks)) return callback(new Error('First argument to waterfall must be an array of functions'));
        if (!tasks.length) return callback();
        var taskIndex = 0;

        function nextTask(args) {
          var task = wrapAsync(tasks[taskIndex++]);
          args.push(onlyOnce(next));
          task.apply(null, args);
        }

        function next(err /*, ...args*/) {
          if (err || taskIndex === tasks.length) {
            return callback.apply(null, arguments);
          }
          nextTask(slice(arguments, 1));
        }

        nextTask([]);
      };

      /**
       * An "async function" in the context of Async is an asynchronous function with
       * a variable number of parameters, with the final parameter being a callback.
       * (`function (arg1, arg2, ..., callback) {}`)
       * The final callback is of the form `callback(err, results...)`, which must be
       * called once the function is completed.  The callback should be called with a
       * Error as its first argument to signal that an error occurred.
       * Otherwise, if no error occurred, it should be called with `null` as the first
       * argument, and any additional `result` arguments that may apply, to signal
       * successful completion.
       * The callback must be called exactly once, ideally on a later tick of the
       * JavaScript event loop.
       *
       * This type of function is also referred to as a "Node-style async function",
       * or a "continuation passing-style function" (CPS). Most of the methods of this
       * library are themselves CPS/Node-style async functions, or functions that
       * return CPS/Node-style async functions.
       *
       * Wherever we accept a Node-style async function, we also directly accept an
       * [ES2017 `async` function]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function}.
       * In this case, the `async` function will not be passed a final callback
       * argument, and any thrown error will be used as the `err` argument of the
       * implicit callback, and the return value will be used as the `result` value.
       * (i.e. a `rejected` of the returned Promise becomes the `err` callback
       * argument, and a `resolved` value becomes the `result`.)
       *
       * Note, due to JavaScript limitations, we can only detect native `async`
       * functions and not transpilied implementations.
       * Your environment must have `async`/`await` support for this to work.
       * (e.g. Node > v7.6, or a recent version of a modern browser).
       * If you are using `async` functions through a transpiler (e.g. Babel), you
       * must still wrap the function with [asyncify]{@link module:Utils.asyncify},
       * because the `async function` will be compiled to an ordinary function that
       * returns a promise.
       *
       * @typedef {Function} AsyncFunction
       * @static
       */

      /**
       * Async is a utility module which provides straight-forward, powerful functions
       * for working with asynchronous JavaScript. Although originally designed for
       * use with [Node.js](http://nodejs.org) and installable via
       * `npm install --save async`, it can also be used directly in the browser.
       * @module async
       * @see AsyncFunction
       */

      /**
       * A collection of `async` functions for manipulating collections, such as
       * arrays and objects.
       * @module Collections
       */

      /**
       * A collection of `async` functions for controlling the flow through a script.
       * @module ControlFlow
       */

      /**
       * A collection of `async` utility functions.
       * @module Utils
       */

      var index = {
        applyEach: applyEach,
        applyEachSeries: applyEachSeries,
        apply: apply,
        asyncify: asyncify,
        auto: auto,
        autoInject: autoInject,
        cargo: cargo,
        compose: compose,
        concat: concat,
        concatLimit: concatLimit,
        concatSeries: concatSeries,
        constant: constant,
        detect: detect,
        detectLimit: detectLimit,
        detectSeries: detectSeries,
        dir: dir,
        doDuring: doDuring,
        doUntil: doUntil,
        doWhilst: doWhilst,
        during: during,
        each: eachLimit,
        eachLimit: eachLimit$1,
        eachOf: eachOf,
        eachOfLimit: eachOfLimit,
        eachOfSeries: eachOfSeries,
        eachSeries: eachSeries,
        ensureAsync: ensureAsync,
        every: every,
        everyLimit: everyLimit,
        everySeries: everySeries,
        filter: filter,
        filterLimit: filterLimit,
        filterSeries: filterSeries,
        forever: forever,
        groupBy: groupBy,
        groupByLimit: groupByLimit,
        groupBySeries: groupBySeries,
        log: log,
        map: map,
        mapLimit: mapLimit,
        mapSeries: mapSeries,
        mapValues: mapValues,
        mapValuesLimit: mapValuesLimit,
        mapValuesSeries: mapValuesSeries,
        memoize: memoize,
        nextTick: nextTick$$1,
        parallel: parallelLimit,
        parallelLimit: parallelLimit$1,
        priorityQueue: priorityQueue,
        queue: queue$1,
        race: race,
        reduce: reduce,
        reduceRight: reduceRight,
        reflect: reflect,
        reflectAll: reflectAll,
        reject: reject,
        rejectLimit: rejectLimit,
        rejectSeries: rejectSeries,
        retry: retry,
        retryable: retryable,
        seq: seq,
        series: series,
        setImmediate: setImmediate$1,
        some: some,
        someLimit: someLimit,
        someSeries: someSeries,
        sortBy: sortBy,
        timeout: timeout,
        times: times,
        timesLimit: timeLimit,
        timesSeries: timesSeries,
        transform: transform,
        tryEach: tryEach,
        unmemoize: unmemoize,
        until: until,
        waterfall: waterfall,
        whilst: whilst,

        // aliases
        all: every,
        any: some,
        forEach: eachLimit,
        forEachSeries: eachSeries,
        forEachLimit: eachLimit$1,
        forEachOf: eachOf,
        forEachOfSeries: eachOfSeries,
        forEachOfLimit: eachOfLimit,
        inject: reduce,
        foldl: reduce,
        foldr: reduceRight,
        select: filter,
        selectLimit: filterLimit,
        selectSeries: filterSeries,
        wrapSync: asyncify
      };

      exports['default'] = index;
      exports.applyEach = applyEach;
      exports.applyEachSeries = applyEachSeries;
      exports.apply = apply;
      exports.asyncify = asyncify;
      exports.auto = auto;
      exports.autoInject = autoInject;
      exports.cargo = cargo;
      exports.compose = compose;
      exports.concat = concat;
      exports.concatLimit = concatLimit;
      exports.concatSeries = concatSeries;
      exports.constant = constant;
      exports.detect = detect;
      exports.detectLimit = detectLimit;
      exports.detectSeries = detectSeries;
      exports.dir = dir;
      exports.doDuring = doDuring;
      exports.doUntil = doUntil;
      exports.doWhilst = doWhilst;
      exports.during = during;
      exports.each = eachLimit;
      exports.eachLimit = eachLimit$1;
      exports.eachOf = eachOf;
      exports.eachOfLimit = eachOfLimit;
      exports.eachOfSeries = eachOfSeries;
      exports.eachSeries = eachSeries;
      exports.ensureAsync = ensureAsync;
      exports.every = every;
      exports.everyLimit = everyLimit;
      exports.everySeries = everySeries;
      exports.filter = filter;
      exports.filterLimit = filterLimit;
      exports.filterSeries = filterSeries;
      exports.forever = forever;
      exports.groupBy = groupBy;
      exports.groupByLimit = groupByLimit;
      exports.groupBySeries = groupBySeries;
      exports.log = log;
      exports.map = map;
      exports.mapLimit = mapLimit;
      exports.mapSeries = mapSeries;
      exports.mapValues = mapValues;
      exports.mapValuesLimit = mapValuesLimit;
      exports.mapValuesSeries = mapValuesSeries;
      exports.memoize = memoize;
      exports.nextTick = nextTick$$1;
      exports.parallel = parallelLimit;
      exports.parallelLimit = parallelLimit$1;
      exports.priorityQueue = priorityQueue;
      exports.queue = queue$1;
      exports.race = race;
      exports.reduce = reduce;
      exports.reduceRight = reduceRight;
      exports.reflect = reflect;
      exports.reflectAll = reflectAll;
      exports.reject = reject;
      exports.rejectLimit = rejectLimit;
      exports.rejectSeries = rejectSeries;
      exports.retry = retry;
      exports.retryable = retryable;
      exports.seq = seq;
      exports.series = series;
      exports.setImmediate = setImmediate$1;
      exports.some = some;
      exports.someLimit = someLimit;
      exports.someSeries = someSeries;
      exports.sortBy = sortBy;
      exports.timeout = timeout;
      exports.times = times;
      exports.timesLimit = timeLimit;
      exports.timesSeries = timesSeries;
      exports.transform = transform;
      exports.tryEach = tryEach;
      exports.unmemoize = unmemoize;
      exports.until = until;
      exports.waterfall = waterfall;
      exports.whilst = whilst;
      exports.all = every;
      exports.allLimit = everyLimit;
      exports.allSeries = everySeries;
      exports.any = some;
      exports.anyLimit = someLimit;
      exports.anySeries = someSeries;
      exports.find = detect;
      exports.findLimit = detectLimit;
      exports.findSeries = detectSeries;
      exports.forEach = eachLimit;
      exports.forEachSeries = eachSeries;
      exports.forEachLimit = eachLimit$1;
      exports.forEachOf = eachOf;
      exports.forEachOfSeries = eachOfSeries;
      exports.forEachOfLimit = eachOfLimit;
      exports.inject = reduce;
      exports.foldl = reduce;
      exports.foldr = reduceRight;
      exports.select = filter;
      exports.selectLimit = filterLimit;
      exports.selectSeries = filterSeries;
      exports.wrapSync = asyncify;

      Object.defineProperty(exports, '__esModule', { value: true });
    });
  });

  var empty = {};

  var empty$1 = Object.freeze({
    default: empty
  });

  // Copyright Joyent, Inc. and other Node contributors.
  //
  // Permission is hereby granted, free of charge, to any person obtaining a
  // copy of this software and associated documentation files (the
  // "Software"), to deal in the Software without restriction, including
  // without limitation the rights to use, copy, modify, merge, publish,
  // distribute, sublicense, and/or sell copies of the Software, and to permit
  // persons to whom the Software is furnished to do so, subject to the
  // following conditions:
  //
  // The above copyright notice and this permission notice shall be included
  // in all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  // USE OR OTHER DEALINGS IN THE SOFTWARE.

  // resolves . and .. elements in a path array with directory names there
  // must be no slashes, empty elements, or device names (c:\) in the array
  // (so also no leading and trailing slashes - it does not distinguish
  // relative and absolute paths)
  function normalizeArray(parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === '.') {
        parts.splice(i, 1);
      } else if (last === '..') {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift('..');
      }
    }

    return parts;
  }

  // Split a filename into [root, dir, basename, ext], unix version
  // 'root' is just a slash, or nothing.
  var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  var splitPath = function splitPath(filename) {
    return splitPathRe.exec(filename).slice(1);
  };

  // path.resolve([from ...], to)
  // posix version
  function resolve() {
    var resolvedPath = '',
        resolvedAbsolute = false;

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = i >= 0 ? arguments[i] : '/';

      // Skip empty and invalid entries
      if (typeof path !== 'string') {
        throw new TypeError('Arguments to path.resolve must be strings');
      } else if (!path) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charAt(0) === '/';
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function (p) {
      return !!p;
    }), !resolvedAbsolute).join('/');

    return (resolvedAbsolute ? '/' : '') + resolvedPath || '.';
  }

  // path.normalize(path)
  // posix version
  function normalize(path) {
    var isPathAbsolute = isAbsolute(path),
        trailingSlash = substr(path, -1) === '/';

    // Normalize the path
    path = normalizeArray(filter(path.split('/'), function (p) {
      return !!p;
    }), !isPathAbsolute).join('/');

    if (!path && !isPathAbsolute) {
      path = '.';
    }
    if (path && trailingSlash) {
      path += '/';
    }

    return (isPathAbsolute ? '/' : '') + path;
  }

  // posix version
  function isAbsolute(path) {
    return path.charAt(0) === '/';
  }

  // posix version
  function join() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return normalize(filter(paths, function (p, index) {
      if (typeof p !== 'string') {
        throw new TypeError('Arguments to path.join must be strings');
      }
      return p;
    }).join('/'));
  }

  // path.relative(from, to)
  // posix version
  function relative(from, to) {
    from = resolve(from).substr(1);
    to = resolve(to).substr(1);

    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== '') break;
      }

      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== '') break;
      }

      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }

    var fromParts = trim(from.split('/'));
    var toParts = trim(to.split('/'));

    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }

    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push('..');
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength));

    return outputParts.join('/');
  }

  var sep = '/';
  var delimiter = ':';

  function dirname(path) {
    var result = splitPath(path),
        root = result[0],
        dir = result[1];

    if (!root && !dir) {
      // No dirname whatsoever
      return '.';
    }

    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1);
    }

    return root + dir;
  }

  function basename(path, ext) {
    var f = splitPath(path)[2];
    // TODO: make this comparison case-insensitive on windows?
    if (ext && f.substr(-1 * ext.length) === ext) {
      f = f.substr(0, f.length - ext.length);
    }
    return f;
  }

  function extname(path) {
    return splitPath(path)[3];
  }
  var path = {
    extname: extname,
    basename: basename,
    dirname: dirname,
    sep: sep,
    delimiter: delimiter,
    relative: relative,
    join: join,
    isAbsolute: isAbsolute,
    normalize: normalize,
    resolve: resolve
  };
  function filter(xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
      if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
  }

  // String.prototype.substr - negative index don't work in IE8
  var substr = 'ab'.substr(-1) === 'b' ? function (str, start, len) {
    return str.substr(start, len);
  } : function (str, start, len) {
    if (start < 0) start = str.length + start;
    return str.substr(start, len);
  };

  var path$1 = Object.freeze({
    resolve: resolve,
    normalize: normalize,
    isAbsolute: isAbsolute,
    join: join,
    relative: relative,
    sep: sep,
    delimiter: delimiter,
    dirname: dirname,
    basename: basename,
    extname: extname,
    default: path
  });

  var fs = empty$1 && empty || empty$1;

  var path$2 = path$1 && path || path$1;

  var require$$0 = _package$1 && _package || _package$1;

  var isType$1;
  var kindaFile;
  var MarkovChain$2;

  isType$1 = function isType$1(t) {
    return Object.prototype.toString.call(t).slice(8, -1).toLowerCase();
  };

  kindaFile = function kindaFile(file) {
    return file.indexOf('.' + path$2.sep) === 0 || file.indexOf(path$2.sep) === 0;
  };

  MarkovChain$2 = function MarkovChain$2(args) {
    if (!args) {
      args = {};
    }
    this.wordBank = {};
    this.sentence = '';
    this.files = [];
    if (args.files) {
      return this.use(args.files);
    }

    this.startFn = function (wordList) {
      var k = Object.keys(wordList);
      var l = k.length;

      return k[~~(Math.random() * l)];
    };

    this.endFn = function () {
      return this.sentence.split(' ').length > 7;
    };

    return this;
  };

  MarkovChain$2.prototype.VERSION = require$$0.version;

  MarkovChain$2.prototype.use = function (files) {
    if (isType$1(files) === 'array') {
      this.files = files;
    } else if (isType$1(files) === 'string') {
      this.files = [files];
    } else {
      throw new Error('Need to pass a string or array for use()');
    }
    return this;
  };

  MarkovChain$2.prototype.readFile = function (file) {
    return function (callback) {
      fs.readFile(file, 'utf8', function (err, data) {
        if (err) {
          // if the file does not exist,
          // if `file` starts with ./ or /, assuming trying to be a file
          // if `file` has a '.', and the string after that has no space, assume file
          if (err.code === 'ENOENT' && !kindaFile(file)) {
            return callback(null, file);
          }
          return callback(err);
        }
        nextTick(function () {
          callback(null, data);
        });
      });
    };
  };

  MarkovChain$2.prototype.countTotal = function (word) {
    var total = 0,
        prop;

    for (prop in this.wordBank[word]) {
      if (this.wordBank[word].hasOwnProperty(prop)) {
        total += this.wordBank[word][prop];
      }
    }
    return total;
  };

  MarkovChain$2.prototype.process = function (callback) {
    var readFiles = [];

    this.files.forEach(function (file) {
      readFiles.push(this.readFile(file));
    }.bind(this));

    async.parallel(readFiles, function (err, retFiles) {
      var words, curWord;
      this.parseFile(retFiles.toString());

      curWord = this.startFn(this.wordBank);

      this.sentence = curWord;

      while (this.wordBank[curWord] && !this.endFn()) {
        curWord = index$2(this.wordBank[curWord]);
        this.sentence += ' ' + curWord;
      }
      callback(null, this.sentence.trim());
    }.bind(this));

    return this;
  };

  MarkovChain$2.prototype.parseFile = function (file) {
    // splits sentences based on either an end line
    // or a period (followed by a space)
    file.split(/(?:\. |\n)/ig).forEach(function (lines) {
      var curWord, i, nextWord, words;

      words = lines.split(' ').filter(function (w) {
        return w.trim() !== '';
      });
      for (i = 0; i < words.length - 1; i++) {
        curWord = this.normalize(words[i]);
        nextWord = this.normalize(words[i + 1]);
        if (!this.wordBank[curWord]) {
          this.wordBank[curWord] = {};
        }
        if (!this.wordBank[curWord][nextWord]) {
          this.wordBank[curWord][nextWord] = 1;
        } else {
          this.wordBank[curWord][nextWord] += 1;
        }
      }
    }.bind(this));
  };

  MarkovChain$2.prototype.start = function (fnStr) {
    var startType = isType$1(fnStr);
    if (startType === 'string') {
      this.startFn = function () {
        return fnStr;
      };
    } else if (startType === 'function') {
      this.startFn = function (wordList) {
        return fnStr(wordList);
      };
    } else {
      throw new Error('Must pass a function, or string into start()');
    }
    return this;
  };

  MarkovChain$2.prototype.end = function (fnStrOrNum) {
    var endType = isType$1(fnStrOrNum);
    var self = this;

    if (endType === 'function') {
      this.endFn = function () {
        return fnStrOrNum(this.sentence);
      };
    } else if (endType === 'string') {
      this.endFn = function () {
        return self.sentence.split(' ').slice(-1)[0] === fnStrOrNum;
      };
    } else if (endType === 'number' || fnStrOrNum === undefined) {
      fnStrOrNum = fnStrOrNum || Infinity;
      this.endFn = function () {
        return self.sentence.split(' ').length > fnStrOrNum;
      };
    } else {
      throw new Error('Must pass a function, string or number into end()');
    }
    return this;
  };

  MarkovChain$2.prototype.normalize = function (word) {
    return word.replace(/\.$/ig, '');
  };

  var MarkovChain_1 = MarkovChain$2;

  var index$4 = {
    MarkovChain: MarkovChain_1
  };

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ('value' in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
      }
    }return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
    };
  }();

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError('Cannot call a class as a function');
    }
  }

  var isType = function isType(t) {
    return Object.prototype.toString.call(t).slice(8, -1).toLowerCase();
  };

  var MarkovChain = function () {
    function MarkovChain(contents) {
      var normFn = arguments.length <= 1 || arguments[1] === undefined ? function (word) {
        return word.replace(/\.$/ig, '');
      } : arguments[1];

      _classCallCheck(this, MarkovChain);

      this.wordBank = Object.create(null);
      this.sentence = '';
      this._normalizeFn = normFn;
      this.parseBy = /(?:\.|\?|\n)/ig;
      this.parse(contents);
    }

    _createClass(MarkovChain, [{
      key: 'startFn',
      value: function startFn(wordList) {
        var k = Object.keys(wordList);
        var l = k.length;
        return k[~~(Math.random() * l)];
      }
    }, {
      key: 'endFn',
      value: function endFn() {
        return this.sentence.split(' ').length > 7;
      }
    }, {
      key: 'process',
      value: function process() {
        var curWord = this.startFn(this.wordBank);
        this.sentence = curWord;
        while (this.wordBank[curWord] && !this.endFn()) {
          curWord = index$2(this.wordBank[curWord]);
          this.sentence += ' ' + curWord;
        }
        return this.sentence;
      }
    }, {
      key: 'parse',
      value: function parse() {
        var _this = this;

        var text = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
        var parseBy = arguments.length <= 1 || arguments[1] === undefined ? this.parseBy : arguments[1];

        text.split(parseBy).forEach(function (lines) {
          var words = lines.split(' ').filter(function (w) {
            return w.trim() !== '';
          });
          for (var i = 0; i < words.length - 1; i++) {
            var curWord = _this._normalize(words[i]);
            var nextWord = _this._normalize(words[i + 1]);

            if (!_this.wordBank[curWord]) {
              _this.wordBank[curWord] = Object.create(null);
            }
            if (!_this.wordBank[curWord][nextWord]) {
              _this.wordBank[curWord][nextWord] = 1;
            } else {
              _this.wordBank[curWord][nextWord] += 1;
            }
          }
        });
        return this;
      }
    }, {
      key: 'start',
      value: function start(fnStr) {
        var startType = isType(fnStr);
        if (startType === 'string') {
          this.startFn = function () {
            return fnStr;
          };
        } else if (startType === 'function') {
          this.startFn = function (wordList) {
            return fnStr(wordList);
          };
        } else {
          throw new Error('Must pass a function, or string into start()');
        }
        return this;
      }
    }, {
      key: 'end',
      value: function end(fnStrOrNum) {
        var _this2 = this;

        var endType = isType(fnStrOrNum);
        var self = this;

        if (endType === 'function') {
          this.endFn = function () {
            return fnStrOrNum(_this2.sentence);
          };
        } else if (endType === 'string') {
          this.endFn = function () {
            return _this2.sentence.split(' ').slice(-1)[0] === fnStrOrNum;
          };
        } else if (endType === 'number' || fnStrOrNum === undefined) {
          fnStrOrNum = fnStrOrNum || Infinity;
          this.endFn = function () {
            return self.sentence.split(' ').length > fnStrOrNum;
          };
        } else {
          throw new Error('Must pass a function, string or number into end()');
        }
        return this;
      }
    }, {
      key: '_normalize',
      value: function _normalize(word) {
        return this._normalizeFn(word);
      }
    }, {
      key: 'normalize',
      value: function normalize(fn) {
        this._normalizeFn = fn;
        return this;
      }
    }], [{
      key: 'VERSION',
      get: function get() {
        return require$$0.version;
      }
    }, {
      key: 'MarkovChain',
      get: function get() {
        // load older MarkovChain
        return index$4.MarkovChain;
      }
    }]);

    return MarkovChain;
  }();

  var index$1 = MarkovChain;

  var stringify_1 = createCommonjsModule(function (module, exports) {
    exports = module.exports = stringify;
    exports.getSerialize = serializer;

    function stringify(obj, replacer, spaces, cycleReplacer) {
      return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces);
    }

    function serializer(replacer, cycleReplacer) {
      var stack = [],
          keys = [];

      if (cycleReplacer == null) cycleReplacer = function cycleReplacer(key, value) {
        if (stack[0] === value) return "[Circular ~]";
        return "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]";
      };

      return function (key, value) {
        if (stack.length > 0) {
          var thisPos = stack.indexOf(this);
          ~thisPos ? stack.splice(thisPos + 1) : stack.push(this);
          ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
          if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value);
        } else stack.push(value);

        return replacer == null ? value : replacer.call(this, key, value);
      };
    }
  });

  /*	============================================================================
  This is based upon Johannes Baagoe's carefully designed and efficient hash
  function for use with JavaScript.  It has a proven "avalanche" effect such
  that every bit of the input affects every bit of the output 50% of the time,
  which is good.	See: http://baagoe.com/en/RandomMusings/hash/avalanche.xhtml
  ============================================================================
  */
  var Mash = function Mash() {
    var n = 0xefc8249d;
    var mash = function mash(data) {
      if (data) {
        data = data.toString();
        for (var i = 0; i < data.length; i++) {
          n += data.charCodeAt(i);
          var h = 0.02519603282416938 * n;
          n = h >>> 0;
          h -= n;
          h *= n;
          n = h >>> 0;
          h -= n;
          n += h * 0x100000000; // 2^32
        }
        return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
      } else {
        n = 0xefc8249d;
      }
    };
    return mash;
  };

  var uheprng = function uheprng(seed) {
    return function () {
      var o = 48; // set the 'order' number of ENTROPY-holding 32-bit values
      var c = 1; // init the 'carry' used by the multiply-with-carry (MWC) algorithm
      var p = o; // init the 'phase' (max-1) of the intermediate variable pointer
      var s = new Array(o); // declare our intermediate variables array
      var i; // general purpose local
      var j; // general purpose local
      var k = 0; // general purpose local

      // when our "uheprng" is initially invoked our PRNG state is initialized from the
      // browser's own local PRNG. This is okay since although its generator might not
      // be wonderful, it's useful for establishing large startup entropy for our usage.
      var mash = new Mash(); // get a pointer to our high-performance "Mash" hash

      // fill the array with initial mash hash values
      for (i = 0; i < o; i++) {
        s[i] = mash(Math.random());
      }

      // this PRIVATE (internal access only) function is the heart of the multiply-with-carry
      // (MWC) PRNG algorithm. When called it returns a pseudo-random number in the form of a
      // 32-bit JavaScript fraction (0.0 to <1.0) it is a PRIVATE function used by the default
      // [0-1] return function, and by the random 'string(n)' function which returns 'n'
      // characters from 33 to 126.
      var rawprng = function rawprng() {
        if (++p >= o) {
          p = 0;
        }
        var t = 1768863 * s[p] + c * 2.3283064365386963e-10; // 2^-32
        return s[p] = t - (c = t | 0);
      };

      // this EXPORTED function is the default function returned by this library.
      // The values returned are integers in the range from 0 to range-1. We first
      // obtain two 32-bit fractions (from rawprng) to synthesize a single high
      // resolution 53-bit prng (0 to <1), then we multiply this by the caller's
      // "range" param and take the "floor" to return a equally probable integer.
      var random = function random(range) {
        return Math.floor(range * (rawprng() + (rawprng() * 0x200000 | 0) * 1.1102230246251565e-16)); // 2^-53
      };

      // this EXPORTED function 'string(n)' returns a pseudo-random string of
      // 'n' printable characters ranging from chr(33) to chr(126) inclusive.
      random.string = function (count) {
        var i;
        var s = '';
        for (i = 0; i < count; i++) {
          s += String.fromCharCode(33 + random(94));
        }
        return s;
      };

      // this PRIVATE "hash" function is used to evolve the generator's internal
      // entropy state. It is also called by the EXPORTED addEntropy() function
      // which is used to pour entropy into the PRNG.
      var hash = function hash() {
        var args = Array.prototype.slice.call(arguments);
        for (i = 0; i < args.length; i++) {
          for (j = 0; j < o; j++) {
            s[j] -= mash(args[i]);
            if (s[j] < 0) {
              s[j] += 1;
            }
          }
        }
      };

      // this EXPORTED "clean string" function removes leading and trailing spaces and non-printing
      // control characters, including any embedded carriage-return (CR) and line-feed (LF) characters,
      // from any string it is handed. this is also used by the 'hashstring' function (below) to help
      // users always obtain the same EFFECTIVE uheprng seeding key.
      random.cleanString = function (inStr) {
        inStr = inStr.replace(/(^\s*)|(\s*$)/gi, ''); // remove any/all leading spaces
        inStr = inStr.replace(/[\x00-\x1F]/gi, ''); // remove any/all control characters
        inStr = inStr.replace(/\n /, '\n'); // remove any/all trailing spaces
        return inStr; // return the cleaned up result
      };

      // this EXPORTED "hash string" function hashes the provided character string after first removing
      // any leading or trailing spaces and ignoring any embedded carriage returns (CR) or Line Feeds (LF)
      random.hashString = function (inStr) {
        inStr = random.cleanString(inStr);
        mash(inStr); // use the string to evolve the 'mash' state
        for (i = 0; i < inStr.length; i++) {
          // scan through the characters in our string
          k = inStr.charCodeAt(i); // get the character code at the location
          for (j = 0; j < o; j++) {
            //	"mash" it into the UHEPRNG state
            s[j] -= mash(k);
            if (s[j] < 0) {
              s[j] += 1;
            }
          }
        }
      };

      // this EXPORTED function allows you to seed the random generator.
      random.seed = function (seed) {
        if (typeof seed === 'undefined' || seed === null) {
          seed = Math.random();
        }
        if (typeof seed !== 'string') {
          seed = stringify_1(seed, function (key, value) {
            if (typeof value === 'function') {
              return value.toString();
            }
            return value;
          });
        }
        random.initState();
        random.hashString(seed);
      };

      // this handy exported function is used to add entropy to our uheprng at any time
      random.addEntropy = function () /* accept zero or more arguments */{
        var args = [];
        for (i = 0; i < arguments.length; i++) {
          args.push(arguments[i]);
        }
        hash(k++ + new Date().getTime() + args.join('') + Math.random());
      };

      // if we want to provide a deterministic startup context for our PRNG,
      // but without directly setting the internal state variables, this allows
      // us to initialize the mash hash and PRNG's internal state before providing
      // some hashing input
      random.initState = function () {
        mash(); // pass a null arg to force mash hash to init
        for (i = 0; i < o; i++) {
          s[i] = mash(' '); // fill the array with initial mash hash values
        }
        c = 1; // init our multiply-with-carry carry
        p = o; // init our phase
      };

      // we use this (optional) exported function to signal the JavaScript interpreter
      // that we're finished using the "Mash" hash function so that it can free up the
      // local "instance variables" is will have been maintaining.  It's not strictly
      // necessary, of course, but it's good JavaScript citizenship.
      random.done = function () {
        mash = null;
      };

      // if we called "uheprng" with a seed value, then execute random.seed() before returning
      if (typeof seed !== 'undefined') {
        random.seed(seed);
      }

      // Returns a random integer between 0 (inclusive) and range (exclusive)
      random.range = function (range) {
        return random(range);
      };

      // Returns a random float between 0 (inclusive) and 1 (exclusive)
      random.random = function () {
        return random(Number.MAX_VALUE - 1) / Number.MAX_VALUE;
      };

      // Returns a random float between min (inclusive) and max (exclusive)
      random.floatBetween = function (min, max) {
        return random.random() * (max - min) + min;
      };

      // Returns a random integer between min (inclusive) and max (inclusive)
      random.intBetween = function (min, max) {
        return Math.floor(random.random() * (max - min + 1)) + min;
      };

      // when our main outer "uheprng" function is called, after setting up our
      // initial variables and entropic state, we return an "instance pointer"
      // to the internal anonymous function which can then be used to access
      // the uheprng's various exported functions.  As with the ".done" function
      // above, we should set the returned value to 'null' once we're finished
      // using any of these functions.
      return random;
    }();
  };

  // Modification for use in node:
  uheprng.create = function (seed) {
    return new uheprng(seed);
  };
  var index$6 = uheprng;

  function stubMathRandom(seed) {
    Math.random = index$6(seed).random;
  }

  var random = {
    stub: stubMathRandom
  };

  // https://www.boutell.com/newfaq/misc/urllength.html
  var MAX_URL_LENGTH = 2000;

  var isNode = false;
  if ((typeof process === "undefined" ? "undefined" : _typeof(process)) === 'object') {
    if (_typeof(process.versions) === 'object') {
      if (typeof process.versions.node !== 'undefined') {
        isNode = true;
      }
    }
  }

  function fetch(resource, cb) {
    if (!isNode) {
      var xobj = new XMLHttpRequest();

      xobj.overrideMimeType('application/json');
      xobj.open('GET', '/' + resource, true);

      xobj.onreadystatechange = function () {
        if (xobj.readyState === 4) {
          if (xobj.status === 200) {
            cb(null, xobj.responseText);
          } else {
            cb(new Error('could not fetch resource'));
          }
        }
      };

      xobj.onerror = function () {
        cb(new Error('could not fetch resource'));
      };

      xobj.send(null);
    } else {
      require('fs').readFile(resource, 'utf8', cb);
    }
  }

  function load(domain, cb) {
    fetch('trump.txt', function (err, text) {
      if (err) throw err;

      var seedWords = text.replace(/[-,"!?.()]/g, ' ');
      var trump = new index$1(seedWords);

      function bigify(url) {
        var result = '';

        var charactersLeft = function charactersLeft() {
          return MAX_URL_LENGTH - result.length;
        };

        result += domain + '/v1.0.0/';

        var encodedUrl = Buffer.from(url).toString('base64');
        // encode uri because b64 has '/', which would mess up url parsing
        result += encodeURIComponent(encodedUrl) + '/';

        random.stub(url);
        while (charactersLeft() > 0) {
          var trumpism = createTrumpSentence(charactersLeft() - 1); // the 1 is to account for the trailing '/' that will be added
          result += trumpism.replace(/ /g, '/') + '/';
        }

        return result;
      }

      function extract(biglyLink) {
        var match = biglyLink.match(/v\d\.\d\.\d\/(.*?)\//);
        var encodedUrl = match[1];
        var url = Buffer.from(decodeURIComponent(encodedUrl), 'base64').toString('utf-8');

        return bigify(url) === biglyLink ? url : null;
      }

      function createTrumpSentence(maxLength) {
        return trump.start(function (wordsObject) {
          var words = Object.keys(wordsObject);
          var index = Math.floor(Math.random() * words.length);
          return words[index];
        }).end(function (sentence) {
          return sentence.length > maxLength;
        }).process();
      }

      cb(null, {
        bigify: bigify,
        extract: extract
      });
    });
  }

  var index = { load: load };

  return index;
}();