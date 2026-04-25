'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function suggestWord(word: string) {
  const session = await getSession()
  if (!session) return { success: false, error: 'Debes iniciar sesión' }

  const text = word.trim().toLowerCase()
  if (text.length < 2 || text.includes(' ')) {
    return { success: false, error: 'Palabra inválida' }
  }

  // Check if it exists in main dictionary
  const exists = await prisma.word.findUnique({ where: { text } })
  if (exists) {
    return { success: false, error: 'La palabra ya existe en el diccionario' }
  }

  // Check if it's already suggested and pending
  const pending = await prisma.suggestedWord.findFirst({ 
    where: { text, status: 'pending' } 
  })
  if (pending) {
    return { success: false, error: 'Alguien más ya sugirió esta palabra' }
  }

  await prisma.suggestedWord.create({
    data: {
      text,
      userId: session.userId,
      status: 'pending'
    }
  })

  return { success: true }
}

export async function getWeeklyLeaderboard() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const sessions = await prisma.gameSession.findMany({
    where: {
      createdAt: { gte: sevenDaysAgo }
    },
    include: { user: true },
    orderBy: { score: 'desc' }
  })

  const groupLeaderboard = (difficulty: string) => {
    const diffSessions = sessions.filter(s => s.difficulty === difficulty);
    const topUsers = new Map<number, typeof diffSessions[0]>()
    
    for (const session of diffSessions) {
      if (!session.user) continue;
      if (!topUsers.has(session.user.id) || topUsers.get(session.user.id)!.score < session.score) {
        topUsers.set(session.user.id, session)
      }
    }

    return Array.from(topUsers.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => ({
        username: s.user!.username,
        score: s.score
      }))
  }

  return {
    aprendiz: groupLeaderboard('aprendiz'),
    sabio: groupLeaderboard('sabio'),
    supremo: groupLeaderboard('supremo')
  }
}
