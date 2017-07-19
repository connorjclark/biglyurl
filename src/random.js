import gen from 'random-seed'

function stubMathRandom (seed) {
  Math.random = gen(seed).random
}

export default {
  stub: stubMathRandom
}
