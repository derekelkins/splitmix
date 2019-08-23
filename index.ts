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
   * @param min Lower bound, inclusive.
   * @param max Upper bound, inclusive.
   * @returns Integer value x satisfying min <= x <= max
   */
  getIntegerBetween(min: number, max: number): number;
}

/**
 * Imperative random number generator interface.
 *
 * This is more similar to the interface in the paper.
 */
export interface IRandomGen {
  /**
   * @returns Real value x satisfying 0 <= x < 1
   */
  next(): number;

  /**
   * @param min Lower bound, inclusive.
   * @param max Upper bound, inclusive.
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

/**
 * Not intended for direct use. Instead use [[Random]].
 */
export class SplitMix implements IRandom {
  private readonly nextSeed: Long;

  /**
   * @param gamma should be odd.
   */
  constructor(seed: Long, private readonly gamma: Long) {
    this.nextSeed = seed.add(gamma);
  }

  /**
   * @returns Next generator.
   */
  public next(): SplitMix {
    return new SplitMix(this.nextSeed, this.gamma);
  }

  /**
   * @returns Produce two independent generators.
   */
  public split(): [SplitMix, SplitMix] {
    return [this.next().next(), new SplitMix(mix64(this.nextSeed), mixGamma(this.nextSeed.add(this.gamma)))];
  }

  /**
   * @returns 64-bit [[Long]]
   */
  public getLong(): Long {
    return mix64(this.nextSeed);
  }

  /**
   * @returns 32-bit integer
   */
  public getInt(): number {
    return mix32(this.nextSeed); // This is what the paper says.
    // return this.getLong().toNumber(); // This is what the Haskell library does.
  }

  /**
   * @returns Real value x satisfying 0 <= x < 1
   */
  public get(): number {
    return this.getLong().shru(11).toNumber()*ULP;
  }

  /**
   * @param min Lower bound, inclusive.
   * @param max Upper bound, inclusive.
   * @returns Integer value x satisfying min <= x <= max
   */
  public getIntegerBetween(min: number, max: number): number {
    return Math.floor(this.get() * (1 + max - min)) + min;
  }
}

/**
 * Not intended for direct use. Instead use [[RandomGen]].
 */
export class SplitMixGen implements IRandomGen {
  /**
   * @param gamma should be odd.
   */
  constructor(private seed: Long, private readonly gamma: Long = GOLDEN_GAMMA) { }

  /**
   * @returns An independent [[IRandomGen]].
   */
  public split(): SplitMixGen {
    return new SplitMixGen(mix64(this.nextSeed()), mixGamma(this.nextSeed()));
  }

  /**
   * @returns 64-bit [[Long]]
   */
  public nextLong(): Long {
    return mix64(this.nextSeed());
  }

  /**
   * @returns 32-bit integer
   */
  public nextInt(): number {
    return mix32(this.nextSeed()); // This is what the paper says.
    // return this.nextLong().toNumber(); // This is what the Haskell library does.
  }

  /**
   * @returns Real value x satisfying 0 <= x < 1
   */
  public next(): number {
    return this.nextLong().shru(11).toNumber()*ULP;
  }

  /**
   * @param min Lower bound, inclusive.
   * @param max Upper bound, inclusive.
   * @returns Integer value x satisfying min <= x <= max
   */
  public nextIntegerBetween(min: number, max: number): number {
    return Math.floor(this.next() * (1 + max - min)) + min;
  }

  private nextSeed(): Long {
    this.seed = this.seed.add(this.gamma);
    return this.seed;
  }
}

/**
 * Functional interface to the SplitMix random number generator.
 *
 * ### Sequential use
 *
 * ```typescript
 * const seed = 42;
 * const rng = new Random(seed);
 * const a = rng.get(); // 0 <= a < 1
 * const nextRng = rng.next();
 * const b = nextRng.get(); // 0 <= b < 1
 * const a2 = rng.get(); // a === a2
 * expect([a === a2, a !== b]).toEqual([true, true]);
 * ```
 *
 * ### Parallel use
 *
 * ```typescript
 * const randomTree: (depth: number, rng: Random) => Promise<any> = async (depth, rng) => {
 *   if (depth <= 0) {
 *     return rng.get();
 *   } else {
 *     const [leftRng, rightRng] = rng.split();
 *     return await Promise.all([
 *       randomTree(depth-1, leftRng),
 *       randomTree(depth-1, rightRng)
 *     ]);
 *   }
 * };
 * const seed = 42;
 * randomTree(4, new Random(seed));
 * ```
 *
 * This illustrates being able to maintain a functional interface while avoiding the
 * need to thread the random state through code allowing simpler and more parallel code.
 */
export class Random extends SplitMix {
  constructor(seed: Long | number) {
    const s = typeof seed === 'number' ? new Long(seed) : seed;
    super(mix64(s), mixGamma(s.add(GOLDEN_GAMMA)));
  }
}

/**
 * Imperative interface to the SplitMix random number generator.
 *
 * ### Sequential use
 *
 * ```typescript
 * const seed = 42;
 * const rng = new RandomGen(seed);
 * const a = rng.next(); // 0 <= a < 1
 * const b = rng.next(); // 0 <= b < 1
 * expect(a !== b).toEqual(true);
 * ```
 *
 * ### Parallel use
 *
 * ```typescript
 * const randomTree: (depth: number, rng: RandomGen) => Promise<any> = async (depth, rng) => {
 *   if (depth <= 0) {
 *     return rng.next();
 *   } else {
 *     const rightRng = rng.split();
 *     return await Promise.all([
 *       randomTree(depth-1, rng),
 *       randomTree(depth-1, rightRng)
 *     ]);
 *   }
 * };
 * const seed = 42;
 * randomTree(4, new RandomGen(seed));
 * ```
 *
 * Compared to simply reusing the same [[RandomGen]] as you would for a non-splittable
 * random number generator, this code will produce the same output regardless of the order
 * in which the `Promise`s run.
 *
 */
export class RandomGen extends SplitMixGen {
  constructor(seed: Long | number) {
    const s = typeof seed === 'number' ? new Long(seed) : seed;
    super(mix64(s), mixGamma(s.add(GOLDEN_GAMMA)));
  }
}

export default Random;
