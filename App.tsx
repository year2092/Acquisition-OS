import React, { useState, useCallback, useEffect, useContext } from 'react';
import CentralDashboard from './components/CentralDashboard';
import BuyBox from './components/BuyBox';
import { SourcingResult } from './components/SourcingEngine';
import { FinancialAnalysisData } from './components/FinancialAnalysisHub';
import { ValuationInputs } from './components/ValuationCalculator';
import { ProjectionData } from './components/FinancialProjectionModeler';
import { IntegrationData } from './components/IntegrationHub';
import PipelineHub from './src/components/PipelineHub';
import AnalysisHub from './src/components/AnalysisHub';
import ManagementHub from './src/components/ManagementHub';
import Login from './src/components/Login';
import { AuthContext } from './src/contexts/AuthContext';
import { auth } from './src/firebase/config';
import { signOut } from 'firebase/auth';

// Interfaces remain the same...
export interface BuyBoxCriteria {
  geography: { value: string; weight: number };
  industryType: { value: string; weight: number };
  minSde: { value: number; weight: number };
  maxSde: { value: number; weight: number };
  customerConcentration: { value: number; weight: number };
  minRecurringRevenue: { value: number; weight: number };
  growthLevers: { sales: boolean; ops: boolean; consolidation: boolean; weight: number };
  industryTrends: { value: string; weight: number };
  industryExpertise: { industry: string; proficiency: 'Beginner' | 'Intermediate' | 'Expert' }[];
  sellerRole: { value: 'absentee' | 'operator' | 'keyPerson' | 'any' | ''; weight: number };
  teamStrength: { value: string; weight: number };
  businessModel: { value: 'assetLight' | 'assetHeavy' | 'any' | ''; weight: number };
  systemMessiness: { value: number; weight: number };
  myPrimaryRole: { value: 'dayToDay' | 'manager' | 'any' | ''; weight: number };
  desiredCulture: string;
  desiredCultureRationale: string;
  personalGoal: string;
  personalGoalRationale: string;
}
export interface GeneralProfileResult {
  insights: string;
  profile: string;
  sourceUrl?: string;
}
export interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  assignee: string;
  description: string;
  category: string;
  attachments: string[];
  dealId?: string;
}
export interface ProfilerData {
  analysisResult: { insights: string; profile: string; };
  sources: any[] | null;
  urlInput: string;
}
export interface FitAnalysisData {
  scorecardResult: string;
  fitAnalysisSources: any[] | null;
  overallFitScore?: number | null;
}
export interface SavedProfile {
  name: string;
  criteria: BuyBoxCriteria;
}
export type DealStatus = "Identified" | "Contacted" | "Evaluating" | "LOI Sent" | "Diligence" | "Closing" | "Closed" | "Lost";
export interface DealContact { id: string; name: string; role: string; email: string; phone: string; }
export interface KeyTerms { purchasePrice: string; structure: string; sellerNote: string; nwcPeg: string; }
export interface ChecklistItem { id: string; text: string; completed: boolean; }
export interface Deal {
  id: string;
  companyName: string;
  status: DealStatus;
  sourcingResult: SourcingResult;
  keyTerms: KeyTerms;
  contacts: DealContact[];
  timeline: { loiSigned: string; diligenceEnd: string; targetClose: string; };
  closingChecklist: ChecklistItem[];
  notes: string;
}

export type View = 'dashboard' | 'buybox' | 'pipelineHub' | 'analysisHub' | 'managementHub';

const defaultBuyBoxCriteria: BuyBoxCriteria = {
  geography: { value: 'Texas', weight: 2 },
  industryType: { value: 'B2B Facility Services', weight: 3 },
  minSde: { value: 400000, weight: 3 },
  maxSde: { value: 800000, weight: 3 },
  customerConcentration: { value: 30, weight: 2 },
  minRecurringRevenue: { value: 0, weight: 1 },
  growthLevers: { sales: false, ops: false, consolidation: false, weight: 1 },
  industryTrends: { value: 'Fragmented', weight: 1 },
  industryExpertise: [],
  sellerRole: { value: 'operator', weight: 2 },
  teamStrength: { value: 'Has a manager in place', weight: 2 },
  businessModel: { value: 'assetLight', weight: 1 },
  systemMessiness: { value: 3, weight: 1 },
  myPrimaryRole: { value: 'manager', weight: 1 },
  desiredCulture: 'Professional, team-oriented',
  desiredCultureRationale: '',
  personalGoal: 'Flexibility',
  personalGoalRationale: '',
};

// ... (useHistory hook remains the same)
const useHistory = <T,>(initialState: T) => {
  const [history, setHistory] = useState({ past: [] as T[], present: initialState, future: [] as T[] });
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const set = useCallback((newStateAction: React.SetStateAction<T>) => {
    setHistory(currentHistory => {
      const newPresent = typeof newStateAction === 'function' ? (newStateAction as (prevState: T) => T)(currentHistory.present) : newStateAction;
      if (JSON.stringify(newPresent) === JSON.stringify(currentHistory.present)) return currentHistory;
      const newPast = [...currentHistory.past, currentHistory.present];
      return { past: newPast, present: newPresent, future: [] };
    });
  }, []);
  const undo = useCallback(() => {
    if (!canUndo) return;
    setHistory(currentHistory => {
      const newPast = currentHistory.past.slice(0, currentHistory.past.length - 1);
      const previousState = currentHistory.past[currentHistory.past.length - 1];
      const newFuture = [currentHistory.present, ...currentHistory.future];
      return { past: newPast, present: previousState, future: newFuture };
    });
  }, [canUndo]);
  const redo = useCallback(() => {
    if (!canRedo) return;
    setHistory(currentHistory => {
      const nextState = currentHistory.future[0];
      const newFuture = currentHistory.future.slice(1);
      const newPast = [...currentHistory.past, currentHistory.present];
      return { past: newPast, present: nextState, future: newFuture };
    });
  }, [canRedo]);
  return { state: history.present, setState: set, undo, redo, canUndo, canRedo };
};


function App() {
  const { user, loading } = useContext(AuthContext);

  const { state: buyBox, setState: setBuyBox, undo, redo, canUndo, canRedo } = useHistory<BuyBoxCriteria>(defaultBuyBoxCriteria);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [currentProfileName, setCurrentProfileName] = useState<string | null>('Default');
  const [isSourcingGlobal, setIsSourcingGlobal] = useState(false);
  const [isAnalyzingGlobal, setIsAnalyzingGlobal] = useState(false);
  const [sourcingProgressMessage, setSourcingProgressMessage] = useState('');
  const [isProfilingGlobal, setIsProfilingGlobal] = useState(false);
  const [profilingProgressMessage, setProfilingProgressMessage] = useState('');
  const [profilerData, setProfilerData] = useState<ProfilerData>({ analysisResult: { insights: '', profile: '' }, sources: null, urlInput: 'http://' });
  const [valuationInputs, setValuationInputs] = useState<ValuationInputs | null>(null);
  const [sourcingResultsGlobal, setSourcingResultsGlobal] = useState<SourcingResult[]>([]);
  const [fitAnalysis, setFitAnalysis] = useState<FitAnalysisData>({ scorecardResult: '', fitAnalysisSources: null, overallFitScore: null });
  const [financialAnalysisData, setFinancialAnalysisData] = useState<FinancialAnalysisData | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [projectionData, setProjectionData] = useState<ProjectionData | null>(null);
  const [integrationData, setIntegrationData] = useState<Record<string, IntegrationData>>({});
  const [websiteList, setWebsiteList] = useState<string>('');
  const [generalProfile, setGeneralProfile] = useState<GeneralProfileResult | null>(null);

  // --- User-specific Local Storage Keys ---
  const uid = user?.uid;
  const DEAL_ROOM_TASKS_LOCAL_STORAGE_KEY = `dealRoomTasks_${uid}`;
  const SAVED_PROFILES_LOCAL_STORAGE_KEY = `buyBoxProfiles_${uid}`;
  const PROFILER_DATA_KEY = `companyProfilerData_${uid}`;
  const VALUATION_INPUTS_KEY = `valuationCalculatorInputs_${uid}`;
  const SOURCING_RESULTS_KEY = `sourcingEngineResults_${uid}`;
  const FIT_ANALYSIS_KEY = `buyBoxFitAnalysis_${uid}`;
  const FINANCIAL_ANALYSIS_KEY = `financialAnalysisData_${uid}`;
  const DEALS_PIPELINE_KEY = `dealsPipeline_${uid}`;
  const PROJECTION_DATA_KEY = `projectionData_${uid}`;
  const INTEGRATION_DATA_KEY = `integrationData_${uid}`;
  const WEBSITE_LIST_KEY = `sourcingWebsiteList_${uid}`; // Can be user specific or global, user-specific for now

  // --- Data Loading Effect ---
  useEffect(() => {
    if (!uid) return; // Don't load data if user is not logged in

    try {
        const savedProfilerData = localStorage.getItem(PROFILER_DATA_KEY);
        if (savedProfilerData) setProfilerData(JSON.parse(savedProfilerData));
        const savedValuationInputs = localStorage.getItem(VALUATION_INPUTS_KEY);
        if (savedValuationInputs) setValuationInputs(JSON.parse(savedValuationInputs));
        const savedSourcingResults = localStorage.getItem(SOURCING_RESULTS_KEY);
        if (savedSourcingResults) setSourcingResultsGlobal(JSON.parse(savedSourcingResults));
        const savedFitAnalysis = localStorage.getItem(FIT_ANALYSIS_KEY);
        if (savedFitAnalysis) setFitAnalysis(JSON.parse(savedFitAnalysis));
        const savedFinancialAnalysis = localStorage.getItem(FINANCIAL_ANALYSIS_KEY);
        if (savedFinancialAnalysis) setFinancialAnalysisData(JSON.parse(savedFinancialAnalysis));
        const savedDeals = localStorage.getItem(DEALS_PIPELINE_KEY);
        if (savedDeals) setDeals(JSON.parse(savedDeals));
        const savedProjectionData = localStorage.getItem(PROJECTION_DATA_KEY);
        if (savedProjectionData) setProjectionData(JSON.parse(savedProjectionData));
        const savedIntegrationData = localStorage.getItem(INTEGRATION_DATA_KEY);
        if (savedIntegrationData) setIntegrationData(JSON.parse(savedIntegrationData));
        const savedWebsiteList = localStorage.getItem(WEBSITE_LIST_KEY);
        if (savedWebsiteList) setWebsiteList(JSON.parse(savedWebsiteList));
        const savedTasks = localStorage.getItem(DEAL_ROOM_TASKS_LOCAL_STORAGE_KEY);
        if (savedTasks) setTasks(JSON.parse(savedTasks));

        const storedProfiles = localStorage.getItem(SAVED_PROFILES_LOCAL_STORAGE_KEY);
        let initialProfiles = storedProfiles ? JSON.parse(storedProfiles) : [];
        if (initialProfiles.length === 0) {
          const defaultProfile: SavedProfile = { name: 'Default', criteria: defaultBuyBoxCriteria };
          initialProfiles.push(defaultProfile);
          localStorage.setItem(SAVED_PROFILES_LOCAL_STORAGE_KEY, JSON.stringify(initialProfiles));
        }
        setSavedProfiles(initialProfiles);
        
        const defaultProf = initialProfiles.find((p: SavedProfile) => p.name === 'Default');
        if (defaultProf) {
            setBuyBox(defaultProf.criteria);
            setCurrentProfileName('Default');
        }

    } catch (error) {
        console.error("Failed to load persisted data from local storage", error);
    }
  }, [uid, setBuyBox]); // This effect re-runs when the user logs in/out

  // --- Clear state on logout ---
  useEffect(() => {
    if (!user && !loading) {
      setBuyBox(defaultBuyBoxCriteria);
      setTasks([]);
      setSavedProfiles([]);
      setCurrentProfileName('Default');
      setProfilerData({ analysisResult: { insights: '', profile: '' }, sources: null, urlInput: 'http://' });
      setValuationInputs(null);
      setSourcingResultsGlobal([]);
      setFitAnalysis({ scorecardResult: '', fitAnalysisSources: null, overallFitScore: null });
      setFinancialAnalysisData(null);
      setDeals([]);
      setProjectionData(null);
      setIntegrationData({});
      setWebsiteList('');
      setGeneralProfile(null);
    }
  }, [user, loading, setBuyBox]);

  // --- Data Saving Effects ---
  useEffect(() => { if(uid) localStorage.setItem(PROFILER_DATA_KEY, JSON.stringify(profilerData)); }, [profilerData, uid]);
  useEffect(() => { if(uid && valuationInputs) localStorage.setItem(VALUATION_INPUTS_KEY, JSON.stringify(valuationInputs)); }, [valuationInputs, uid]);
  useEffect(() => { if(uid) localStorage.setItem(SOURCING_RESULTS_KEY, JSON.stringify(sourcingResultsGlobal)); }, [sourcingResultsGlobal, uid]);
  useEffect(() => { if(uid) localStorage.setItem(FIT_ANALYSIS_KEY, JSON.stringify(fitAnalysis)); }, [fitAnalysis, uid]);
  useEffect(() => { if(uid && financialAnalysisData) localStorage.setItem(FINANCIAL_ANALYSIS_KEY, JSON.stringify(financialAnalysisData)); }, [financialAnalysisData, uid]);
  useEffect(() => { if(uid) localStorage.setItem(SAVED_PROFILES_LOCAL_STORAGE_KEY, JSON.stringify(savedProfiles)); }, [savedProfiles, uid]);
  useEffect(() => { if(uid) localStorage.setItem(DEALS_PIPELINE_KEY, JSON.stringify(deals)); }, [deals, uid]);
  useEffect(() => { if(uid && projectionData) localStorage.setItem(PROJECTION_DATA_KEY, JSON.stringify(projectionData)); }, [projectionData, uid]);
  useEffect(() => { if(uid) localStorage.setItem(INTEGRATION_DATA_KEY, JSON.stringify(integrationData)); }, [integrationData, uid]);
  useEffect(() => { if(uid) localStorage.setItem(WEBSITE_LIST_KEY, JSON.stringify(websiteList)); }, [websiteList, uid]);
  useEffect(() => { if(uid) localStorage.setItem(DEAL_ROOM_TASKS_LOCAL_STORAGE_KEY, JSON.stringify(tasks)); }, [tasks, uid]);


  useEffect(() => {
    if (profilerData && (profilerData.analysisResult.profile || profilerData.analysisResult.insights)) {
        setGeneralProfile({
            insights: profilerData.analysisResult.insights,
            profile: profilerData.analysisResult.profile,
            sourceUrl: profilerData.urlInput,
        });
    } else {
        setGeneralProfile(null);
    }
  }, [profilerData]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  // Data Clearing handlers remain mostly the same, just clearing state
  const handleClearProfilerData = () => setProfilerData({ analysisResult: { insights: '', profile: '' }, sources: null, urlInput: 'http://' });
  const handleClearValuationData = () => setValuationInputs(null);
  const handleClearSourcingData = () => setSourcingResultsGlobal([]);
  const handleClearFitAnalysisData = () => setFitAnalysis({ scorecardResult: '', fitAnalysisSources: null, overallFitScore: null });
  const handleClearFinancialAnalysisData = () => setFinancialAnalysisData(null);
  const handleClearProjectionData = () => setProjectionData(null);

  // Profile Management handlers remain mostly the same
  const handleNewProfile = () => {
    setBuyBox(defaultBuyBoxCriteria);
    setCurrentProfileName(null);
    showToast("New profile form cleared. Adjust criteria and save with a new name.");
  };

  const handleSaveProfile = (name: string) => {
    const existingProfile = savedProfiles.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingProfile) {
        if (!window.confirm(`A profile named "${name}" already exists. Do you want to overwrite it?`)) return;
        const updatedProfiles = savedProfiles.map(p => p.name.toLowerCase() === name.toLowerCase() ? { name, criteria: buyBox } : p);
        setSavedProfiles(updatedProfiles);
    } else {
        const newProfile: SavedProfile = { name, criteria: buyBox };
        setSavedProfiles(prev => [...prev, newProfile]);
    }
    setCurrentProfileName(name);
    showToast(`Profile "${name}" saved!`);
  };

  const handleLoadProfile = (name: string) => {
      const profileToLoad = savedProfiles.find(p => p.name === name);
      if (profileToLoad) {
          setBuyBox(profileToLoad.criteria);
          setCurrentProfileName(name);
          showToast(`Profile "${name}" loaded!`);
      }
  };

  const handleRenameProfile = (oldName: string, newName: string) => {
    if (!newName || !newName.trim() || newName.trim().toLowerCase() === oldName.toLowerCase()) return;
    const nameExists = savedProfiles.some(p => p.name.toLowerCase() === newName.trim().toLowerCase());
    if (nameExists) {
        alert(`A profile named "${newName}" already exists.`);
        return;
    }
    const updatedProfiles = savedProfiles.map(p => p.name === oldName ? { ...p, name: newName.trim() } : p);
    setSavedProfiles(updatedProfiles);
    if (currentProfileName === oldName) setCurrentProfileName(newName.trim());
    showToast(`Profile "${oldName}" renamed to "${newName.trim()}".`);
  };

  const handleDeleteProfile = (name: string) => {
    if (name === 'Default') {
        alert("The 'Default' profile cannot be deleted.");
        return;
    }
    if (window.confirm(`Are you sure you want to delete the profile "${name}"?`)) {
        setSavedProfiles(prev => prev.filter(p => p.name !== name));
        if (currentProfileName === name) {
            const defaultProfile = savedProfiles.find(p => p.name === 'Default');
            if(defaultProfile) {
                setBuyBox(defaultProfile.criteria);
                setCurrentProfileName('Default');
            } else {
                 setBuyBox(defaultBuyBoxCriteria);
                 setCurrentProfileName(null);
            }
        }
        showToast(`Profile "${name}" deleted!`);
    }
  };

  const handleAddTask = (taskTitle: string, taskDescription: string, category: string, dealId?: string) => {
    const newTask: Task = { id: crypto.randomUUID(), title: taskTitle.trim(), priority: 'Medium', status: 'To Do', dueDate: null, assignee: 'Buyer', category, description: taskDescription, attachments: [], dealId };
    setTasks(prevTasks => [newTask, ...prevTasks]);
    showToast(`Task "${taskTitle.trim()}" added.`);
  };

  const handleAddToPipeline = (sourcingResult: SourcingResult) => {
    const checklist: ChecklistItem[] = [
      { id: crypto.randomUUID(), text: 'Finalize Purchase Agreement (APA/SPA)', completed: false },
      { id: crypto.randomUUID(), text: 'Secure Final Loan Approval & Commitment Letter', completed: false },
    ];
    const newDeal: Deal = {
        id: crypto.randomUUID(),
        companyName: sourcingResult.title || new URL(sourcingResult.url).hostname,
        status: "Identified", sourcingResult,
        keyTerms: { purchasePrice: '', structure: '', sellerNote: '', nwcPeg: '' },
        contacts: [], timeline: { loiSigned: '', diligenceEnd: '', targetClose: '' },
        closingChecklist: checklist, notes: '',
    };
    setDeals(prev => [...prev, newDeal]);
    showToast(`${newDeal.companyName} added to Deal Pipeline.`);
  };

  // Navigation handlers remain the same
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      const validViews: View[] = ['dashboard', 'buybox', 'pipelineHub', 'analysisHub', 'managementHub'];
      if (validViews.includes(hash as View)) setActiveView(hash as View);
      else setActiveView('dashboard');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  const handleNavClick = (view: View) => {
    setActiveView(view);
    window.location.hash = `#/${view}`;
  };
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast("You have been logged out.");
    } catch (error) {
      console.error("Logout error", error);
      showToast("Error logging out.");
    }
  };

  // --- Conditional Rendering for Auth ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-amber-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <p className="mt-2 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }
  
  // Main app content...
  const navItems = [
    { id: 'dashboard', label: 'Dashboard' }, { id: 'buybox', label: 'My Buy Box' },
    { id: 'pipelineHub', label: 'Sourcing Engine' }, { id: 'analysisHub', label: 'Analysis Hub' },
    { id: 'managementHub', label: 'Management Hub' },
  ];

  const renderActiveView = () => {
    // ... (switch statement remains the same, but with updated props)
    switch (activeView) {
      case 'dashboard': return <CentralDashboard onNavigate={handleNavClick} deals={deals} tasks={tasks} sourcingResultsGlobal={sourcingResultsGlobal} integrationData={integrationData} currentProfileName={currentProfileName} />;
      case 'pipelineHub': return <PipelineHub buyBox={buyBox} onAddTask={handleAddTask} sourcingResultsGlobal={sourcingResultsGlobal} setSourcingResultsGlobal={setSourcingResultsGlobal} onClearSourcingData={handleClearSourcingData} isSourcingGlobal={isSourcingGlobal} setIsSourcingGlobal={setIsSourcingGlobal} isAnalyzingGlobal={isAnalyzingGlobal} setIsAnalyzingGlobal={setIsAnalyzingGlobal} sourcingProgressMessage={sourcingProgressMessage} setSourcingProgressMessage={setSourcingProgressMessage} savedProfiles={savedProfiles} currentProfileName={currentProfileName} onLoadProfile={handleLoadProfile} deals={deals} onAddToPipeline={handleAddToPipeline} setDeals={setDeals} tasks={tasks} websiteList={websiteList} setWebsiteList={setWebsiteList} />;
      case 'analysisHub': return <AnalysisHub setGeneralProfile={setGeneralProfile} profilerData={profilerData} setProfilerData={setProfilerData} onClearProfilerData={handleClearProfilerData} isProfilingGlobal={isProfilingGlobal} setIsProfilingGlobal={setIsProfilingGlobal} profilingProgressMessage={profilingProgressMessage} setProfilingProgressMessage={setProfilingProgressMessage} deals={deals} onAddToPipeline={handleAddToPipeline} financialAnalysisData={financialAnalysisData} setFinancialAnalysisData={setFinancialAnalysisData} onClearFinancialAnalysisData={handleClearFinancialAnalysisData} valuationInputs={valuationInputs} setValuationInputs={setValuationInputs} onClearValuationData={handleClearValuationData} projectionData={projectionData} setData={setProjectionData} onClearProjectionData={handleClearProjectionData} />;
      case 'managementHub': return <ManagementHub tasks={tasks} setTasks={setTasks} onAddTask={handleAddTask} deals={deals} integrationData={integrationData} setIntegrationData={setIntegrationData} />;
      case 'buybox': return <BuyBox buyBox={buyBox} setBuyBox={setBuyBox} undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} generalProfile={generalProfile} savedProfiles={savedProfiles} currentProfileName={currentProfileName} onSaveProfile={handleSaveProfile} onLoadProfile={handleLoadProfile} onDeleteProfile={handleDeleteProfile} onRenameProfile={handleRenameProfile} onNewProfile={handleNewProfile} fitAnalysis={fitAnalysis} setFitAnalysis={setFitAnalysis} onClearFitAnalysis={handleClearFitAnalysisData} />;
      default: return null;
    }
  }

  const isTaskRunning = isSourcingGlobal || isAnalyzingGlobal || isProfilingGlobal;

  return (
    <div className={`max-w-screen-xl mx-auto p-4 sm:p-6 lg:p-8 text-slate-800 ${isTaskRunning ? 'pb-24' : ''}`}>
        <header className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Acquisition OS</h1>
                <p className="text-sm text-slate-500 mt-1">Your Operating System for Buying Businesses</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">Welcome, {user.displayName || user.email}</span>
              <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
              </button>
            </div>
        </header>
        <nav className="mb-8 border-b border-slate-200">
            <div className="flex items-center gap-x-8">
                {navItems.map(item => (<button key={item.id} type="button" onClick={() => handleNavClick(item.id as View)} className={`py-3 text-sm font-medium transition-colors ${activeView === item.id ? 'text-amber-600 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-800'}`}>{item.label}</button>))}
            </div>
        </nav>
        <main>{renderActiveView()}</main>
        {toastMessage && <div className="toast">{toastMessage}</div>}
        {isTaskRunning && (<div className="globalStatus">{isSourcingGlobal && 'Sourcing: Finding deals...'}{isAnalyzingGlobal && `Sourcing: ${sourcingProgressMessage}`}{isProfilingGlobal && `Profiler: ${profilingProgressMessage}`}</div>)}
    </div>
  );
}

export default App;