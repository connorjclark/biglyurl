import MarkovChain = require('markovchain')
import * as fs from 'fs'
import random from './random'

// https://www.boutell.com/newfaq/misc/urllength.html
const MAX_URL_LENGTH = 2000

let trumpMarkovChain: MarkovChain
const getTrumpMarkovChain = () => {
  if (!trumpMarkovChain) {
    const text = fs.readFileSync('./trump.txt', 'utf8')
    const seedWords = text.replace(/[-,"!?.()]/g, ' ')
    trumpMarkovChain = new MarkovChain(seedWords)
  }
  
  return trumpMarkovChain
}

export const encode = (host: string, url: string) => {
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

  let result = `${host}/v1.0.0/`

  const charactersLeft = () => MAX_URL_LENGTH - result.length

  const encodedUrl = Buffer.from(url).toString('base64')
  // encode uri because b64 has '/', which would mess up url parsing
  result += encodeURIComponent(encodedUrl) + '/'

  random.stub(url)
  while (charactersLeft() > 0) {
    const trumpism = createTrumpSentence(charactersLeft() - 1) // the 1 is to account for the trailing '/' that will be added
    result += trumpism.replace(/ /g, '/') + '/'
  }

  return result
}

export const decode = (host: string, url: string) => {
  if (url.startsWith('/v1.0.0')) {
    return decodeV1(host, url)
  }

  throw new Error('unsupported url: ' + url)
}

export const decodeV1 = (host: string, encodedUrl: string) => {
  const base64Url = encodedUrl.split('/', 4)[2]
  const url = Buffer.from(decodeURIComponent(base64Url), 'base64').toString('utf-8')

  if (encode(host, url) !== host + encodedUrl) {
    throw new Error('bad url')
  }

  return url
}
