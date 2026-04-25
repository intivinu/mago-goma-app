'use server'

import { validateChain } from '@/lib/game'
import { prisma } from '@/lib/prisma'

export async function submitWord(
  currentWord: string,
  prevWord: string | null,
  playedWords: string[]
): Promise<{ success: boolean; reason?: string }> {
  const normalizedWord = currentWord.trim().toLowerCase()

  if (playedWords.includes(normalizedWord)) {
    return { success: false, reason: 'La palabra ya ha sido usada.' }
  }

  if (prevWord) {
    const chainValidation = validateChain(prevWord, normalizedWord)
    if (!chainValidation.valid) {
      return { success: false, reason: chainValidation.reason }
    }
  } else {
    const { isMonosyllabic } = await import('@/lib/game')
    if (isMonosyllabic(normalizedWord)) {
      return { success: false, reason: 'No se permiten palabras monosílabas.' }
    }
  }

  const wordExists = await prisma.word.findFirst({
    where: { text: normalizedWord }
  })

  if (!wordExists) {
    // Para simplificar, si no existe pero el usuario la envía, la aprendemos en modo juego 
    // real como pedía el HTML original, pero de forma controlada.
    // Vamos a rechazarla si no es válida.
    return { success: false, reason: 'La palabra no existe en el diccionario.' }
  }

  return { success: true }
}

export async function getWizardResponse(
  lastSyllable: string,
  difficulty: 'aprendiz' | 'sabio' | 'supremo',
  playedWords: string[]
): Promise<{ success: boolean; word?: string; action?: 'mirror' | 'surrender' }> {
  
  // Probabilidad de éxito del mago
  const rates = { aprendiz: 0.6, sabio: 0.8, supremo: 0.99 };
  const successProbability = rates[difficulty];

  if (Math.random() > successProbability) {
    // El mago falla. Decide si usar espejo o rendirse (lo controlará el frontend)
    return { success: false };
  }

  // Buscar una palabra válida en la BD que empiece con `lastSyllable`.
  // Necesitamos extraer todas las palabras y verificar sus sílabas con silabajs
  // Como SQLite no puede filtrar por sílabas directamente usando silabajs en SQL,
  // filtraremos por las que EMPIEZAN con las letras de la sílaba (LIKE 'sílaba%')
  // y luego validaremos en JS.
  
  const potentialMatches = await prisma.word.findMany({
    where: {
      text: {
        startsWith: lastSyllable
      },
      NOT: {
        text: {
          in: playedWords
        }
      }
    },
    orderBy: difficulty === 'aprendiz' 
      ? { level: 'asc' } 
      : difficulty === 'supremo' 
        ? { level: 'desc' } 
        : undefined,
    take: 150 
  });

  const { getFirstSyllable, removeAccents, isMonosyllabic } = await import('@/lib/game');

  // Shuffle para darle variabilidad
  const shuffledMatches = potentialMatches.sort(() => 0.5 - Math.random());

  // Si es Sabio, intentamos priorizar nivel 2. Si no, tomamos la primera válida.
  let bestMatch: string | undefined;

  for (const match of shuffledMatches) {
    if (isMonosyllabic(match.text)) continue;
    
    const firstSyllable = removeAccents(getFirstSyllable(match.text));
    if (firstSyllable === lastSyllable) {
      if (difficulty === 'sabio' && match.level === 2) {
        return { success: true, word: match.text };
      }
      if (!bestMatch) {
        bestMatch = match.text;
      }
      // En aprendiz y supremo, el orderBy ya hizo el trabajo pesado, devolvemos la primera válida
      if (difficulty !== 'sabio') {
         return { success: true, word: match.text };
      }
    }
  }

  if (bestMatch) return { success: true, word: bestMatch };

  // Si no encontró ninguna (muy raro, pero posible), falla
  return { success: false };
}
