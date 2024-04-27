import bm25 from 'wink-bm25-text-search';
import similarity from 'compute-cosine-similarity';
import winkNLP from 'wink-nlp';
import winkModel from 'wink-eng-lite-web-model';

// Test similarity
var cosSim = similarity([1, 2], [2, 3]);
console.log(cosSim);

const nlp = winkNLP(winkModel);
const its = nlp.its;

const prepTask = function (text) {
    const tokens = [];
    nlp.readDoc(text)
        .tokens()
        // Use only words ignoring punctuations etc and from them remove stop words
        .filter((t) => (t.out(its.type) === 'word' && !t.out(its.stopWordFlag)))
        // Handle negation and extract stem of the word
        .each((t) => tokens.push((t.out(its.negationFlag)) ? '!' + t.out(its.stem) : t.out(its.stem)));

    return tokens;
};

// Expose packages
export { similarity, bm25, winkNLP, winkModel, prepTask, nlp }