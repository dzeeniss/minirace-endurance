
import React, { useState, useEffect, useMemo } from 'react';
import { UserRole, RaceStatus, Race, RaceTeam, PitStopStatus, PitStop, Driver, RaceHistoryEntry, TeamRaceResult } from './types';
import { FlagIcon, ZapIcon, TimerIcon, UserIcon, SettingsIcon } from './components/Icons';
import { getRaceCommentary } from './services/gemini';
import { db } from './services/db';

// --- Utility ---
const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatTimer = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- Reusable UI ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, loading = false }: any) => {
  const base = "px-4 py-2 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/20",
    outline: "border border-slate-600 hover:bg-slate-800 text-slate-300",
    amber: "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20"
  };
  return (
    <button disabled={disabled || loading} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {loading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : children}
    </button>
  );
};

const Card = ({ children, className = "", title, headerAction }: any) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col ${className}`}>
    {title && (
      <div className="px-5 py-3 bg-slate-800/50 border-b border-slate-800 font-bold text-slate-300 flex items-center justify-between">
        <span className="truncate uppercase italic tracking-tighter">{title}</span>
        {headerAction}
      </div>
    )}
    <div className="p-5 flex-1">{children}</div>
  </div>
);

const HistoryTable = ({ history }: { history: RaceHistoryEntry[] }) => (
  <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
    {history.length === 0 ? (
      <div className="text-center py-12 text-slate-600 italic">No historical data available.</div>
    ) : (
      history.map((entry) => (
        <div key={entry.id} className="bg-black/20 border border-slate-800 rounded-xl p-4 hover:border-blue-500/30 transition-colors">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-lg font-black italic uppercase text-white">{entry.name}</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{entry.date} • {entry.durationMinutes}m Duration</p>
            </div>
            <div className="bg-blue-600/10 text-blue-400 text-[10px] font-black px-2 py-1 rounded uppercase">Archived</div>
          </div>
          <div className="space-y-2">
            {entry.results.map((res) => (
              <div key={res.teamId} className="flex items-center justify-between bg-slate-800/30 p-2 rounded text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-4 font-black text-slate-500">{res.position}.</span>
                  <span className="font-bold text-slate-200">{res.teamName}</span>
                </div>
                <div className="flex gap-4 font-mono text-[10px]">
                  <span className="text-amber-500">{res.pitStops} PITS</span>
                  <span className="text-slate-500">{res.totalDriveTime}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))
    )}
  </div>
);

// --- Cloud Setup Modal ---

const CloudSetupModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const savedConfig = localStorage.getItem('firebase_config');
  const initial = savedConfig ? JSON.parse(savedConfig) : {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  };

  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleTest = async () => {
    setStatus('testing');
    const success = await db.testConnection(form);
    if (success) {
      setStatus('success');
      setTimeout(() => onClose(), 1000);
    } else {
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl my-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-black italic uppercase text-white">Firebase Config</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">&times;</button>
        </div>
        
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">
          Paste your <span className="text-amber-400 font-bold">firebaseConfig</span> object details from the Firebase Console (Settings > General).
        </p>

        <div className="space-y-3">
          {Object.keys(form).map((key) => (
            <div key={key}>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{key}</label>
              <input 
                type="text" 
                value={form[key]} 
                onChange={e => setForm({...form, [key]: e.target.value})} 
                placeholder={`Enter ${key}...`} 
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          ))}
        </div>

        {status === 'error' && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded text-center font-bold">
            Connection Failed. Check your Firestore configuration.
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <Button onClick={handleTest} loading={status === 'testing'} variant={status === 'success' ? 'success' : 'amber'} className="flex-1 uppercase font-black italic">
            {status === 'success' ? 'CONNECTED!' : 'TEST & SAVE'}
          </Button>
          {!db.isLocalMode() && (
            <Button onClick={() => db.disconnect()} variant="outline" className="text-rose-500 border-rose-500/30">Disconnect</Button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main App Logic ---

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  
  const [race, setRace] = useState<Race | null>(null);
  const [teams, setTeams] = useState<RaceTeam[]>([]);
  const [history, setHistory] = useState<RaceHistoryEntry[]>([]);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [commentary, setCommentary] = useState("Awaiting data sync...");

  // Login UI States
  const [loginMode, setLoginMode] = useState<UserRole>(UserRole.TEAM);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const syncData = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const [r, t, h] = await Promise.all([db.getRace(), db.getTeams(), db.getHistory()]);
    setRace(r);
    setTeams(t);
    setHistory(h);
    setIsSyncing(false);
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (loginMode === UserRole.MARSHALL) {
      if (username === "minirace" && password === "NETIKRASVAIRAS") {
        setRole(UserRole.MARSHALL);
      } else {
        setLoginError("Invalid Marshall Credentials");
      }
    } else {
      const match = teams.find(t => t.name.toLowerCase() === username.toLowerCase() && t.password === password);
      if (match) {
        setRole(UserRole.TEAM);
        setCurrentTeamId(match.id);
      } else {
        setLoginError("Invalid Team Name or Password");
      }
    }
  };

  const updateRace = async (newRace: Race | null) => {
    await db.saveRace(newRace);
    setRace(newRace);
  };

  const updateTeams = async (newTeams: RaceTeam[]) => {
    await db.saveTeams(newTeams);
    setTeams(newTeams);
  };

  const updateHistory = async (newHistory: RaceHistoryEntry[]) => {
    await db.saveHistory(newHistory);
    setHistory(newHistory);
  };

  const triggerCommentary = async (raceName: string, eventType: string, teamName: string) => {
    const text = await getRaceCommentary(raceName, eventType, teamName);
    setCommentary(text);
  };

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl mb-6"><FlagIcon /></div>
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">miniRace <span className="text-blue-500">Endurance</span></h1>
            <p className="text-slate-500 mt-2">Professional Race Control</p>
          </div>
          <Card>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="flex p-1 bg-slate-800 rounded-lg">
                <button type="button" onClick={() => setLoginMode(UserRole.TEAM)} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${loginMode === UserRole.TEAM ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>TEAM LOGIN</button>
                <button type="button" onClick={() => setLoginMode(UserRole.MARSHALL)} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${loginMode === UserRole.MARSHALL ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>MARSHALL</button>
              </div>
              <div className="space-y-4">
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder={loginMode === UserRole.MARSHALL ? "Username" : "Team Name"} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {loginError && <div className="p-2 bg-rose-500/10 text-rose-500 text-xs text-center rounded border border-rose-500/20">{loginError}</div>}
              <Button type="submit" className="w-full h-12 uppercase italic font-black">Enter Control</Button>
            </form>
          </Card>
          
          <div className="flex justify-center">
            <button 
              onClick={() => setShowConfig(true)}
              className="text-[10px] font-black uppercase text-slate-600 hover:text-amber-400 tracking-widest flex items-center gap-2"
            >
              <SettingsIcon /> SETUP FIREBASE CLOUD
            </button>
          </div>
        </div>
        <CloudSetupModal isOpen={showConfig} onClose={() => setShowConfig(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20"><FlagIcon /></div>
          <div>
            <h1 className="font-black text-xl italic uppercase">miniRace <span className="text-blue-500">Endurance</span></h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{role} PANEL</span>
              <button 
                onClick={() => setShowConfig(true)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 border border-slate-800 hover:border-amber-500 transition-colors group`}
              >
                 <div className={`h-1.5 w-1.5 rounded-full ${db.isLocalMode() ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                 <span className="text-[8px] font-black uppercase text-slate-500 group-hover:text-amber-400">
                   {db.isLocalMode() ? 'Local Storage (Setup Firebase)' : 'Firebase Cloud Active'}
                 </span>
              </button>
            </div>
          </div>
        </div>

        {race && race.status === RaceStatus.RUNNING && (
          <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-xl border border-yellow-900/30">
            <TimerIcon />
            <span className="font-mono text-3xl font-bold text-yellow-500">
              {formatTimer(Math.max(0, (race.startTime! + race.durationMinutes * 60000) - Date.now()))}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => { setRole(null); setCurrentTeamId(null); }}>Logout</Button>
        </div>
      </header>

      <main className="p-6 max-w-[1400px] mx-auto pb-24">
        {role === UserRole.MARSHALL ? (
          <MarshallDashboard race={race} teams={teams} history={history} onUpdateRace={updateRace} onUpdateTeams={updateTeams} onUpdateHistory={updateHistory} triggerCommentary={triggerCommentary} />
        ) : (
          <TeamDashboard race={race} teams={teams} history={history} currentTeamId={currentTeamId} onUpdateRace={updateRace} onUpdateTeams={updateTeams} triggerCommentary={triggerCommentary} />
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-blue-950/20 backdrop-blur-xl border-t border-blue-900/20 px-6 py-3 z-40">
        <div className="flex items-center gap-4 max-w-[1400px] mx-auto">
          <div className="bg-blue-600 text-[10px] font-black uppercase px-2 py-0.5 rounded italic">Race Comms</div>
          <div className="text-blue-400 font-medium italic truncate">"{commentary}"</div>
        </div>
      </footer>

      <CloudSetupModal isOpen={showConfig} onClose={() => setShowConfig(false)} />
    </div>
  );
}

// --- Marshall Panel ---

function MarshallDashboard({ race, teams, history, onUpdateRace, onUpdateTeams, onUpdateHistory, triggerCommentary }: any) {
  const [newRaceName, setNewRaceName] = useState("");
  const [duration, setDuration] = useState(30);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPass, setNewTeamPass] = useState("");

  const startRace = async () => {
    const startTime = Date.now();
    await onUpdateRace({ ...race, status: RaceStatus.RUNNING, startTime });
    await onUpdateTeams(teams.map((t: any) => race.registeredTeamIds.includes(t.id) ? { ...t, currentStintStartTime: startTime } : t));
    triggerCommentary(race.name, "Race Start", "Grid");
  };

  const finishRace = async () => {
    if (!race) return;
    const results: TeamRaceResult[] = teams
      .filter((t: any) => race.registeredTeamIds.includes(t.id))
      .map((t: any, i: number) => ({
        teamId: t.id,
        teamName: t.name,
        pitStops: t.pitStops.length,
        totalDriveTime: formatDuration(t.drivers.reduce((acc, d) => acc + d.totalTimeDriven, 0)),
        position: i + 1
      }))
      .sort((a, b) => b.pitStops - a.pitStops);

    const entry: RaceHistoryEntry = {
      id: `hist-${Date.now()}`,
      name: race.name,
      date: new Date().toLocaleDateString(),
      durationMinutes: race.durationMinutes,
      results: results.map((r, i) => ({ ...r, position: i + 1 }))
    };

    await onUpdateHistory([entry, ...history]);
    await onUpdateTeams(teams.map((t: any) => ({ ...t, pitStops: [], currentStintStartTime: undefined, joinedRaceId: undefined, drivers: t.drivers.map((d: any) => ({ ...d, totalTimeDriven: 0 })) })));
    await onUpdateRace(null);
    triggerCommentary(race.name, "Finish", "Grid");
  };

  const createTeamAccount = async () => {
    if (!newTeamName || !newTeamPass) return;
    const newTeam: RaceTeam = { id: `t-${Math.random().toString(36).substr(2, 5)}`, name: newTeamName, password: newTeamPass, drivers: [], isApproved: false, pitStops: [], currentDriverId: "", history: [] };
    await onUpdateTeams([...teams, newTeam]);
    setNewTeamName(""); setNewTeamPass("");
  };

  const approvePitStop = async (teamId: string, pitId: string) => {
    await onUpdateTeams(teams.map(t => t.id === teamId ? { ...t, pitStops: t.pitStops.map(ps => ps.id === pitId ? { ...ps, status: PitStopStatus.APPROVED } : ps) } : t));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card title="Race Control">
          {!race ? (
            <div className="space-y-4">
              <input type="text" value={newRaceName} onChange={e => setNewRaceName(e.target.value)} placeholder="Event Name" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-1 focus:ring-blue-500" />
              <div className="flex gap-2">
                <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 outline-none" />
                <span className="text-xs text-slate-500 flex items-center">Minutes</span>
              </div>
              <Button onClick={() => onUpdateRace({ id: 'r1', name: newRaceName || "New Grand Prix", durationMinutes: duration, status: RaceStatus.PENDING, registeredTeamIds: [] })} className="w-full">Initialize Session</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center p-4 bg-blue-600/10 rounded-xl border border-blue-500/20">
                <p className="text-xl font-black italic uppercase text-white">{race.name}</p>
                <div className="flex justify-center gap-3 mt-2">
                  <span className="text-[10px] font-black text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded uppercase">{race.status}</span>
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded uppercase">{race.registeredTeamIds.length} TEAMS READY</span>
                </div>
              </div>
              {race.status === RaceStatus.PENDING && <Button onClick={startRace} disabled={race.registeredTeamIds.length === 0} variant="success" className="w-full h-14 uppercase font-black">Green Flag</Button>}
              {race.status === RaceStatus.RUNNING && <Button onClick={finishRace} variant="danger" className="w-full h-14 uppercase font-black">Checkered Flag</Button>}
              <Button onClick={() => onUpdateRace(null)} variant="outline" className="w-full text-xs">Abort Session</Button>
            </div>
          )}
        </Card>

        {db.isLocalMode() && (
          <Card title="Firebase Setup" className="border-amber-500/30">
            <div className="space-y-3">
               <div className="p-3 bg-amber-600/5 rounded border border-amber-600/20">
                  <p className="text-[10px] font-bold text-amber-500 uppercase mb-1">⚠️ Local Mode Only</p>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    To sync data between devices, you must connect a Firebase project.
                  </p>
                  <p className="text-[11px] mt-2 font-bold text-amber-400">
                    Click the "Firebase" badge in the header.
                  </p>
               </div>
            </div>
          </Card>
        )}

        <Card title="Team Accounts">
           <div className="space-y-3">
              <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Team Name" className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs outline-none" />
              <input type="text" value={newTeamPass} onChange={e => setNewTeamPass(e.target.value)} placeholder="Password" className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs outline-none" />
              <Button onClick={createTeamAccount} className="w-full text-xs py-2">Create Account</Button>
           </div>
        </Card>
      </div>

      <div className="lg:col-span-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
           <Card title="Live Grid Tracking" className="min-h-[400px]">
              <div className="space-y-4">
                 {teams.filter(t => race?.registeredTeamIds.includes(t.id)).length === 0 && (
                   <div className="text-center py-24 text-slate-600 italic">Grid is empty. Waiting for teams to join.</div>
                 )}
                 {teams.filter(t => race?.registeredTeamIds.includes(t.id)).map(t => {
                   const activePit = t.pitStops.find(ps => ps.status !== PitStopStatus.APPROVED);
                   return (
                     <div key={t.id} className={`p-4 rounded-xl border transition-all ${activePit ? 'bg-amber-500/10 border-amber-500/50 scale-[1.02]' : 'bg-black/20 border-slate-800'}`}>
                        <div className="flex justify-between items-start mb-3">
                           <div>
                             <h4 className="font-black text-lg italic uppercase">{t.name}</h4>
                             <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t.drivers.length} Driver Roster</p>
                           </div>
                           <div className="text-right">
                              <span className="text-[10px] font-black text-slate-500 block">Pilot</span>
                              <span className="text-xs font-bold text-emerald-400 uppercase tracking-tighter">{t.drivers.find(d => d.id === t.currentDriverId)?.name || '---'}</span>
                           </div>
                        </div>
                        {activePit ? (
                           <div className="flex justify-between items-center bg-amber-500/20 p-2 rounded">
                              <span className="text-[10px] font-black text-amber-500 uppercase">PIT ACTION: {activePit.status}</span>
                              {activePit.status === PitStopStatus.COMPLETED && (
                                <Button onClick={() => approvePitStop(t.id, activePit.id)} variant="success" className="py-1 px-3 text-[10px]">Release Car</Button>
                              )}
                           </div>
                        ) : (
                           <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-slate-500">TRACK POSITION: OK</span>
                              <LiveStintDisplay startTime={t.currentStintStartTime} isRunning={race?.status === RaceStatus.RUNNING} />
                           </div>
                        )}
                     </div>
                   );
                 })}
              </div>
           </Card>
           <Card title="Race History Archive">
              <HistoryTable history={history} />
           </Card>
        </div>
      </div>
    </div>
  );
}

// --- Team Panel ---

function TeamDashboard({ race, teams, history, currentTeamId, onUpdateRace, onUpdateTeams, triggerCommentary }: any) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedStart, setSelectedStart] = useState("");
  const [loading, setLoading] = useState(false);

  const team = teams.find((t: any) => t.id === currentTeamId);

  const registerRoster = async () => {
    if (drivers.length < 2) return;
    setLoading(true);
    await onUpdateTeams(teams.map((t: any) => t.id === currentTeamId ? { ...t, drivers, isApproved: true, currentDriverId: drivers[0].id } : t));
    setLoading(false);
  };

  const joinRace = async () => {
    if (!race || !selectedStart) return;
    setLoading(true);
    const updatedRace = { ...race, registeredTeamIds: [...new Set([...race.registeredTeamIds, currentTeamId])] };
    await onUpdateRace(updatedRace);
    await onUpdateTeams(teams.map((t: any) => t.id === currentTeamId ? { ...t, joinedRaceId: race.id, currentDriverId: selectedStart } : t));
    setLoading(false);
  };

  if (!team) return null;

  if (team.drivers.length === 0) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card title="Driver Registration">
          <div className="space-y-6">
            <div className="flex gap-2">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full Name" className="flex-1 bg-slate-800 border border-slate-700 rounded px-3" />
              <Button onClick={() => { if(newName) setDrivers([...drivers, { id: Math.random().toString(), name: newName, isPro: false, totalTimeDriven: 0 }]); setNewName(""); }} className="text-xs">Add</Button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {drivers.map(d => (
                <div key={d.id} className="text-xs bg-black/40 p-3 rounded flex justify-between border border-slate-800">
                  <span className="font-bold">{d.name}</span>
                  <button onClick={() => setDrivers(drivers.filter(dr => dr.id !== d.id))} className="text-rose-500 font-black">REMOVE</button>
                </div>
              ))}
            </div>
            <Button onClick={registerRoster} disabled={drivers.length < 2} loading={loading} className="w-full h-12 uppercase italic font-black">Finalize Roster</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (race?.status === RaceStatus.PENDING && !team.joinedRaceId) {
    return (
      <div className="max-w-md mx-auto py-12">
        <Card title="Active Session Found">
          <div className="space-y-6">
            <div className="text-center py-10 bg-emerald-600/10 rounded-2xl border-2 border-dashed border-emerald-600/30">
              <h3 className="text-3xl font-black italic text-white mb-2">{race.name}</h3>
              <p className="text-slate-500 uppercase text-[10px] tracking-widest font-bold">Registration Open</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center block">First Pilot Out</label>
              <select value={selectedStart} onChange={e => setSelectedStart(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg font-bold outline-none">
                <option value="">Select Pilot...</option>
                {team.drivers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <Button onClick={joinRace} disabled={!selectedStart} loading={loading} className="w-full h-20 text-2xl uppercase font-black italic shadow-xl shadow-blue-500/20">Commit to Grid</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card title="Team Dashboard">
          <div className="space-y-4">
             <div className="p-4 bg-blue-600/10 rounded-xl border border-blue-500/20 text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Live Stint Time</p>
                <div className="text-3xl font-black text-white italic">
                  {race?.status === RaceStatus.RUNNING ? (
                    <LiveStintDisplay startTime={team.currentStintStartTime} isRunning={!team.pitStops.some(ps => ps.status !== PitStopStatus.APPROVED)} />
                  ) : '00:00:00'}
                </div>
             </div>
             <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pilot Rotation</p>
                {team.drivers.map((d: any) => (
                  <div key={d.id} className={`flex justify-between p-2 rounded text-[10px] border ${d.id === team.currentDriverId ? 'bg-blue-600/20 border-blue-500/50' : 'bg-slate-800/30 border-slate-800'}`}>
                    <span className="font-bold">{d.name}</span>
                    <span className="font-mono">{formatDuration(d.totalTimeDriven)}</span>
                  </div>
                ))}
             </div>
          </div>
        </Card>
        <Card title="Event Records">
           <HistoryTable history={history} />
        </Card>
      </div>
      <div className="lg:col-span-3">
        {team.joinedRaceId && race?.status !== RaceStatus.PENDING ? (
           <TeamPitManager team={team} race={race} teams={teams} onUpdateTeams={onUpdateTeams} triggerCommentary={triggerCommentary} />
        ) : (
           <Card title="Paddock Status">
              <div className="flex flex-col items-center justify-center py-32 text-center">
                 <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mb-6 animate-pulse shadow-xl shadow-blue-500/10"><TimerIcon /></div>
                 <h2 className="text-3xl font-black italic uppercase text-white mb-2">Engines Off</h2>
                 <p className="text-slate-500 max-w-sm">System initialized for <strong>{team.name}</strong>. Awaiting official race start from Control.</p>
              </div>
           </Card>
        )}
      </div>
    </div>
  );
}

function TeamPitManager({ team, race, teams, onUpdateTeams, triggerCommentary }: any) {
  const [config, setConfig] = useState({ driverIn: "", batterySwap: false });
  const [pitTimer, setPitTimer] = useState<number | null>(null);

  const activePit = team.pitStops.find((ps: any) => ps.status !== PitStopStatus.APPROVED);

  const markReady = async () => {
    const newPit = { id: Math.random().toString(), teamId: team.id, ...config, driverOut: team.currentDriverId, status: PitStopStatus.READY };
    await onUpdateTeams(teams.map((t: any) => t.id === team.id ? { ...t, pitStops: [...t.pitStops, newPit] } : t));
  };

  const startPit = async () => {
    const now = Date.now();
    await onUpdateTeams(teams.map((t: any) => {
      if (t.id === team.id) {
        const stint = t.currentStintStartTime ? (now - t.currentStintStartTime) : 0;
        return {
          ...t,
          drivers: t.drivers.map((d: any) => d.id === t.currentDriverId ? { ...d, totalTimeDriven: d.totalTimeDriven + stint } : d),
          pitStops: t.pitStops.map((ps: any) => ps.status === PitStopStatus.READY ? { ...ps, status: PitStopStatus.IN_PROGRESS, startTime: now } : ps)
        };
      }
      return t;
    }));
    setPitTimer(0);
    triggerCommentary(race.name, "Pit Entry", team.name);
  };

  const stopPit = async () => {
    const now = Date.now();
    await onUpdateTeams(teams.map((t: any) => {
      if (t.id === team.id) {
        const current = t.pitStops.find((ps: any) => ps.status === PitStopStatus.IN_PROGRESS);
        return {
          ...t,
          currentDriverId: current.driverIn,
          currentStintStartTime: now,
          pitStops: t.pitStops.map((ps: any) => ps.status === PitStopStatus.IN_PROGRESS ? { ...ps, status: PitStopStatus.COMPLETED, endTime: now, duration: now - ps.startTime! } : ps)
        };
      }
      return t;
    }));
    setPitTimer(null);
  };

  useEffect(() => {
    if (pitTimer !== null) {
      const it = setInterval(() => setPitTimer(p => (p || 0) + 1), 1000);
      return () => clearInterval(it);
    }
  }, [pitTimer]);

  if (pitTimer !== null) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-10">
        <h2 className="text-7xl font-black italic text-amber-500 mb-8 animate-pulse tracking-tighter uppercase">Pit Stop Active</h2>
        <div className="text-[12rem] font-mono font-bold text-white leading-none mb-12 shadow-inner">
          {Math.floor(pitTimer / 60)}:{(pitTimer % 60).toString().padStart(2, '0')}
        </div>
        <Button onClick={stopPit} variant="success" className="w-80 h-32 text-4xl uppercase font-black italic shadow-2xl">Complete Service</Button>
      </div>
    );
  }

  return (
    <Card title="Race Service Operations">
      {activePit ? (
        <div className="text-center py-20 space-y-8">
           {activePit.status === PitStopStatus.READY ? (
              <div className="space-y-8 max-w-sm mx-auto">
                 <div className="h-24 w-24 bg-blue-600 rounded-full mx-auto flex items-center justify-center animate-bounce shadow-xl shadow-blue-500/30"><TimerIcon /></div>
                 <h3 className="text-4xl font-black italic text-white uppercase">Confirm Arrival</h3>
                 <Button onClick={startPit} variant="amber" className="w-full h-24 text-3xl font-black italic uppercase shadow-xl">Engage Timer</Button>
              </div>
           ) : (
              <div className="space-y-4">
                 <div className="text-emerald-500 font-black text-6xl animate-pulse uppercase tracking-tighter">Box Exit</div>
                 <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-6">Awaiting Marshall Signal to Rejoin Grid</p>
                 <div className="bg-slate-800 inline-block p-5 rounded-2xl border border-slate-700 mt-4 shadow-xl">
                    <p className="text-[10px] text-slate-500 uppercase mb-1 font-black">Total Stationary</p>
                    <p className="text-4xl font-mono text-white">{formatDuration(activePit.duration || 0)}</p>
                 </div>
              </div>
           )}
        </div>
      ) : (
        <div className="space-y-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Incoming Pilot</label>
              <select value={config.driverIn} onChange={e => setConfig({...config, driverIn: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-4 rounded-xl font-black text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                <option value="">Next Driver...</option>
                {team.drivers.filter((d:any) => d.id !== team.currentDriverId).map((d:any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <button 
                onClick={() => setConfig({...config, batterySwap: !config.batterySwap})} 
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all h-[64px] ${config.batterySwap ? 'bg-amber-600/10 border-amber-600 text-amber-500 shadow-lg shadow-amber-600/10' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'}`}
              >
                <span className="font-black uppercase tracking-widest text-xs">Full Battery Swap</span>
                <ZapIcon />
              </button>
            </div>
          </div>
          <Button onClick={markReady} disabled={!config.driverIn} className="w-full h-24 text-3xl uppercase font-black italic shadow-2xl hover:scale-[1.01]">Ready for Box</Button>
        </div>
      )}
    </Card>
  );
}

const LiveStintDisplay = ({ startTime, isRunning }: { startTime?: number; isRunning: boolean }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || !startTime) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(interval);
  }, [startTime, isRunning]);

  return <span className="font-mono text-emerald-400">{formatTimer(elapsed)}</span>;
};
