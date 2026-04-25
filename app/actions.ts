'use server';

import silabaJS from 'silabajs';
import spanishWords from 'an-array-of-spanish-words';

export type ValidationResult = {
  success: boolean;
  word?: string;
  error?: string;
  syllables?: string[];
  points?: number;
};

export async function submitWord(
  word: string,
  playedWords: string[]
): Promise<ValidationResult> {
  const cleanWord = word.trim().toLowerCase();

  if (!cleanWord) {
    return { success: false, error: 'Por favor, ingresa una palabra.' };
  }

  // Check 1: Has it been played?
  if (playedWords.includes(cleanWord)) {
    return { success: false, error: `La palabra "${cleanWord}" ya ha sido jugada.` };
  }

  // Check 2: Is it a valid Spanish word?
  // an-array-of-spanish-words has words with accents, so we check exact match.
  // We can also allow normalizations if needed, but exact match is safer first.
  const isValidWord = spanishWords.includes(cleanWord);
  if (!isValidWord) {
    return { success: false, error: `La palabra "${cleanWord}" no está en el diccionario.` };
  }

  // Check 3: Syllable logic
  const wordSyllables = silabaJS.getSilabas(cleanWord).numeroSilaba === 1 
    ? [cleanWord] 
    : silabaJS.getSilabas(cleanWord).silabas.map((s: any) => s.silaba);
  
  // If silabajs fails to split properly, it returns an empty array or something we might need to handle.
  if (!wordSyllables || wordSyllables.length === 0) {
    return { success: false, error: `Error al procesar las sílabas de "${cleanWord}".` };
  }

  const firstSyllable = wordSyllables[0];
  
  if (playedWords.length > 0) {
    const previousWord = playedWords[playedWords.length - 1];
    const prevSyllablesObj = silabaJS.getSilabas(previousWord);
    
    const prevSyllables = prevSyllablesObj.numeroSilaba === 1 
      ? [previousWord] 
      : prevSyllablesObj.silabas.map((s: any) => s.silaba);
      
    const lastSyllableOfPrev = prevSyllables[prevSyllables.length - 1];

    if (firstSyllable !== lastSyllableOfPrev) {
      return {
        success: false,
        error: `"${cleanWord}" empieza con "${firstSyllable}", pero debe empezar con "${lastSyllableOfPrev}" (última sílaba de "${previousWord}").`
      };
    }
  }

  // Calculate points: longer words give more points, max 10, min 2.
  const points = Math.min(Math.max(cleanWord.length, 2), 10);

  return {
    success: true,
    word: cleanWord,
    syllables: wordSyllables,
    points,
  };
}
