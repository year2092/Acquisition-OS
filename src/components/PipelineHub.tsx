
import React, { useState } from 'react';
import SourcingEngine, { SourcingResult } from './SourcingEngine';
import DealPipeline from './DealPipeline';
import { BuyBoxCriteria, SavedProfile, Deal, Task } from '../App';

interface PipelineHubProps {
  // Props for SourcingEngine
  buyBox: BuyBoxCriteria;
  onAddTask: (taskTitle: string, taskDescription: string, category: string, dealId?: string) => void;
  sourcingResultsGlobal: SourcingResult[];
  setSourcingResultsGlobal: React.Dispatch<React.SetStateAction<SourcingResult[]>>;
  onClearSourcingData: () => void;
  isSourcingGlobal: boolean;
  setIsSourcingGlobal: React.Dispatch<React.SetStateAction<boolean>>;
  isAnalyzingGlobal: boolean;
  setIsAnalyzingGlobal: React.Dispatch<React.SetStateAction<boolean>>;
  sourcingProgressMessage: string;
  setSourcingProgressMessage: React.Dispatch<React.SetStateAction<string>>;
  savedProfiles: SavedProfile[];
  currentProfileName: string | null;
  onLoadProfile: (name: string) => void;
  onAddToPipeline: (sourcingResult: SourcingResult) => void;
  websiteList: string;
  setWebsiteList: React.Dispatch<React.SetStateAction<string>>;
  
  // Props for DealPipeline
  deals: Deal[];
  setDeals: React.Dispatch<React.SetStateAction<Deal[]>>;
  tasks: Task[];
}

type PipelineView = 'sourcing' | 'pipeline';

const PipelineHub: React.FC<PipelineHubProps> = (props) => {
  const [pipelineView, setPipelineView] = useState<PipelineView>('sourcing');

  const navButtonClasses = (view: PipelineView) => 
    `px-4 py-3 text-sm font-medium transition-colors ${
      pipelineView === view 
      ? 'text-amber-600 border-b-2 border-amber-500' 
      : 'text-slate-500 hover:text-slate-800'
    }`;

  return (
    <div className="flex flex-col w-full">
      <nav className="flex justify-center border-b border-slate-200 mb-8 px-4 gap-x-8">
        <button onClick={() => setPipelineView('sourcing')} className={navButtonClasses('sourcing')}>
          Deal Sourcing Engine
        </button>
        <button onClick={() => setPipelineView('pipeline')} className={navButtonClasses('pipeline')}>
          Deal Pipeline
        </button>
      </nav>
      <main className="w-full">
        {pipelineView === 'sourcing' && (
          <SourcingEngine 
            buyBox={props.buyBox}
            onAddTask={props.onAddTask}
            sourcingResultsGlobal={props.sourcingResultsGlobal}
            setSourcingResultsGlobal={props.setSourcingResultsGlobal}
            onClear={props.onClearSourcingData}
            isSourcingGlobal={props.isSourcingGlobal}
            setIsSourcingGlobal={props.setIsSourcingGlobal}
            isAnalyzingGlobal={props.isAnalyzingGlobal}
            setIsAnalyzingGlobal={props.setIsAnalyzingGlobal}
            sourcingProgressMessage={props.sourcingProgressMessage}
            setSourcingProgressMessage={props.setSourcingProgressMessage}
            savedProfiles={props.savedProfiles}
            currentProfileName={props.currentProfileName}
            onLoadProfile={props.onLoadProfile}
            deals={props.deals}
            onAddToPipeline={props.onAddToPipeline}
            websiteList={props.websiteList}
            setWebsiteList={props.setWebsiteList}
          />
        )}
        {pipelineView === 'pipeline' && (
          <DealPipeline
            deals={props.deals}
            setDeals={props.setDeals}
            tasks={props.tasks}
            onAddTask={props.onAddTask}
          />
        )}
      </main>
    </div>
  );
};

export default PipelineHub;
