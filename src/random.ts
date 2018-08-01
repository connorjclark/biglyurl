import {create} from 'random-seed'

function stubMathRandom (seed: string) {
  Math.random = create(seed).random
}

export default {
  stub: stubMathRandom
}
