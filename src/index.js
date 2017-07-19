import fs from 'fs'
import MarkovChain from 'markovchain'
import random from './random'

// https://www.boutell.com/newfaq/misc/urllength.html
const MAX_URL_LENGTH = 2000

const seedWords = fs.readFileSync('./trump.txt', 'utf8').replace(/[-,"!?.()]/g, ' ')
const trump = new MarkovChain(seedWords)

function bigify (url) {
  let result = ''

  const charactersLeft = () => MAX_URL_LENGTH - result.length

  result += 'https://www.biglyurl.com/v1.0.0/'

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

function extract (biglyLink) {
  const match = biglyLink.match(/v\d\.\d\.\d\/(.*?)\//)
  const encodedUrl = match[1]
  const url = Buffer.from(decodeURIComponent(encodedUrl), 'base64').toString('utf-8')

  return bigify(url) === biglyLink ? url : null
}

function createTrumpSentence (maxLength) {
  return trump.start(wordsObject => {
    const words = Object.keys(wordsObject)
    const index = Math.floor(Math.random() * words.length)
    return words[index]
  }).end(sentence => {
    return sentence.length > maxLength
  }).process()
}

export default {
  bigify,
  extract
}
