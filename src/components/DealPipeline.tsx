
import React, { useState, useMemo } from 'react';
import { Deal, DealStatus, Task, DealContact, KeyTerms, ChecklistItem } from '../App';
import { renderMarkdown } from '../utils/markdownRenderer';

interface DealPipelineProps {
    deals: Deal[];
    setDeals: React.Dispatch<React.SetStateAction<Deal[]>>;
    tasks: Task[];
    onAddTask: (title: string, description: string, category: string, dealId?: string) => void;
}

const DEAL_STAGES: DealStatus[] = ["Identified", "Contacted", "Evaluating", "LOI Sent", "Diligence", "Closing", "Closed", "Lost"];

// --- Deal Card Component ---
const DealCard: React.FC<{ deal: Deal, nextTask?: Task, onSelect: () => void, onDragStart: (e: React.DragEvent<HTMLDivElement>) => void }> = 
({ deal, nextTask, onSelect, onDragStart }) => {
    const sde = deal.sourcingResult.sde ? `$${deal.sourcingResult.sde.toLocaleString()}` : 'N/A';
    const fitScore = deal.sourcingResult.overallFitScore;

    return (
        <div 
            onClick={onSelect}
            draggable
            onDragStart={onDragStart}
            className="bg-white p-4 rounded-lg border border-slate-200 hover:border-amber-500 hover:shadow-md cursor-pointer transition-all mb-3"
        >
            <h4 className="font-bold text-slate-800">{deal.companyName}</h4>
            <div className="flex justify-between items-baseline text-sm mt-2">
                <span className="text-slate-500">Fit Score:</span>
                <span className={`font-semibold ${fitScore && fitScore >= 75 ? 'text-green-600' : fitScore && fitScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {fitScore !== null ? `${fitScore}%` : 'N/A'}
                </span>
            </div>
            <div className="flex justify-between items-baseline text-sm">
                <span className="text-slate-500">SDE:</span>
                <span className="font-semibold text-slate-700">{sde}</span>
            </div>
            {nextTask && (
                 <div className="mt-3 pt-2 border-t border-slate-200 text-xs">
                    <p className="text-slate-500">Next Task:</p>
                    <p className="text-slate-700 truncate">{nextTask.title}</p>
                 </div>
            )}
        </div>
    );
};


// --- Deal Detail Modal ---
const DealDetailView: React.FC<{ deal: Deal, tasks: Task[], onClose: () => void, onUpdate: (updatedDeal: Deal) => void, onAddTask: (title: string, description: string, category: string, dealId?: string) => void }> = 
({ deal, tasks, onClose, onUpdate, onAddTask }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'terms' | 'checklist' | 'tasks'>('summary');
    const [currentDeal, setCurrentDeal] = useState<Deal>(deal);

    const handleUpdate = (updatedDeal: Deal) => {
        setCurrentDeal(updatedDeal);
        onUpdate(updatedDeal);
    };

    const handleTermsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        handleUpdate({ ...currentDeal, keyTerms: { ...currentDeal.keyTerms, [name]: value } });
    };

    const handleContactChange = (index: number, field: keyof DealContact, value: string) => {
        const updatedContacts = [...currentDeal.contacts];
        updatedContacts[index] = { ...updatedContacts[index], [field]: value };
        handleUpdate({ ...currentDeal, contacts: updatedContacts });
    };

    const handleAddContact = () => handleUpdate({ ...currentDeal, contacts: [...currentDeal.contacts, { id: crypto.randomUUID(), name: '', role: '', email: '', phone: '' }] });
    const handleRemoveContact = (index: number) => handleUpdate({ ...currentDeal, contacts: currentDeal.contacts.filter((_, i) => i !== index) });

    const handleChecklistItemToggle = (itemId: string) => {
        const updatedList = currentDeal.closingChecklist.map(item => item.id === itemId ? { ...item, completed: !item.completed } : item);
        handleUpdate({ ...currentDeal, closingChecklist: updatedList });
    };

    const [newTaskTitle, setNewTaskTitle] = useState('');
    const handleAddNewTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTaskTitle.trim()) {
            onAddTask(newTaskTitle, '', 'Diligence-General', currentDeal.id);
            setNewTaskTitle('');
        }
    };
    
    const tabClasses = (tabName: 'summary' | 'terms' | 'checklist' | 'tasks') => 
        `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tabName ? 'bg-slate-100 text-amber-600 border-b-2 border-amber-500' : 'text-slate-500 hover:bg-slate-100/50'}`;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-5xl h-[90vh] shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex-shrink-0 mb-4">
            <h3 className="text-xl font-bold text-slate-800">{deal.companyName}</h3>
            <a href={deal.sourcingResult.url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-600 hover:underline">{deal.sourcingResult.url}</a>
          </div>

          <div className="flex-shrink-0 border-b border-slate-200">
             <button onClick={() => setActiveTab('summary')} className={tabClasses('summary')}>Summary</button>
             <button onClick={() => setActiveTab('terms')} className={tabClasses('terms')}>Terms & Contacts</button>
             <button onClick={() => setActiveTab('checklist')} className={tabClasses('checklist')}>Closing Checklist</button>
             <button onClick={() => setActiveTab('tasks')} className={tabClasses('tasks')}>Tasks ({tasks.length})</button>
          </div>

          <div className="flex-grow overflow-y-auto pr-4 py-4 space-y-6 bg-slate-50 -mx-6 px-6">
            {activeTab === 'summary' && (
              <div>
                <h4 className="font-semibold text-amber-600 mb-2 border-b border-slate-200 pb-1">Buy Box Fit Scorecard ({deal.sourcingResult.overallFitScore}%)</h4>
                <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(deal.sourcingResult.scorecard)} />
                <h4 className="font-semibold text-amber-600 mt-6 mb-2 border-b border-slate-200 pb-1">Key Insights & Red Flags</h4>
                <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(deal.sourcingResult.keyInsights)} />
                <h4 className="font-semibold text-amber-600 mt-6 mb-2 border-b border-slate-200 pb-1">Detailed Company Profile</h4>
                <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(deal.sourcingResult.fullProfile)} />
              </div>
            )}
            {activeTab === 'terms' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div>
                    <h4 className="font-semibold text-slate-800 mb-3">Key Terms</h4>
                    <div className="space-y-4">
                        <label className="block text-sm text-slate-500">Purchase Price <input name="purchasePrice" value={currentDeal.keyTerms.purchasePrice} onChange={handleTermsChange} className="w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2 px-3 text-sm mt-1" /></label>
                        <label className="block text-sm text-slate-500">Deal Structure <input name="structure" value={currentDeal.keyTerms.structure} onChange={handleTermsChange} className="w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2 px-3 text-sm mt-1" /></label>
                        <label className="block text-sm text-slate-500">Seller Note Details <input name="sellerNote" value={currentDeal.keyTerms.sellerNote} onChange={handleTermsChange} className="w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2 px-3 text-sm mt-1" /></label>
                        <label className="block text-sm text-slate-500">NWC Peg <input name="nwcPeg" value={currentDeal.keyTerms.nwcPeg} onChange={handleTermsChange} className="w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2 px-3 text-sm mt-1" /></label>
                    </div>
                 </div>
                 <div>
                    <h4 className="font-semibold text-slate-800 mb-3">Contacts</h4>
                    <div className="space-y-3">
                        {currentDeal.contacts.map((contact, index) => (
                           <div key={contact.id} className="p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-2 gap-2 relative">
                               <input value={contact.name} onChange={(e) => handleContactChange(index, 'name', e.target.value)} placeholder="Name" className="col-span-1 bg-slate-100 text-slate-700 border-slate-200 rounded p-1 text-xs" />
                               <input value={contact.role} onChange={(e) => handleContactChange(index, 'role', e.target.value)} placeholder="Role" className="col-span-1 bg-slate-100 text-slate-700 border-slate-200 rounded p-1 text-xs" />
                               <input value={contact.email} onChange={(e) => handleContactChange(index, 'email', e.target.value)} placeholder="Email" className="col-span-2 bg-slate-100 text-slate-700 border-slate-200 rounded p-1 text-xs" />
                               <input value={contact.phone} onChange={(e) => handleContactChange(index, 'phone', e.target.value)} placeholder="Phone" className="col-span-2 bg-slate-100 text-slate-700 border-slate-200 rounded p-1 text-xs" />
                               <button onClick={() => handleRemoveContact(index)} className="absolute top-1 right-1 p-1 text-slate-400 hover:text-red-500">&times;</button>
                           </div>
                        ))}
                    </div>
                    <button onClick={handleAddContact} className="mt-3 text-sm text-amber-600 hover:text-amber-700">+ Add Contact</button>
                 </div>
              </div>
            )}
            {activeTab === 'checklist' && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Closing Checklist</h4>
                <ul className="space-y-2">
                    {currentDeal.closingChecklist.map(item => (
                       <li key={item.id} className={`p-3 rounded-lg transition-all ${item.completed ? 'bg-slate-100 opacity-70' : 'bg-white'}`}>
                           <label className="flex items-center gap-3 cursor-pointer">
                               <input type="checkbox" checked={item.completed} onChange={() => handleChecklistItemToggle(item.id)} className="h-5 w-5 rounded border-slate-300 bg-slate-100 text-amber-600 focus:ring-amber-500" />
                               <span className={`text-slate-800 ${item.completed ? 'line-through text-slate-500' : ''}`}>{item.text}</span>
                           </label>
                       </li>
                    ))}
                </ul>
              </div>
            )}
            {activeTab === 'tasks' && (
              <div>
                <h4 className="font-semibold text-slate-800 mb-3">Linked Tasks</h4>
                <ul className="space-y-2 mb-4">
                    {tasks.map(task => (
                       <li key={task.id} className="p-2 bg-white rounded flex justify-between items-center border border-slate-200">
                           <span className="text-slate-800">{task.title}</span>
                           <span className="text-xs text-slate-500">{task.status}</span>
                       </li>
                    ))}
                    {tasks.length === 0 && <p className="text-slate-500 text-sm">No tasks linked to this deal.</p>}
                </ul>
                <form onSubmit={handleAddNewTask} className="flex gap-2">
                    <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Add new task for this deal..." className="flex-grow w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2 px-3 text-sm" />
                    <button type="submit" className="px-4 py-2 text-sm font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600">Add</button>
                </form>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 pt-4 border-t border-slate-200 text-right">
            <button onClick={onClose} className="px-6 py-2.5 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 transition">Close</button>
          </div>
        </div>
      </div>
    );
};

// --- How It Works Modal ---
const InfoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-bold text-amber-600">How the Deal Pipeline Works</h3>
                    <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto text-slate-700 space-y-4 pr-2">
                    <div>
                        <h4 className="font-semibold text-slate-800">Kanban Board</h4>
                        <p className="text-sm mt-1">The pipeline is a Kanban-style board, giving you a visual overview of every deal. Each column represents a key stage in the M&A lifecycle.</p>
                        <ul className="list-disc list-inside text-sm space-y-1 mt-2 pl-2">
                            <li><strong>Visual Stages:</strong> Track deals from "Identified" all the way to "Closed" or "Lost".</li>
                            <li><strong>Drag & Drop:</strong> Simply drag a deal's card from one column to the next to update its status.</li>
                            <li><strong>Deal Details:</strong> Click on any deal card to open a comprehensive view with its full analysis, key terms, a closing checklist, and linked tasks.</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-800">Getting Deals Into the Pipeline</h4>
                        <p className="text-sm mt-1">Deals can be added automatically from other parts of the application, ensuring a seamless workflow.</p>
                        
                        <div className="mt-3 bg-slate-100 p-3 rounded-lg">
                            <strong className="text-slate-700">1. From the Sourcing Engine</strong>
                            <p className="text-xs text-slate-500 mt-1">For deals found on public listing sites.</p>
                            <ol className="list-decimal list-inside text-sm space-y-1 mt-2 pl-2">
                                <li>Find and analyze a business listing using the Sourcing Engine.</li>
                                <li>On the result card, click the "Add to Pipeline" button.</li>
                                <li>The deal and its analysis are instantly added to the "Identified" stage.</li>
                            </ol>
                        </div>

                        <div className="mt-3 bg-slate-100 p-3 rounded-lg">
                            <strong className="text-slate-700">2. From the Company Profiler</strong>
                            <p className="text-xs text-slate-500 mt-1">For off-market deals where you have a document like a CIM.</p>
                            <ol className="list-decimal list-inside text-sm space-y-1 mt-2 pl-2">
                                <li>Navigate to the Company Profiler and select "Analyze Document" mode.</li>
                                <li>Enter the company's name, upload your CIM, and run the analysis.</li>
                                <li>After analysis, an "Add to Pipeline" button will appear in the results area.</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const DealPipeline: React.FC<DealPipelineProps> = ({ deals, setDeals, tasks, onAddTask }) => {
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    const findNextTask = (dealId: string) => {
        return tasks.find(t => t.dealId === dealId && t.status !== 'Done');
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, dealId: string) => {
        setDraggedDealId(dealId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: DealStatus) => {
        e.preventDefault();
        if (draggedDealId) {
            setDeals(prevDeals => prevDeals.map(d => d.id === draggedDealId ? { ...d, status: newStatus } : d));
            setDraggedDealId(null);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleUpdateDeal = (updatedDeal: Deal) => {
        setDeals(prev => prev.map(d => d.id === updatedDeal.id ? updatedDeal : d));
    };

    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm w-full mx-auto border border-slate-200">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <div className="flex items-center">
                    <h2 className="text-2xl font-semibold text-slate-800">Deal Pipeline</h2>
                    <button 
                        onClick={() => setIsInfoModalOpen(true)}
                        className="ml-3 p-2 text-slate-500 hover:text-amber-600 rounded-full hover:bg-slate-100 transition"
                        title="How It Works"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                </div>
                <p className="text-base text-slate-500 mt-1">Track your acquisition opportunities from identification to close.</p>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
                {DEAL_STAGES.map(stage => (
                    <div 
                        key={stage}
                        onDrop={(e) => handleDrop(e, stage)}
                        onDragOver={handleDragOver}
                        className="bg-slate-100 rounded-lg p-3 w-72 flex-shrink-0 border-t-4 border-slate-300"
                    >
                        <h3 className="font-semibold text-slate-700 mb-3 text-center">{stage} ({deals.filter(d => d.status === stage).length})</h3>
                        <div className="space-y-3 min-h-[200px]">
                           {deals.filter(d => d.status === stage).map(deal => (
                               <DealCard 
                                   key={deal.id} 
                                   deal={deal} 
                                   nextTask={findNextTask(deal.id)}
                                   onSelect={() => setSelectedDeal(deal)}
                                   onDragStart={(e) => handleDragStart(e, deal.id)}
                                />
                           ))}
                        </div>
                    </div>
                ))}
            </div>

            {selectedDeal && (
                <DealDetailView
                    deal={selectedDeal}
                    tasks={tasks.filter(t => t.dealId === selectedDeal.id)}
                    onClose={() => setSelectedDeal(null)}
                    onUpdate={handleUpdateDeal}
                    onAddTask={onAddTask}
                />
            )}

            {isInfoModalOpen && <InfoModal onClose={() => setIsInfoModalOpen(false)} />}
        </div>
    );
};

export default DealPipeline;
