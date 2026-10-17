export namespace RNGdle {
  type Session = {
    session: {
      expiresAt: string
      token: string
      createdAt: string
      updatedAt: string
      ipAddress: string
      userAgent: string
      userId: string
      id: string
    }
    user: {
      name: string | null
      email: string
      emailVerified: boolean
      emailHash?: string
      image: null
      createdAt: string
      updatedAt: string
      displayName: string | null
      displayNameColor: string
      canSetColor: boolean
      isAdmin: boolean
      dailyRollLimitExempt: boolean
      canAccessExperiments: boolean
      id: string
      banned?: boolean
    }
  }
  type Roll = {
    number: number
    badges: {
      id: string
      label: string
      description: string
      score: number
      emoji: string
      isScoring: boolean
      family: string
      isNew: boolean
    }[]
    totalScore: number
    lifetimeEp: {
      before: number
      after: number
    }
    recorded: boolean
  }
  type Rarity = 'trash'|'common'|'uncommon'|'rare'|'epic'|'anomaly'|'mythic'
}