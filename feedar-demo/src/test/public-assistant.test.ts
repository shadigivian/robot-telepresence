import { describe, expect, it } from 'vitest'
import { seedDatabase } from '../data/seed'
import { answerPublicQuestion } from '../features/kiosk'

describe('public kiosk assistant', () => {
  it('answers only from published text in the paired organization', () => {
    const db = seedDatabase(1000)
    const hospital = db.organizations[0]
    db.knowledge.push({ id: 'foreign', organizationId: db.organizations[1].id, title: 'Confidential secretcode', text: 'Foreign organization secretcode material', category: 'faq', status: 'published', revision: 1, createdAt: 1000, updatedAt: 1000 })
    const answer = answerPublicQuestion(hospital, db.knowledge, db.points, 'secretcode', 'en')
    expect(answer.references).toEqual([])
    expect(answer.text).not.toContain('Foreign')
    expect(answer.tool).toBe('notify_admin')
    const services = answerPublicQuestion(hospital, db.knowledge, db.points, 'services', 'en')
    expect(services.text).toContain(hospital.name)
    expect(services.text).not.toContain(db.organizations[1].name)
    expect(services.references).toEqual(['Welcome and services'])
  })

  it('excludes draft, archived, and unindexed file contents', () => {
    const db = seedDatabase(1000)
    const org = db.organizations[0]
    const base = { organizationId: org.id, category: 'faq', revision: 1, createdAt: 1000, updatedAt: 1000 }
    db.knowledge.push(
      { ...base, id: 'draft', title: 'unpublishedtopic', text: 'draft-private-answer', status: 'draft' },
      { ...base, id: 'archived', title: 'unpublishedtopic', text: 'archived-private-answer', status: 'archived' },
      { ...base, id: 'pdf', title: 'unpublishedtopic', text: 'not-indexed-answer', status: 'published', filename: 'demo.pdf', indexing: 'not_configured' },
    )
    const answer = answerPublicQuestion(org, db.knowledge, db.points, 'unpublishedtopic', 'en')
    expect(answer.references).toEqual([])
    expect(answer.text).not.toMatch(/private-answer|not-indexed-answer/)
  })

  it('resolves Persian and Turkish location questions to the paired floor data', () => {
    const db = seedDatabase(1000)
    const org = db.organizations[0]
    for (const [question, language] of [['رادیولوژی کجاست؟', 'fa'], ['Radyoloji nerede?', 'tr']] as const) {
      const answer = answerPublicQuestion(org, db.knowledge, db.points, question, language)
      expect(answer.tool).toBe('find_location')
      const point = db.points.find(p => p.id === answer.pointId)
      expect(point?.name).toBe('Radiology')
      expect(point?.organizationId).toBe(org.id)
    }
  })

  it('preserves source references and honestly labels original-language knowledge', () => {
    const db = seedDatabase(1000)
    const org = db.organizations[0]
    const answer = answerPublicQuestion(org, db.knowledge, db.points, 'Çalışma saatleri', 'tr')
    expect(answer.references).toEqual(['Opening hours'])
    expect(answer.text).toContain('özgün dil')
    expect(answer.text).toContain(org.openingHours)
  })
})
