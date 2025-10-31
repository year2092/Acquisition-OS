import React from 'react';
import { View, Deal, Task, DealStatus } from '../src/App';
import { SourcingResult } from './SourcingEngine';
import { IntegrationData } from './IntegrationHub';

interface CentralDashboardProps {
  onNavigate: (view: View) => void;
  deals: Deal[];
  tasks: Task[];
  sourcingResultsGlobal: SourcingResult[];
  integrationData: Record<string, IntegrationData>;
  currentProfileName: string | null;
}

// --- SVG Icons for Widgets ---
const IconDealPipeline = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const IconSourcing = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const IconTasks = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const IconWatchlist = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const IconQuickAccess = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>;


const CentralDashboard: React.FC<CentralDashboardProps> = ({ onNavigate, deals, tasks, sourcingResultsGlobal, integrationData, currentProfileName }) => {
  const widgetClasses = "bg-white rounded-lg shadow-sm p-6 flex flex-col";
  const titleClasses = "text-base font-semibold text-slate-800 mb-4 flex items-center";
  const linkClasses = "mt-auto text-sm font-medium text-amber-600 hover:text-amber-800 self-start pt-4 transition-colors";

  // --- Calculations ---
  const dealStatusCounts = deals.reduce((acc, deal) => {
    acc[deal.status] = (acc[deal.status] || 0) + 1;
    return acc;
  }, {} as Record<DealStatus, number>);

  const totalListingsFound = sourcingResultsGlobal.length;
  const scoredListings = sourcingResultsGlobal.filter(r => r.overallFitScore !== null);
  const averageFitScore = scoredListings.length > 0
    ? Math.round(scoredListings.reduce((sum, r) => sum + r.overallFitScore!, 0) / scoredListings.length)
    : 0;
  const topSourcedDeals = [...sourcingResultsGlobal]
    .filter(r => !r.error)
    .sort((a, b) => (b.overallFitScore || 0) - (a.overallFitScore || 0))
    .slice(0, 3);
        
  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    const dueDateObj = new Date(dueDate + 'T00:00:00');
    return dueDateObj < today;
  };

  const upcomingTasks = tasks
    .filter(t => t.status !== 'Done')
    .sort((a, b) => {
      const aIsOverdue = isOverdue(a.dueDate);
      const bIsOverdue = isOverdue(b.dueDate);
      if (aIsOverdue && !bIsOverdue) return -1;
      if (!aIsOverdue && bIsOverdue) return 1;

      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    })
    .slice(0, 4);
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeIntegrationsCount = deals.filter(d => d.status === 'Closed').length;
  
  const mostRecentViewedDeal = sourcingResultsGlobal.length > 0 ? sourcingResultsGlobal[0] : null;

  const getFitScoreColor = (score: number | null) => {
    if (score === null) return 'text-slate-500';
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      
      {/* Deal Pipeline Status */}
      <div className={widgetClasses}>
        <h3 className={titleClasses}><IconDealPipeline /> Deal Pipeline Status</h3>
        <ul className="space-y-3 text-sm">
            <li className="flex justify-between items-center"><span className="text-slate-600">Identified</span> <span className="font-bold text-slate-800">{dealStatusCounts['Identified'] || 0}</span></li>
            <li className="flex justify-between items-center"><span className="text-slate-600">Evaluating</span> <span className="font-bold text-slate-800">{dealStatusCounts['Evaluating'] || 0}</span></li>
            <li className="flex justify-between items-center"><span className="text-slate-600">LOI Sent</span> <span className="font-bold text-slate-800">{dealStatusCounts['LOI Sent'] || 0}</span></li>
            <li className="flex justify-between items-center"><span className="text-slate-600">Diligence</span> <span className="font-bold text-slate-800">{dealStatusCounts['Diligence'] || 0}</span></li>
        </ul>
        <button onClick={() => onNavigate('pipelineHub')} className={linkClasses}>
          View Full Pipeline &rarr;
        </button>
      </div>

      {/* Recent Sourcing Activity */}
      <div className={widgetClasses}>
        <h3 className={titleClasses}><IconSourcing /> Recent Sourcing Activity</h3>
        <div className="space-y-3">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="font-medium text-slate-600 text-sm">Listings Found (All Time)</span>
                <span className="text-2xl font-bold text-slate-800">{totalListingsFound}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="font-medium text-slate-600 text-sm">Average Fit Score</span>
                <span className="text-2xl font-bold text-amber-500">{averageFitScore}%</span>
            </div>
             <h4 className="text-sm font-semibold text-slate-700 pt-2">Top Recent Deals</h4>
             <ul className="text-sm space-y-2">
                {topSourcedDeals.length > 0 ? topSourcedDeals.map(deal => (
                    <li key={deal.url} className="flex justify-between">
                        <span className="truncate pr-4 text-slate-600">{deal.title}</span> 
                        <span className={`font-mono flex-shrink-0 font-semibold ${getFitScoreColor(deal.overallFitScore)}`}>{deal.overallFitScore}%</span>
                    </li>
                )) : <li className="text-slate-500">No deals sourced yet.</li>}
             </ul>
        </div>
        <button onClick={() => onNavigate('pipelineHub')} className={linkClasses}>
          Go to Sourcing Engine &rarr;
        </button>
      </div>

      {/* Upcoming Tasks & Deadlines */}
      <div className={widgetClasses}>
        <h3 className={titleClasses}><IconTasks /> Upcoming Tasks & Deadlines</h3>
        <ul className="space-y-2">
            {upcomingTasks.length > 0 ? upcomingTasks.map(task => (
                <li key={task.id} className={`p-3 rounded-lg ${isOverdue(task.dueDate) ? 'bg-red-100 border border-red-200' : 'bg-slate-50'}`}>
                    <p className={`font-medium text-sm ${isOverdue(task.dueDate) ? 'text-red-800' : 'text-slate-800'}`}>{task.title}</p>
                    <p className={`text-xs ${isOverdue(task.dueDate) ? 'text-red-600' : 'text-slate-500'}`}>
                        {isOverdue(task.dueDate) ? `Overdue - ${formatDate(task.dueDate)}` : `Due ${formatDate(task.dueDate)}`}
                    </p>
                </li>
            )) : <li className="text-slate-500 text-sm">No upcoming tasks.</li>}
        </ul>
        <button onClick={() => onNavigate('managementHub')} className={linkClasses}>
          View All Tasks &rarr;
        </button>
      </div>
      
      {/* Post-Acquisition Watchlist */}
       <div className={`${widgetClasses} xl:col-span-1`}>
        <h3 className={titleClasses}><IconWatchlist /> Post-Acquisition Watchlist</h3>
        {activeIntegrationsCount > 0 ? (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-600 bg-slate-50 rounded-lg p-4">
                <div className="text-4xl font-bold text-slate-800">{activeIntegrationsCount}</div>
                <div className="mt-1 text-sm">Active Integration{activeIntegrationsCount > 1 ? 's' : ''}</div>
            </div>
        ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-500 bg-slate-50 rounded-lg p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <p className="text-sm">No active integrations. Metrics will appear here post-closing.</p>
            </div>
        )}
      </div>

      {/* Quick Access */}
      <div className={`${widgetClasses} xl:col-span-2`}>
        <h3 className={titleClasses}><IconQuickAccess /> Quick Access</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
            <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs font-semibold text-slate-500 uppercase">Recently Viewed</p>
                <p className="font-semibold text-slate-800 mt-2">{mostRecentViewedDeal?.title || "N/A"}</p>
                <p className="text-xs text-slate-500">{mostRecentViewedDeal ? `Analyzed recently` : 'Analyze a deal to see it here'}</p>
            </div>
             <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-xs font-semibold text-slate-500 uppercase">Saved Profile</p>
                <p className="font-semibold text-slate-800 mt-2">{currentProfileName}</p>
                <p className="text-xs text-slate-500">Updated: Yesterday</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CentralDashboard;