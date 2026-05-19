import { createHmac, createHash, randomBytes } from 'crypto';
import { encodeBase32UpperCaseNoPadding, decodeBase32IgnorePadding } from '@oslojs/encoding';

export const TOKEN_RANDOM_BYTES_LENGTH = 20;

export class HmacTokenCodec {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  encode(randomBytes_: Uint8Array = randomBytes(TOKEN_RANDOM_BYTES_LENGTH)): string {
    const randomPart = encodeBase32UpperCaseNoPadding(randomBytes_);
    const sig = createHmac('sha256', this.secret).update(randomBytes_).digest();
    const sigPart = encodeBase32UpperCaseNoPadding(sig);
    return `${randomPart}.${sigPart}`;
  }

  decode(token: string): { randomPart: string; sigPart: string } | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [randomPart, sigPart] = parts as [string, string];
    let randomBytes_: Uint8Array;
    let actualSig: Uint8Array;
    try {
      randomBytes_ = decodeBase32IgnorePadding(randomPart);
      actualSig = decodeBase32IgnorePadding(sigPart);
    } catch {
      return null;
    }

    const expectedSig = createHmac('sha256', this.secret).update(randomBytes_).digest();

    if (expectedSig.length !== actualSig.length) return null;

    let diff = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      diff |= expectedSig[i]! ^ actualSig[i]!;
    }

    if (diff !== 0) return null;

    return { randomPart: randomPart!, sigPart: sigPart! };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}