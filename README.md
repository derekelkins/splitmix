## SplitMix

**This random number generator is *NOT* suitable for cryptographic applications.**

Implements the SplitMix algorithm from [*Fast Splittable Pseudorandom Number Generators*](https://doi.org/10.1145/2714064.2660195)
by Steele, Lea, and Flood.

See the API docs [here](https://derekelkins.github.io/splitmix/).

This provides a splittable random number generator.

Both a functional and a mutable interface are provided. The functional interface
matches the [`node-lcg`](https://www.npmjs.com/package/lcg) library. It should be
drop-in compatible. The `node-lcg` is based on [*Distributed random number generation*](https://doi.org/10.1017/S0956796800000320)
by Burton and Page. As far as I know, its statistical properties haven't been tested with DieHard or TestU01 unlike
the SplitMix algorithm (but not this implementation). Being from 1992 and based on a linear congruential generator,
it is not likely to perform well statistically.

It is tested to produce the same values as [the Haskell SplitMix implementation](http://hackage.haskell.org/package/splitmix-0.0.3).
