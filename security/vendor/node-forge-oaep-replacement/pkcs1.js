var forge = require('./forge');
require('./sha1');
require('./random');
/* BEJEWELY Forge API adapter. OAEP/MGF1 algorithms come exclusively from
 * node-rsa v2.0.0, MIT, pinned in provenance.json and upstream/LICENSE.
 * This adapter performs argument, byte, digest, random, and error adaptation.
 * It contains no WebRSA/jsjws OAEP implementation. */
var createOaep = require('./bejewely-node-rsa-oaep.js');
function createForgeOaep(forge) {
    function bytes(s) {
        var out = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++)
            out[i] = s.charCodeAt(i);
        return out;
    }
    function binary(a) {
        var out = '';
        for (var i = 0; i < a.length; i++)
            out += String.fromCharCode(a[i]);
        return out;
    }
    function options(args, encode) {
        var value = args[2];
        if (typeof value === 'string')
            return { label: value, seed: encode ? args[3] : undefined, md: args[encode ? 4 : 3] };
        return value || {};
    }
    function scheme(key, opts) {
        var md = opts.md || forge.md.sha1.create();
        var mgf = opts.mgf1 && opts.mgf1.md || md;
        var digestObjects = { oaep: md, mgf: mgf };
        var api = createOaep({ oaep: md.digestLength, mgf: mgf.digestLength });
        var backend = {
            digest: function (name, input) {
                var digest = digestObjects[name];
                digest.start();
                digest.update(binary(input), 'raw');
                return bytes(digest.digest().getBytes());
            },
            randomBytes: function (length) {
                if (opts.seed) {
                    if (opts.seed.length !== length) {
                        var error = new Error('Invalid RSAES-OAEP seed. The seed length must match the digest length.');
                        error.seedLength = opts.seed.length;
                        error.digestLength = length;
                        throw error;
                    }
                    return bytes(opts.seed);
                }
                return bytes(forge.random.getBytes(length));
            }
        };
        var length = Math.ceil(key.n.bitLength() / 8);
        return { length: length, md: md, instance: api.oaepScheme.makeScheme({ encryptedDataLength: length }, { backend: backend, encryptionSchemeOptions: { hash: 'oaep', label: bytes(opts.label || ''), mgf: function (seed, size) { return api.mgf1(seed, size, 'mgf', backend); } } }) };
    }
    return {
        encode_rsa_oaep: function (key, message) {
            var context = scheme(key, options(arguments, true));
            var maxLength = context.length - 2 * context.md.digestLength - 2;
            if (message.length > maxLength) {
                var error = new Error('RSAES-OAEP input message length is too long.');
                error.length = message.length;
                error.maxLength = maxLength;
                throw error;
            }
            return binary(context.instance.encPad(bytes(message)));
        },
        decode_rsa_oaep: function (key, message) {
            var opts = options(arguments, false);
            var length = Math.ceil(key.n.bitLength() / 8);
            if (message.length !== length) {
                var error = new Error('RSAES-OAEP encoded message length is invalid.');
                error.length = message.length;
                error.expectedLength = length;
                throw error;
            }
            var context = scheme(key, opts);
            if (length < 2 * context.md.digestLength + 2)
                throw new Error('RSAES-OAEP key is too short for the hash function.');
            var result = context.instance.encUnPad(bytes(message));
            if (result === null)
                throw new Error('Invalid RSAES-OAEP padding.');
            return binary(result);
        }
    };
}
;
module.exports = forge.pkcs1 = createForgeOaep(forge);
