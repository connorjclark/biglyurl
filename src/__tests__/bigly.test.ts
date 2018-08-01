/* eslint-env jest */

import { bigify, smallify } from '../bigly'

describe('bigify is reversable', () => {
  const host = 'www.somehost.com'
  const tester = url => {
    it(url, () => {
      const biglyLink = bigify(host, url)
      expect(smallify(host, biglyLink.replace(host, ''))).toEqual(url)
    })
  }

  tester('google.com')
  tester('reddit.com')
  tester('https://www.reddit.com/r/The_Donald/comments/4ixqsz/be_honest_how_many_of_you_knew_the_words_disavow/?compact=true')
  tester('https://www.google.com/#q=trump')
})
