export interface NavLink {
  id: number
  title: string
  url: string
  icon: string
  category: string
  sortOrder: number
  createdAt: string
}

export interface Alert {
  id: number
  type: string
  severity: string
  title: string
  message: string
  refId: string | null
  acknowledged: boolean
  createdAt: string
}

export interface DashboardSection {
  id: string
  title: string
  visible: boolean
}

export interface DashboardConfig {
  sections: DashboardSection[]
}
