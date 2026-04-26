'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { validateChain } from '@/lib/game'

async function assignMatchResult(winnerId: number | null, loserId: number | null) {
  if (winnerId) {
    await prisma.user.update({
      where: { id: winnerId },
      data: { pvpWins: { increment: 1 }, rankScore: { increment: 25 } }
    })
  }
  if (loserId) {
    await prisma.user.update({
      where: { id: loserId },
      data: { pvpLosses: { increment: 1 }, rankScore: { decrement: 15 } }
    })
    // Ensure rankScore doesn't drop below 0 if needed, but standard decrement is fine for now
  }
}

export async function findMatch() {
  const session = await getSession()
  if (!session) return { success: false, error: 'No autorizado' }

  const userId = session.userId

  // Check if already in a waiting or playing match
  const existingMatch = await prisma.match.findFirst({
    where: {
      OR: [
        { player1Id: userId, status: { in: ['waiting', 'playing'] } },
        { player2Id: userId, status: { in: ['waiting', 'playing'] } }
      ]
    }
  })

  if (existingMatch) return { success: true, matchId: existingMatch.id, status: existingMatch.status }

  // Try to find a waiting match
  const waitingMatch = await prisma.match.findFirst({
    where: { status: 'waiting', player1Id: { not: userId } }
  })

  if (waitingMatch) {
    // Join match
    await prisma.match.update({
      where: { id: waitingMatch.id },
      data: {
        player2Id: userId,
        status: 'playing',
        currentTurnId: waitingMatch.player1Id, // P1 starts
        lastMoveAt: new Date()
      }
    })
    return { success: true, matchId: waitingMatch.id, status: 'playing' }
  }

  // Create new match
  const newMatch = await prisma.match.create({
    data: {
      player1Id: userId,
      status: 'waiting'
    }
  })

  return { success: true, matchId: newMatch.id, status: 'waiting' }
}

export async function getMatchState(matchId: string) {
  const session = await getSession()
  if (!session) return { success: false, error: 'No autorizado' }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      player1: { select: { id: true, username: true } },
      player2: { select: { id: true, username: true } }
    }
  })

  if (!match) return { success: false, error: 'Partida no encontrada' }

  return { 
    success: true, 
    match: {
      ...match,
      wordsPlayed: JSON.parse(match.wordsPlayed),
      isMyTurn: match.currentTurnId === session.userId,
      me: match.player1Id === session.userId ? match.player1 : match.player2,
      opponent: match.player1Id === session.userId ? match.player2 : match.player1
    } 
  }
}

export async function playMatchWord(matchId: string, word: string) {
  const session = await getSession()
  if (!session) return { success: false, error: 'No autorizado' }

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match || match.status !== 'playing') return { success: false, error: 'Partida no activa' }
  if (match.currentTurnId !== session.userId) return { success: false, error: 'No es tu turno' }

  const normalizedWord = word.trim().toLowerCase()
  const wordsPlayed: string[] = JSON.parse(match.wordsPlayed)

  if (word === '__ESPEJO__') {
    const mirrorToken = `__MIRROR_${session.userId}__`;
    if (wordsPlayed.includes(mirrorToken)) {
      return { success: false, reason: 'Ya usaste tu espejo.' }
    }
    if (!match.lastWord || match.lastWord.startsWith('ERROR|')) {
      return { success: false, reason: 'No puedes usar espejo al inicio de la partida.' }
    }
    
    const nextTurnId = match.player1Id === session.userId ? match.player2Id : match.player1Id
    wordsPlayed.push(mirrorToken)
    await prisma.match.update({
      where: { id: matchId },
      data: {
        wordsPlayed: JSON.stringify(wordsPlayed),
        currentTurnId: nextTurnId,
        lastMoveAt: new Date()
      }
    })
    return { success: true }
  }

  let invalidReason = ''

  if (wordsPlayed.includes(normalizedWord)) {
    invalidReason = 'La palabra ya ha sido usada.'
  } else if (match.lastWord) {
    const chainValidation = validateChain(match.lastWord, normalizedWord)
    if (!chainValidation.valid) {
      invalidReason = chainValidation.reason || 'Sílaba incorrecta.'
    }
  } else {
    const { isMonosyllabic } = await import('@/lib/game')
    if (isMonosyllabic(normalizedWord)) {
      invalidReason = 'No se permiten palabras monosílabas.'
    }
  }

  if (!invalidReason) {
    const wordExists = await prisma.word.findFirst({
      where: { text: normalizedWord }
    })
    if (!wordExists) {
      invalidReason = 'La palabra no existe en el diccionario.'
    }
  }

  if (invalidReason) {
    const winnerId = match.player1Id === session.userId ? match.player2Id : match.player1Id
    await prisma.match.update({
      where: { id: matchId },
      data: { status: 'finished', winnerId, lastWord: `ERROR|${invalidReason}` }
    })
    await assignMatchResult(winnerId!, session.userId)
    return { success: false, reason: invalidReason }
  }

  // Valid move, change turn
  const nextTurnId = match.player1Id === session.userId ? match.player2Id : match.player1Id
  wordsPlayed.push(normalizedWord)

  await prisma.match.update({
    where: { id: matchId },
    data: {
      wordsPlayed: JSON.stringify(wordsPlayed),
      lastWord: normalizedWord,
      currentTurnId: nextTurnId,
      lastMoveAt: new Date()
    }
  })

  return { success: true }
}

export async function leaveMatch(matchId: string) {
  const session = await getSession()
  if (!session) return { success: false }

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return { success: false }

  if (match.status === 'waiting') {
    await prisma.match.delete({ where: { id: matchId } })
    return { success: true }
  }

  if (match.status === 'playing') {
    const winnerId = match.player1Id === session.userId ? match.player2Id : match.player1Id
    await prisma.match.update({
      where: { id: matchId },
      data: { status: 'abandoned', winnerId }
    })
    await assignMatchResult(winnerId!, session.userId)
  }

  return { success: true }
}

export async function checkTimeout(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match || match.status !== 'playing') return { success: false }

  const now = new Date()
  const diffSecs = (now.getTime() - match.lastMoveAt.getTime()) / 1000

  if (diffSecs >= 20) {
    // Current turn player timed out, other player wins
    const winnerId = match.currentTurnId === match.player1Id ? match.player2Id : match.player1Id
    await prisma.match.update({
      where: { id: matchId },
      data: { status: 'finished', winnerId }
    })
    
    await assignMatchResult(winnerId!, match.currentTurnId!)

    
    return { success: true, timeout: true }
  }

  return { success: true, timeout: false }
}
