import Long from 'long';

const ULP = Math.pow(2, -53);

/**
 * Functional random number generator interface.
 *
 * Matches [node-lcg](https://www.npmjs.com/package/lcg).
 */
export interface IRandom {
  /**
   * @returns Next generator.
   */
  next(): IRandom;

  /**
   * @returns Produce two independent generators.
   */
  split(): [IRandom, IRandom];

  /**
   * @returns Real value x satisfying 0 <= x < 1
   */
  get(): number;

  /**
   * @returns Integer value x satisfying min <= x <= max
   */
  getIntegerBetween(min: number, max: number): number;
}

/**
 * Random number generator that updates in place.
 */
export interface IRandomGen {
  /**
   * @returns Real value x satisfying 0 <= x < 1
   */
  next(): number;

  /**
   * @returns Integer value x satisfying min <= x <= max
   */
  nextIntegerBetween(min: number, max: number): number;

  /**
   * @returns An independent [[IRandomGen]].
   */
  split(): IRandomGen;
}

// Magic numbers
const GOLDEN_GAMMA = new Long(0x7F4A7C15, 0x9E3779B9); // 9E37 79B9 7F4A 7C15
const TWO_GOLDEN_GAMMA = GOLDEN_GAMMA.mul(2);
const MIX_A = new Long(0xED558CCD, 0xFF51AFD7); // FF51 AFD7 ED55 8CCD
const MIX_B = new Long(0x1A85EC53, 0xC4CEB9FE); // C4CE B9FE 1A85 EC53
const MIX_VARIANT_A = new Long(0x1CE4E5B9, 0xBF58476D); // BF58 476D 1CE4 E5B9
const MIX_VARIANT_B = new Long(0x133111EB, 0x94D049BB); // 94D0 49BB 1331 11EB
const MIX_GAMMA_A = new Long(0xAAAAAAAA, 0xAAAAAAAA); // AAAA AAAA AAAA AAAA

// From https://github.com/mikolalysenko/bit-twiddle
function bitCount(v: number): number {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return ((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}

function mix64(z: Long): Long {
  z = z.xor(z.shru(33)).mul(MIX_A);
  z = z.xor(z.shru(33)).mul(MIX_B);
  return z.xor(z.shru(33));
}

function mix32(z: Long): number {
  z = z.xor(z.shru(33)).mul(MIX_A);
  z = z.xor(z.shru(33)).mul(MIX_B);
  return z.xor(z.shru(32)).toInt();
}

function mix64variant13(z: Long): Long {
  z = z.xor(z.shru(30)).mul(MIX_VARIANT_A);
  z = z.xor(z.shru(27)).mul(MIX_VARIANT_B);
  return z.xor(z.shru(31));
}

function mixGamma(z: Long): Long {
  z = mix64variant13(z).or(1); // Enforce oddness.
  const a = z.xor(z.shru(1));
  const n = bitCount(a.getLowBitsUnsigned()) + bitCount(a.getHighBitsUnsigned());
  return n >= 24 ? z : z.xor(MIX_GAMMA_A);
}

export class SplitMix implements IRandom {
  private readonly nextSeed: Long;

  /**
   * @param gamma should be odd.
   */
  constructor(seed: Long, private readonly gamma: Long) {
    this.nextSeed = seed.add(gamma);
  }

  public next(): SplitMix {
    return new SplitMix(this.nextSeed, this.gamma);
  }

  public split(): [SplitMix, SplitMix] {
    return [this.next().next(), new SplitMix(mix64(this.nextSeed), mixGamma(this.nextSeed.add(this.gamma)))];
  }

  public getLong(): Long {
    return mix64(this.nextSeed);
  }

  /**
   * @return 32-bit integer
   */
  public getInt(): number {
    return mix32(this.nextSeed); // This is what the paper says.
    // return this.getLong().toNumber(); // This is what the Haskell library does.
  }

  public get(): number {
    return this.getLong().shru(11).toNumber()*ULP;
  }

  public getIntegerBetween(min: number, max: number): number {
    return Math.floor(this.get() * (1 + max - min)) + min;
  }
}

export class SplitMixGen implements IRandomGen {
  /**
   * @param gamma should be odd.
   */
  constructor(private seed: Long, private readonly gamma: Long = GOLDEN_GAMMA) { }

  public split(): SplitMixGen {
    return new SplitMixGen(mix64(this.nextSeed()), mixGamma(this.nextSeed()));
  }

  public nextLong(): Long {
    return mix64(this.nextSeed());
  }

  /**
   * @return 32-bit integer
   */
  public nextInt(): number {
    return mix32(this.nextSeed()); // This is what the paper says.
    // return this.nextLong().toNumber(); // This is what the Haskell library does.
  }

  public next(): number {
    return this.nextLong().shru(11).toNumber()*ULP;
  }

  public nextIntegerBetween(min: number, max: number): number {
    return Math.floor(this.next() * (1 + max - min)) + min;
  }

  private nextSeed(): Long {
    this.seed = this.seed.add(this.gamma);
    return this.seed;
  }
}

export class Random extends SplitMix { 
  constructor(seed: Long | number) {
    const s = typeof seed === 'number' ? new Long(seed) : seed;
    super(mix64(s), mixGamma(s.add(GOLDEN_GAMMA)));
  }
}

export class RandomGen extends SplitMixGen { 
  constructor(seed: Long | number) {
    const s = typeof seed === 'number' ? new Long(seed) : seed;
    super(mix64(s), mixGamma(s.add(GOLDEN_GAMMA)));
  }
}

export default Random;
