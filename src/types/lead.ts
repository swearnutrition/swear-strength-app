// Lead management types

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'closed'

export type TrainingExperience =
  | 'Brand new to lifting'
  | 'Less than 1 year'
  | '1-3 years'
  | '3-5 years'
  | '5+ years'

export type TrainingFormat =
  | 'online'
  | 'hybrid'
  | 'in-person'

export type TrainingGoal =
  | 'Build strength'
  | 'Fix/improve technique'
  | 'General health & fitness'
  | 'Fat loss / weight loss'
  | 'Build muscle'
  | 'Improve posture'
  | 'Other'

export interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  trainingExperience: TrainingExperience
  goals: TrainingGoal[]
  trainingFormat: TrainingFormat
  currentSituation: string
  anythingElse: string | null
  status: LeadStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateLeadPayload {
  name: string
  email: string
  phone?: string
  trainingExperience: TrainingExperience
  goals: TrainingGoal[]
  trainingFormat: TrainingFormat
  currentSituation: string
  anythingElse?: string
}

export interface UpdateLeadPayload {
  status?: LeadStatus
  notes?: string
}

// Database row type (snake_case)
export interface LeadRow {
  id: string
  name: string
  email: string
  phone: string | null
  training_experience: string
  goals: string[]
  training_format: string
  current_situation: string
  anything_else: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

// Transform database row to frontend type
export function transformLead(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    trainingExperience: row.training_experience as TrainingExperience,
    goals: row.goals as TrainingGoal[],
    trainingFormat: row.training_format as TrainingFormat,
    currentSituation: row.current_situation,
    anythingElse: row.anything_else,
    status: row.status as LeadStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
