/* BEJEWELY Forge API adapter. OAEP/MGF1 algorithms come exclusively from
 * node-rsa v2.0.0, MIT, pinned in provenance.json and upstream/LICENSE.
 * This adapter performs argument, byte, digest, random, and error adaptation.
 * It contains no WebRSA/jsjws OAEP implementation. */
const createOaep = require('./bejewely-node-rsa-oaep.js');
module.exports = function(forge) {
  function bytes(s) {
    const out = new Uint8Array(s.length);
    for(let i=0;i<s.length;i++) out[i]=s.charCodeAt(i);
    return out;
  }
  function binary(a) {
    let out='';
    for(let i=0;i<a.length;i++) out+=String.fromCharCode(a[i]);
    return out;
  }
  function options(args, encode) {
    const value=args[2];
    if(typeof value==='string') return {label:value,seed:encode?args[3]:undefined,md:args[encode?4:3]};
    return value || {};
  }
  function scheme(key, opts) {
    const md=opts.md || forge.md.sha1.create();
    const mgf=opts.mgf1 && opts.mgf1.md || md;
    const digestObjects={oaep:md,mgf};
    const api=createOaep({oaep:md.digestLength,mgf:mgf.digestLength});
    const backend={
      digest(name,input) {
        const digest=digestObjects[name];
        digest.start();
        digest.update(binary(input),'raw');
        return bytes(digest.digest().getBytes());
      },
      randomBytes(length) {
        if(opts.seed) {
          if(opts.seed.length!==length) {
            const error=new Error('Invalid RSAES-OAEP seed. The seed length must match the digest length.');
            error.seedLength=opts.seed.length;error.digestLength=length;throw error;
          }
          return bytes(opts.seed);
        }
        return bytes(forge.random.getBytes(length));
      }
    };
    const length=Math.ceil(key.n.bitLength()/8);
    return {length,md,instance:api.oaepScheme.makeScheme({encryptedDataLength:length},{backend,encryptionSchemeOptions:{hash:'oaep',label:bytes(opts.label || ''),mgf:(seed,size)=>api.mgf1(seed,size,'mgf',backend)}})};
  }
  return {
    encode_rsa_oaep(key,message) {
      const context=scheme(key,options(arguments,true));
      const maxLength=context.length-2*context.md.digestLength-2;
      if(message.length>maxLength) {
        const error=new Error('RSAES-OAEP input message length is too long.');
        error.length=message.length;error.maxLength=maxLength;throw error;
      }
      return binary(context.instance.encPad(bytes(message)));
    },
    decode_rsa_oaep(key,message) {
      const opts=options(arguments,false);
      const length=Math.ceil(key.n.bitLength()/8);
      if(message.length!==length) {
        const error=new Error('RSAES-OAEP encoded message length is invalid.');
        error.length=message.length;error.expectedLength=length;throw error;
      }
      const context=scheme(key,opts);
      if(length<2*context.md.digestLength+2) throw new Error('RSAES-OAEP key is too short for the hash function.');
      const result=context.instance.encUnPad(bytes(message));
      if(result===null) throw new Error('Invalid RSAES-OAEP padding.');
      return binary(result);
    }
  };
};
