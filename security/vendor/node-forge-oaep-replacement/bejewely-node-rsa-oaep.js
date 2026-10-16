/* node-rsa v2.0.0 54798624ba5b15521763c6d1ca69b93115a61d67. MIT; see upstream/LICENSE.
 * Mechanical TypeScript 5.9.3 compilation to ES5, import/export wiring only.
 * Only complete concat/constantTimeEqual/writeUInt32BE helper functions retained.
 * DIGEST_LENGTH is supplied by the Forge adapter to support custom digest objects.
 */
module.exports = function createOaep(DIGEST_LENGTH) {
function concat() {
    var arrays = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        arrays[_i] = arguments[_i];
    }
    var total = 0;
    for (var _a = 0, arrays_1 = arrays; _a < arrays_1.length; _a++) {
        var a = arrays_1[_a];
        total += a.length;
    }
    var out = new Uint8Array(total);
    var off = 0;
    for (var _b = 0, arrays_2 = arrays; _b < arrays_2.length; _b++) {
        var a = arrays_2[_b];
        out.set(a, off);
        off += a.length;
    }
    return out;
}
// Length is treated as public: callers (OAEP lHash, PSS H/H', PKCS#1 padded
// block) compare buffers whose size is derived from public modulus/hash
// parameters, not from secret data. Do not use on variable-length secrets.
function constantTimeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

function writeUInt32BE(value, target, offset) {
    if (offset === void 0) { offset = 0; }
    if (offset + 4 > target.length) {
        throw new RangeError("writeUInt32BE: out of range (offset=".concat(offset, ", length=").concat(target.length, ")"));
    }
    target[offset] = (value >>> 24) & 0xff;
    target[offset + 1] = (value >>> 16) & 0xff;
    target[offset + 2] = (value >>> 8) & 0xff;
    target[offset + 3] = value & 0xff;
}

var DEFAULT_HASH = 'sha1';
/** Default MGF1 implementation bound to a backend. */
function mgf1(seed, maskLength, hash, backend) {
    var hLen = DIGEST_LENGTH[hash];
    var count = Math.ceil(maskLength / hLen);
    var out = new Uint8Array(hLen * count);
    var counter = new Uint8Array(4);
    for (var i = 0; i < count; i++) {
        writeUInt32BE(i, counter, 0);
        var h = backend.digest(hash, concat(seed, counter));
        out.set(h, i * hLen);
    }
    return out.subarray(0, maskLength);
}
var OaepScheme = /** @class */ (function () {
    function OaepScheme(key, options) {
        this.key = key;
        this.options = options;
    }
    OaepScheme.prototype.hash = function () {
        var _a;
        return (_a = this.options.encryptionSchemeOptions.hash) !== null && _a !== void 0 ? _a : DEFAULT_HASH;
    };
    OaepScheme.prototype.mgf = function () {
        var userMgf = this.options.encryptionSchemeOptions.mgf;
        if (userMgf)
            return userMgf;
        var backend = this.options.backend;
        return function (seed, maskLength, hash) { return mgf1(seed, maskLength, hash, backend); };
    };
    OaepScheme.prototype.maxMessageLength = function () {
        return this.key.encryptedDataLength - 2 * DIGEST_LENGTH[this.hash()] - 2;
    };
    OaepScheme.prototype.encPad = function (buffer) {
        var _a;
        var hash = this.hash();
        var mgf = this.mgf();
        var label = (_a = this.options.encryptionSchemeOptions.label) !== null && _a !== void 0 ? _a : new Uint8Array(0);
        var emLen = this.key.encryptedDataLength;
        var hLen = DIGEST_LENGTH[hash];
        if (buffer.length > emLen - 2 * hLen - 2) {
            throw new Error("Message is too long to encode into an encoded message with a length of ".concat(emLen, " bytes, increaseemLen to fix this error (minimum size: ").concat(emLen - 2 * hLen - 2, ")"));
        }
        var lHash = this.options.backend.digest(hash, label);
        var PS = new Uint8Array(emLen - buffer.length - 2 * hLen - 1);
        PS[PS.length - 1] = 1;
        var DB = concat(lHash, PS, buffer);
        var seed = this.options.backend.randomBytes(hLen);
        var dbMask = mgf(seed, DB.length, hash);
        for (var i = 0; i < DB.length; i++)
            DB[i] = DB[i] ^ dbMask[i];
        var seedMask = mgf(DB, hLen, hash);
        for (var i = 0; i < seed.length; i++)
            seed[i] = seed[i] ^ seedMask[i];
        var em = new Uint8Array(1 + seed.length + DB.length);
        em[0] = 0;
        em.set(seed, 1);
        em.set(DB, 1 + seed.length);
        return em;
    };
    /**
     * Constant-time OAEP decode per RFC 8017 §7.1.2: all failure modes —
     * wrong Y byte, lHash mismatch, no 0x01 separator, message length over
     * the geometric maximum — must be indistinguishable in timing or a
     * Manger oracle recovers plaintext in ~10⁵ queries. We accumulate a
     * single `bad` flag without branches and return null once at the end.
     */
    OaepScheme.prototype.encUnPad = function (buffer) {
        var _a;
        var hash = this.hash();
        var mgf = this.mgf();
        var label = (_a = this.options.encryptionSchemeOptions.label) !== null && _a !== void 0 ? _a : new Uint8Array(0);
        var hLen = DIGEST_LENGTH[hash];
        // Length precondition — public-known info (key size), safe to branch on.
        if (buffer.length < 2 * hLen + 2)
            return null;
        // From here on, all checks are constant-time and accumulate into `bad`.
        var work = buffer.slice();
        // RFC 8017 §7.1.2 step 3: Y (the leading byte) must equal 0x00.
        var bad = work[0] === 0x00 ? 0 : 1;
        var seed = work.subarray(1, hLen + 1);
        var DB = work.subarray(1 + hLen);
        var seedMask = mgf(DB, hLen, hash);
        for (var i = 0; i < seed.length; i++)
            seed[i] = seed[i] ^ seedMask[i];
        var dbMask = mgf(seed, DB.length, hash);
        for (var i = 0; i < DB.length; i++)
            DB[i] = DB[i] ^ dbMask[i];
        // lHash compare in constant time.
        var lHash = this.options.backend.digest(hash, label);
        var lHashEM = DB.subarray(0, hLen);
        bad |= constantTimeEqual(lHashEM, lHash) ? 0 : 1;
        // Constant-iteration separator scan. Walk the entire DB from hLen onward,
        // recording the position of the first 0x01 byte. Any non-{0x00,0x01} byte
        // before the separator, or no separator at all, marks `bad`.
        var found = 0;
        var msgStart = 0;
        for (var j = hLen; j < DB.length; j++) {
            var b = DB[j];
            // isOne = 1 if b==0x01 else 0 (constant-time, no branch).
            var isOne = (((b ^ 0x01) - 1) >>> 31) & 1;
            // isZero = 1 if b==0x00 else 0.
            var isZero = (((b | -b) >>> 31) ^ 1) & 1;
            var notFoundYet = (1 - found) & 1;
            // Record msgStart = j+1 (first byte after the separator) the first
            // time we see 0x01. Use arithmetic mask, not branch.
            var recordMask = -(notFoundYet & isOne);
            msgStart = (msgStart & ~recordMask) | ((j + 1) & recordMask);
            // Before separator, any byte ≠ 0x00 and ≠ 0x01 marks bad.
            bad |= notFoundYet & (1 - isOne) & (1 - isZero);
            found |= isOne;
        }
        bad |= 1 - found;
        if (bad)
            return null;
        var msg = DB.subarray(msgStart).slice();
        // RFC 8017 §7.1.1 step 1.b: enforce mLen ≤ k − 2hLen − 2.
        if (msg.length > this.maxMessageLength())
            return null;
        return msg;
    };
    return OaepScheme;
}());
var oaepScheme = {
    isEncryption: true,
    isSignature: false,
    makeScheme: function (key, options) {
        return new OaepScheme(key, options);
    },
};

return {oaepScheme:oaepScheme, mgf1:mgf1};
};
