declare module 'markovchain' {
  class MarkovChain {
    constructor(content: string);

    start(str: string): MarkovChain
    start(fn: (wordList: string[]) => string): MarkovChain

    end(str: string): MarkovChain
    end(num: number): MarkovChain
    end(fn: (wordList: string[]) => boolean): MarkovChain

    process(): string
  }
  namespace markovchain {}
  export = MarkovChain;
}
