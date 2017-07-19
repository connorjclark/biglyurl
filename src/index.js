import MarkovChain from 'markovchain'
import random from './random'

// https://www.boutell.com/newfaq/misc/urllength.html
const MAX_URL_LENGTH = 2000

var isNode = false
if (typeof process === 'object') {
  if (typeof process.versions === 'object') {
    if (typeof process.versions.node !== 'undefined') {
      isNode = true
    }
  }
}

function fetch (resource, cb) {
  if (!isNode) {
    var xobj = new XMLHttpRequest()

    xobj.overrideMimeType('application/json')
    xobj.open('GET', '/' + resource, true)

    xobj.onreadystatechange = () => {
      if (xobj.readyState === 4) {
        if (xobj.status === 200) {
          cb(null, xobj.responseText)
        } else {
          cb(new Error('could not fetch resource'))
        }
      }
    }

    xobj.onerror = () => {
      cb(new Error('could not fetch resource'))
    }

    xobj.send(null)
  } else {
    require('fs').readFile(resource, 'utf8', cb)
  }
}

function load (domain, cb) {
  fetch('trump.txt', (err, text) => {
    if (err) throw err

    const seedWords = text.replace(/[-,"!?.()]/g, ' ')
    const trump = new MarkovChain(seedWords)

    function bigify (url) {
      let result = ''

      const charactersLeft = () => MAX_URL_LENGTH - result.length

      result += domain + '/v1.0.0/'

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

    cb(null, {
      bigify,
      extract
    })
  })
}

export default { load }
