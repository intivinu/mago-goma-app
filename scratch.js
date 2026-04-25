const silabaJS = require('silabajs');
const spanishWords = require('an-array-of-spanish-words');

const word = "goma";
const syllables = silabaJS.getSilabas(word);
console.log("Syllables for goma:", syllables);

const word2 = "mago";
const syllables2 = silabaJS.getSilabas(word2);
console.log("Syllables for mago:", syllables2);

console.log("Is 'goma' in dictionary?", spanishWords.includes('goma'));
