import { v4 as uuidv4 } from 'uuid'
import type { LaunchRecord } from '../shared/types'
import { addHistory, getActiveProfileName, getHistory, clearHistory as clearStoredHistory } from './configStore'

export { getHistory, clearStoredHistory as clearHistory }

export function recordLaunch(
  projectPath: string,
  terminalMode: 'embedded' | 'external',
  model: string
): LaunchRecord {
  const record: LaunchRecord = {
    id: uuidv4(),
    projectPath,
    terminalMode,
    timestamp: Date.now(),
    model,
    profileName: getActiveProfileName()
  }

  addHistory(record)
  return record
}
