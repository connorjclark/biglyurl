/* eslint-env jest */

import bigly from '../bigly'

it('canary', () => {
  expect(1).toEqual(1)
})

describe('bigify is reversable', () => {
  let big = null

  beforeAll(done => {
    bigly.load('https://www.biglyurl.com', (err, instance) => {
      if (err) throw err

      big = instance
      done()
    })
  })

  const tester = url => {
    it(url, () => {
      const biglyLink = big.bigify(url)
      expect(big.smallify(biglyLink)).toEqual(url)
    })
  }

  tester('google.com')
  tester('reddit.com')
  tester('https://www.reddit.com/r/The_Donald/comments/4ixqsz/be_honest_how_many_of_you_knew_the_words_disavow/?compact=true')
  tester('https://www.google.com/#q=trump')
})
