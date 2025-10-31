
import React, { useState } from 'react';
import DealRoomTasks from './DealRoomTasks';
import MandaChecklist from './MandaChecklist';
import VirtualDealRoom from './VirtualDealRoom';
import IntegrationHub, { IntegrationData } from './IntegrationHub';
import { Task, Deal } from '../App';

interface ManagementHubProps {
  // DealRoomTasks props
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;

  // VirtualDealRoom & IntegrationHub props
  onAddTask: (taskTitle: string, taskDescription: string, category: string, dealId?: string) => void;
  
  // IntegrationHub props
  deals: Deal[]; // closed deals
  integrationData: Record<string, IntegrationData>;
  setIntegrationData: React.Dispatch<React.SetStateAction<Record<string, IntegrationData>>>;
}

type ManagementView = 'tasks' | 'checklist' | 'vdr' | 'integration';

const ManagementHub: React.FC<ManagementHubProps> = (props) => {
  const [managementView, setManagementView] = useState<ManagementView>('tasks');

  const navButtonClasses = (view: ManagementView) => 
    `px-4 py-3 text-sm font-medium transition-colors ${
      managementView === view 
      ? 'text-amber-600 border-b-2 border-amber-500' 
      : 'text-slate-500 hover:text-slate-800'
    }`;

  return (
    <div className="flex flex-col w-full">
      <nav className="flex justify-center flex-wrap border-b border-slate-200 mb-8 px-4 gap-x-4 sm:gap-x-8">
        <button onClick={() => setManagementView('tasks')} className={navButtonClasses('tasks')}>Deal Room Tasks</button>
        <button onClick={() => setManagementView('checklist')} className={navButtonClasses('checklist')}>M&A Checklist</button>
        <button onClick={() => setManagementView('vdr')} className={navButtonClasses('vdr')}>Virtual Deal Room</button>
        <button onClick={() => setManagementView('integration')} className={navButtonClasses('integration')}>Integration Hub</button>
      </nav>
      <main className="w-full">
        {managementView === 'tasks' && (
          <DealRoomTasks 
            tasks={props.tasks}
            setTasks={props.setTasks}
          />
        )}
        {managementView === 'checklist' && <MandaChecklist />}
        {managementView === 'vdr' && <VirtualDealRoom onAddTask={props.onAddTask} />}
        {managementView === 'integration' && (
          <IntegrationHub 
            deals={props.deals.filter(d => d.status === 'Closed')}
            tasks={props.tasks}
            onAddTask={props.onAddTask}
            integrationData={props.integrationData}
            setIntegrationData={props.setIntegrationData}
          />
        )}
      </main>
    </div>
  );
};

export default ManagementHub;
