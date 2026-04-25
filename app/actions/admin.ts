'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

async function verifyAdmin() {
  const session = await getSession()
  if (!session || session.username !== 'intivinu') {
    throw new Error('Unauthorized')
  }
}

export async function searchWords(query: string, level: number = 0, matchType: 'contains' | 'startsWith' | 'endsWith' = 'contains') {
  await verifyAdmin()
  if (!query.trim() && level === 0) return []
  
  const where: any = {}
  if (query.trim()) {
    if (matchType === 'startsWith') {
      where.text = { startsWith: query.toLowerCase() }
    } else if (matchType === 'endsWith') {
      where.text = { endsWith: query.toLowerCase() }
    } else {
      where.text = { contains: query.toLowerCase() }
    }
  }
  if (level > 0) where.level = level

  const words = await prisma.word.findMany({
    where,
    take: 100,
    orderBy: { text: 'asc' },
    select: { id: true, text: true, level: true }
  })
  return words
}

export async function deleteWord(id: number) {
  await verifyAdmin()
  try {
    await prisma.word.delete({ where: { id } })
    return { success: true }
  } catch(e) {
    return { success: false }
  }
}

export async function updateWordLevel(id: number, level: number) {
  await verifyAdmin()
  await prisma.word.update({
    where: { id },
    data: { level }
  })
  return { success: true }
}

export async function addWordsBulk(wordsList: string[]) {
  await verifyAdmin()
  
  // Normalizar y limpiar
  const validWords = wordsList
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 1 && !w.includes(' '))

  const uniqueWords = [...new Set(validWords)]

  // Filtrar existentes
  const existingWords = await prisma.word.findMany({
    where: { text: { in: uniqueWords } },
    select: { text: true }
  })
  
  const existingSet = new Set(existingWords.map(w => w.text))
  const newWords = uniqueWords.filter(w => !existingSet.has(w))

  if (newWords.length === 0) return { success: true, count: 0 }

  // Insertar en lotes pequeños para SQLite
  const getLevel = (word: string) => {
    if (word.length <= 6) return 1;
    if (word.length <= 9) return 2;
    return 3;
  };

  const chunkSize = 500;
  for (let i = 0; i < newWords.length; i += chunkSize) {
    const chunk = newWords.slice(i, i + chunkSize);
    const batch = chunk.map(text => prisma.word.create({ 
      data: { text, level: getLevel(text) } 
    }));
    await prisma.$transaction(batch);
  }

  return { success: true, count: newWords.length }
}

export async function getStats() {
  await verifyAdmin()
  const totalWords = await prisma.word.count()
  return { totalWords }
}

export async function getUsers() {
  await verifyAdmin()
  const users = await prisma.user.findMany({
    select: { 
      id: true, 
      username: true, 
      score: true, 
      createdAt: true,
      _count: {
        select: {
          suggestions: {
            where: { status: 'approved' }
          }
        }
      }
    },
    orderBy: { score: 'desc' }
  })
  return users
}

export async function getPendingSuggestions() {
  await verifyAdmin()
  return await prisma.suggestedWord.findMany({
    where: { status: 'pending' },
    include: { user: { select: { username: true } } },
    orderBy: { createdAt: 'desc' }
  })
}

export async function resolveSuggestion(id: number, approve: boolean) {
  await verifyAdmin()
  const suggestion = await prisma.suggestedWord.findUnique({ where: { id } })
  if (!suggestion || suggestion.status !== 'pending') return { success: false }

  if (approve) {
    // Check if it exists in word list just in case
    const exists = await prisma.word.findUnique({ where: { text: suggestion.text } })
    if (!exists) {
      const getLevel = (word: string) => {
        if (word.length <= 6) return 1;
        if (word.length <= 9) return 2;
        return 3;
      };
      await prisma.word.create({ 
        data: { text: suggestion.text, level: getLevel(suggestion.text) } 
      })
    }
  }

  await prisma.suggestedWord.update({
    where: { id },
    data: { status: approve ? 'approved' : 'rejected' }
  })

  return { success: true }
}

export async function resetUserPassword(userId: number, newPassword: string) {
  await verifyAdmin()
  if (!newPassword || newPassword.length < 4) return { success: false, error: 'Mínimo 4 caracteres' }
  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  })
  return { success: true }
}
