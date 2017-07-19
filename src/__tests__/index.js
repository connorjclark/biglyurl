/* eslint-env jest */

import index from '../index'

it('canary', () => {
  expect(1).toEqual(1)
})

describe('bigify is reversable', () => {
  const tester = url => {
    it(url, () => {
      const biglyLink = index.bigify(url)
      expect(index.extract(biglyLink)).toEqual(url)
    })
  }

  tester('google.com')
  tester('reddit.com')
  tester('https://www.reddit.com/r/The_Donald/comments/4ixqsz/be_honest_how_many_of_you_knew_the_words_disavow/?compact=true')
  tester('https://www.google.com/#q=trump')
})
