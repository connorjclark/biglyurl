/* eslint-env jest */

import random from '../random'

describe('random.stub(seed)', () => {
  it('canary', () => {
    expect(1).toEqual(1)
  })

  it('is consistent', () => {
    random.stub('hello world')
    expect(Math.random()).toEqual(0.17549613970058886)
    expect(Math.random()).toEqual(0.967328219678111)
    expect(Math.random()).toEqual(0.05420353462204641)
  })
})
