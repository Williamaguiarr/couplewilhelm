import * as React from 'https://esm.sh/react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as operationalDailyReport } from './operational-daily-report.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'operational-daily-report': operationalDailyReport,
}
