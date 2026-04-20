export type ItemStatus = "pending" | "pass" | "fail" | "blocked" | "skip"

export interface TestItem {
  id: number
  section_id: number
  code: string
  order_num: number
  description: string
  status: ItemStatus
  notes: string | null
  tester_name: string | null
  error_description: string | null
  error_code: string | null
  updated_at: string
  created_at: string
}

export interface TestSection {
  id: number
  phase_id: number
  section_num: string
  title: string
  order_num: number
  notes: string | null
  items: TestItem[]
}

export interface TestPhase {
  id: number
  order_num: number
  title: string
  goal: string | null
  color_key: string
  notes: string | null
  sections: TestSection[]
}
