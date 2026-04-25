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
    select: { id: true, username: true, score: true }
  })
  return user
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

  // Create a game session record anyway
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
