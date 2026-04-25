import { getSyllables } from 'silabajs';

export function getWordSyllables(word: string) {
  return getSyllables(word.toLowerCase());
}

export function isMonosyllabic(word: string) {
  const result = getSyllables(word.toLowerCase());
  return result.syllableCount === 1;
}

export function getLastSyllable(word: string): string {
  const result = getSyllables(word.toLowerCase());
  if (!result || result.syllableCount === 0) return '';
  return result.syllables[result.syllables.length - 1].syllable;
}

export function getFirstSyllable(word: string): string {
  const result = getSyllables(word.toLowerCase());
  if (!result || result.syllableCount === 0) return '';
  return result.syllables[0].syllable;
}

export function getRequiredNextSyllable(currentWord: string): string {
  let lastSyllable = getLastSyllable(currentWord);
  
  // The 'RR' Rule
  if (lastSyllable.includes('rr')) {
    lastSyllable = lastSyllable.replace('rr', 'r');
  }

  // Handle accents - usually words are chained without strictly requiring accents
  // But we can strip accents to be safe or keep them if strict.
  // Let's remove accents for the matching base.
  return removeAccents(lastSyllable);
}

export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function validateChain(prevWord: string, nextWord: string): { valid: boolean; reason?: string } {
  if (isMonosyllabic(nextWord)) {
    return { valid: false, reason: 'No se permiten palabras monosílabas.' };
  }

  const requiredPrefix = getRequiredNextSyllable(prevWord);
  const nextWordFirstSyllable = removeAccents(getFirstSyllable(nextWord));

  if (nextWordFirstSyllable !== requiredPrefix) {
    return { valid: false, reason: `La palabra debe empezar con la sílaba "${requiredPrefix}".` };
  }

  return { valid: true };
}
