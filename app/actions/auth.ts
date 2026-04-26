'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createSession, deleteSession, getSession } from '@/lib/session'

export async function register(username: string, pass: string) {
  try {
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return { success: false, error: 'El nombre de usuario ya está en uso' }
    }

    const hashedPassword = await bcrypt.hash(pass, 10)
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        score: 0
      }
    })

    await createSession(user.id, user.username)
    return { success: true, username: user.username }
  } catch (error) {
    return { success: false, error: 'Error al registrar' }
  }
}

export async function login(username: string, pass: string) {
  try {
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      return { success: false, error: 'Usuario o contraseña incorrectos' }
    }

    const valid = await bcrypt.compare(pass, user.password)
    if (!valid) {
      return { success: false, error: 'Usuario o contraseña incorrectos' }
    }

    await createSession(user.id, user.username)
    return { success: true, username: user.username }
  } catch (error) {
    return { success: false, error: 'Error al iniciar sesión' }
  }
}

export async function logout() {
  await deleteSession()
}

export async function getUser() {
  const session = await getSession()
  if (!session) return null

  const user = await prisma.user.findUnique({ 
    where: { id: session.userId },
    select: { 
      id: true, username: true, score: true,
      pvpWins: true, pvpLosses: true, rankScore: true,
      _count: { select: { sessions: true } }
    }
  })
  return user
}

export async function getMyStats() {
  const session = await getSession()
  if (!session) return null

  const recentMatches = await prisma.match.findMany({
    where: {
      OR: [{ player1Id: session.userId }, { player2Id: session.userId }],
      status: { in: ['finished', 'abandoned'] }
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      player1: { select: { username: true } },
      player2: { select: { username: true } }
    }
  })

  return recentMatches
}

export async function saveHighScore(newScore: number, wordsPlayedArray: string[] = [], difficulty: string = "aprendiz") {
  const session = await getSession()
  if (!session) return { success: false }

  const wordsPlayed = JSON.stringify(wordsPlayedArray)

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (user && newScore > user.score) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { score: newScore }
    })
    
    // Create a game session record
    await prisma.gameSession.create({
      data: {
        user: { connect: { id: user.id } },
        score: newScore,
        difficulty,
        wordsPlayed
      }
    })
    return { success: true, newRecord: true }
  }

  await prisma.gameSession.create({
    data: {
      user: { connect: { id: session.userId } },
      score: newScore,
      difficulty,
      wordsPlayed
    }
  })
  
  return { success: true, newRecord: false }
}

export async function changeMyPassword(currentPass: string, newPass: string) {
  const session = await getSession()
  if (!session) return { success: false, error: 'No autorizado' }

  if (!newPass || newPass.length < 4) return { success: false, error: 'Mínimo 4 caracteres' }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })
  if (!user) return { success: false, error: 'Usuario no encontrado' }

  const valid = await bcrypt.compare(currentPass, user.password)
  if (!valid) return { success: false, error: 'Contraseña actual incorrecta' }

  const hashedPassword = await bcrypt.hash(newPass, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  })

  return { success: true }
}
