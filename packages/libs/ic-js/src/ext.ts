import { Principal } from '@icp-sdk/core/principal';

export const to32bits = (num: number) => {
  const b = new ArrayBuffer(4);
  new DataView(b).setUint32(0, num);
  return Array.from(new Uint8Array(b));
};

export const from32bits = (ba: Uint8Array) => {
  var value = 0;
  for (var i = 0; i < 4; i++) {
    value = (value << 8) | ba[i];
  }
  return value;
};

export const generatetokenIdentifier = (principal: string, index: number) => {
  const padding = new Uint8Array([0x0A, 0x74, 0x69, 0x64]); // '\x0Atid'
  const array = new Uint8Array([
    ...padding,
    ...Principal.fromText(principal).toUint8Array(),
    ...to32bits(index),
  ]);
  return Principal.fromUint8Array(array).toText();
};

export const toHexString = (byteArray: Uint8Array) => {
  return Array.from(byteArray, (byte) => {
    return ('0' + (byte & 0xff).toString(16)).slice(-2);
  }).join('');
};

export const fromHexString = (hex: string) => {
  if (hex.substr(0, 2) === '0x') hex = hex.substr(2);
  for (var bytes = [], c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
  return bytes;
};

export const decodeTokenId = (tid: string) => {
  var p = Principal.fromText(tid).toUint8Array();
  var padding = p.slice(0, 4);
  const expectedPadding = new Uint8Array([0x0A, 0x74, 0x69, 0x64]); // '\x0Atid'
  if (toHexString(padding) !== toHexString(expectedPadding)) {
    return {
      index: 0,
      canister: tid,
      token: generatetokenIdentifier(tid, 0),
    };
  } else {
    const index = from32bits(p.slice(-4));
    if (index === undefined) {
      console.error(`Token index derived from ${tid} undefined`);
    }
    return {
      index,
      canister: Principal.fromUint8Array(
        new Uint8Array([...p.slice(4, -4)]),
      ).toText(),
      token: tid,
    };
  }
};

export const generateExtAssetLink = (tokenId: string) => {
  const { canister } = decodeTokenId(tokenId);
  return `https://${canister}.raw.icp0.io/?tokenid=${tokenId}`;
};

export const generateExtThumbnailLink = (tokenId: string) => {
  const { canister } = decodeTokenId(tokenId);
  return `https://${canister}.raw.icp0.io/?tokenid=${tokenId}&type=thumbnail`;
};

export const getSubAccountArray = (s: number | number[]) => {
  if (Array.isArray(s)) {
    return s.concat(Array(32 - s.length).fill(0));
  } else {
    //32 bit number only
    return Array(28)
      .fill(0)
      .concat(to32bits(s ? s : 0));
  }
};
