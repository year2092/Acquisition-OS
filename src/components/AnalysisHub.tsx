
import React, { useState } from 'react';
import CompanyProfiler from './CompanyProfiler';
import FinancialAnalysisHub, { FinancialAnalysisData } from './FinancialAnalysisHub';
import ValuationCalculator, { ValuationInputs } from './ValuationCalculator';
import FinancialProjectionModeler, { ProjectionData } from './FinancialProjectionModeler';
import ImageAnalyzer from './ImageAnalyzer';
import { GeneralProfileResult, ProfilerData, Deal } from '../App';
import { SourcingResult } from './SourcingEngine';

interface AnalysisHubProps {
  // CompanyProfiler props
  setGeneralProfile: React.Dispatch<React.SetStateAction<GeneralProfileResult | null>>;
  profilerData: ProfilerData;
  setProfilerData: React.Dispatch<React.SetStateAction<ProfilerData>>;
  onClearProfilerData: () => void;
  isProfilingGlobal: boolean;
  setIsProfilingGlobal: React.Dispatch<React.SetStateAction<boolean>>;
  profilingProgressMessage: string;
  setProfilingProgressMessage: React.Dispatch<React.SetStateAction<string>>;
  deals: Deal[];
  onAddToPipeline: (sourcingResult: SourcingResult) => void;

  // FinancialAnalysisHub props
  financialAnalysisData: FinancialAnalysisData | null;
  setFinancialAnalysisData: React.Dispatch<React.SetStateAction<FinancialAnalysisData | null>>;
  onClearFinancialAnalysisData: () => void;
  
  // ValuationCalculator props
  valuationInputs: ValuationInputs | null;
  setValuationInputs: React.Dispatch<React.SetStateAction<ValuationInputs | null>>;
  onClearValuationData: () => void;
  
  // FinancialProjectionModeler props
  projectionData: ProjectionData | null;
  setData: React.Dispatch<React.SetStateAction<ProjectionData | null>>; // prop name is 'setData' in component
  onClearProjectionData: () => void;
}

type AnalysisView = 'profiler' | 'financials' | 'valuation' | 'projections' | 'image';

const AnalysisHub: React.FC<AnalysisHubProps> = (props) => {
  const [analysisView, setAnalysisView] = useState<AnalysisView>('profiler');

  const navButtonClasses = (view: AnalysisView) => 
    `px-4 py-3 text-sm font-medium transition-colors ${
      analysisView === view 
      ? 'text-amber-600 border-b-2 border-amber-500' 
      : 'text-slate-500 hover:text-slate-800'
    }`;

  return (
    <div className="flex flex-col w-full">
      <nav className="flex justify-center flex-wrap border-b border-slate-200 mb-8 px-4 gap-x-4 sm:gap-x-8">
        <button onClick={() => setAnalysisView('profiler')} className={navButtonClasses('profiler')}>Company Profiler</button>
        <button onClick={() => setAnalysisView('financials')} className={navButtonClasses('financials')}>Financial Analysis</button>
        <button onClick={() => setAnalysisView('valuation')} className={navButtonClasses('valuation')}>Valuation</button>
        <button onClick={() => setAnalysisView('projections')} className={navButtonClasses('projections')}>Projections</button>
        <button onClick={() => setAnalysisView('image')} className={navButtonClasses('image')}>Image Analyzer</button>
      </nav>
      <main className="w-full">
        {analysisView === 'profiler' && (
          <CompanyProfiler
            setGeneralProfile={props.setGeneralProfile}
            profilerData={props.profilerData}
            setProfilerData={props.setProfilerData}
            onClear={props.onClearProfilerData}
            isProfilingGlobal={props.isProfilingGlobal}
            setIsProfilingGlobal={props.setIsProfilingGlobal}
            profilingProgressMessage={props.profilingProgressMessage}
            setProfilingProgressMessage={props.setProfilingProgressMessage}
            deals={props.deals}
            onAddToPipeline={props.onAddToPipeline}
          />
        )}
        {analysisView === 'financials' && (
          <FinancialAnalysisHub 
            data={props.financialAnalysisData}
            setData={props.setFinancialAnalysisData}
            onClear={props.onClearFinancialAnalysisData}
          />
        )}
        {analysisView === 'valuation' && (
          <ValuationCalculator 
            inputs={props.valuationInputs}
            setInputs={props.setValuationInputs}
            onClear={props.onClearValuationData}
          />
        )}
        {analysisView === 'projections' && (
           <FinancialProjectionModeler
            data={props.projectionData}
            setData={props.setData}
            onClear={props.onClearProjectionData}
            financialAnalysisData={props.financialAnalysisData}
            valuationInputs={props.valuationInputs}
          />
        )}
        {analysisView === 'image' && <ImageAnalyzer />}
      </main>
    </div>
  );
};

export default AnalysisHub;
