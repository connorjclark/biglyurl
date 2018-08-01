import MarkovChain = require('markovchain')
import * as random from './random'

declare const TRUMP_SPEECH: string

// https://www.boutell.com/newfaq/misc/urllength.html
const MAX_URL_LENGTH = 2000

let trumpMarkovChain: MarkovChain
const getTrumpMarkovChain = () => {
  if (!trumpMarkovChain) {
    const seedWords = TRUMP_SPEECH.replace(/[-,"!?.()]/g, ' ')
    trumpMarkovChain = new MarkovChain(seedWords)
  }
  
  return trumpMarkovChain
}

export const bigify = (host: string, url: string) => {
  const chain = getTrumpMarkovChain()
  const createTrumpSentence = (maxLength: number) => {
    return chain.start((wordsObject) => {
      const words = Object.keys(wordsObject)
      const index = Math.floor(Math.random() * words.length)
      return words[index]
    }).end(sentence => {
      return sentence.length > maxLength
    }).process()
  }

  let result = `${host}?huuuuuuuge=/v1.0.0/`

  const charactersLeft = () => MAX_URL_LENGTH - result.length

  const encodedUrl = Buffer.from(url).toString('base64')
  // encode uri because b64 has '/', which would mess up url parsing
  result += encodeURIComponent(encodedUrl) + '/'

  random.stubMathRandom(url)
  while (charactersLeft() > 0) {
    const trumpism = createTrumpSentence(charactersLeft() - 1) // the 1 is to account for the trailing '/' that will be added
    result += trumpism.replace(/ /g, '/').replace(/["'.,;?!]/g, '') + '/'
  }

  return result
}

export const smallify = (host: string, url: string) => {
  if (url.startsWith('?huuuuuuuge=/v1.0.0')) {
    return decodeV1(host, url)
  }

  throw new Error('unsupported url: ' + url)
}

export const decodeV1 = (host: string, encodedUrl: string) => {
  const base64Url = encodedUrl.split('/', 4)[2]
  const url = Buffer.from(decodeURIComponent(base64Url), 'base64').toString('utf-8')
  return url
}
