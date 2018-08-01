import { create } from 'random-seed'

export function stubMathRandom (seed: string) {
  Math.random = create(seed).random
}
