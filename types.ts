
export enum RaceStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED'
}

export enum PitStopStatus {
  PREPARING = 'PREPARING',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  APPROVED = 'APPROVED'
}

export enum UserRole {
  MARSHALL = 'MARSHALL',
  TEAM = 'TEAM'
}

export interface Driver {
  id: string;
  name: string;
  isPro: boolean;
  totalTimeDriven: number; // in milliseconds
}

export interface PitStop {
  id: string;
  teamId: string;
  driverIn: string;
  driverOut: string;
  batterySwap: boolean;
  startTime?: number;
  endTime?: number;
  duration?: number; // in milliseconds
  status: PitStopStatus;
}

export interface TeamRaceResult {
  teamId: string;
  teamName: string;
  pitStops: number;
  totalDriveTime: string;
  position: number;
}

export interface RaceHistoryEntry {
  id: string;
  name: string;
  date: string;
  durationMinutes: number;
  results: TeamRaceResult[];
}

export interface RaceTeam {
  id: string;
  name: string;
  password?: string;
  drivers: Driver[];
  isApproved: boolean;
  pitStops: PitStop[];
  currentDriverId: string;
  currentStintStartTime?: number;
  joinedRaceId?: string; // Tracks if team is in current pending/active race
  history: {
    raceName: string;
    date: string;
    result: string;
  }[];
}

export interface Race {
  id: string;
  name: string;
  durationMinutes: number;
  status: RaceStatus;
  startTime?: number;
  registeredTeamIds: string[]; // List of IDs for teams who joined this specific race
}
