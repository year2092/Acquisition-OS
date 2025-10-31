import React, { useState, useEffect } from 'react';

const CHECKLIST_TEMPLATES = {
    'General Due Diligence': [
      { id: 'dd1', text: 'Review Seller Financial Statements (3 yrs)', completed: false },
      { id: 'dd2', text: 'Reconcile Tax Returns to Financials', completed: false },
      { id: 'dd3', text: 'Analyze Customer Concentration & Contracts', completed: false },
      { id: 'dd4', text: 'Review Org Chart & Key Employee Agreements', completed: false },
      { id: 'dd5', text: 'Legal Review: Corporate Docs, Liens, Litigation', completed: false },
      { id: 'dd6', text: 'Operational Review: Site Visit, Process Mapping', completed: false },
      { id: 'dd7', text: 'Insurance Policy Review', completed: false },
      { id: 'dd8', text: 'QofE Report Commissioned/Reviewed', completed: false },
    ],
    'Closing Process': [
      { id: 'cl1', text: 'Finalize Purchase Agreement (APA/SPA)', completed: false },
      { id: 'cl2', text: 'Secure Final Loan Approval & Commitment Letter', completed: false },
      { id: 'cl3', text: 'Obtain Necessary Consents & Third-Party Approvals', completed: false },
      { id: 'cl4', text: 'Finalize Working Capital True-Up Mechanism', completed: false },
      { id: 'cl5', text: 'Confirm Insurance Binders for Closing', completed: false },
      { id: 'cl6', text: 'Coordinate Funding with Lender/Escrow', completed: false },
      { id: 'cl7', text: 'Prepare & Review Closing Documents (Bill of Sale, Assignments, etc.)', completed: false },
      { id: 'cl8', text: 'Conduct Final Bring-Down Diligence Call', completed: false },
      { id: 'cl9', text: 'Execute Closing & Confirm Wire Transfers', completed: false },
    ],
    'First 90 Days Integration': [
      { id: 'int1', text: 'Day 1: Announce Acquisition to Team (with Seller)', completed: false },
      { id: 'int2', text: 'Week 1: Establish 13-Week Cash Flow Forecast', completed: false },
      { id: 'int3', text: 'Week 1: Verify Payroll, Benefits, Insurance Transfer', completed: false },
      { id: 'int4', text: 'Weeks 1-2: Hold 1:1 Meetings with Key Staff', completed: false },
      { id: 'int5', text: 'Weeks 1-4: Conduct Listening Tour (Customers, Suppliers, Team)', completed: false },
      { id: 'int6', text: 'Week 4: Identify & Implement One Quick Win (Process Fix)', completed: false },
      { id: 'int7', text: 'Weeks 5-8: Map Order-to-Cash; Standardize Pricing/Quoting', completed: false },
      { id: 'int8', text: 'Weeks 9-12: Communicate First Improvement/Promise to Market', completed: false },
    ],
};

type ChecklistItem = { id: string; text: string; completed: boolean };
type ChecklistName = keyof typeof CHECKLIST_TEMPLATES;
type AllChecklists = Record<ChecklistName, ChecklistItem[]>;

const CHECKLIST_STORAGE_KEY = 'mandaChecklistsState';

const MandaChecklist: React.FC = () => {
    const [allChecklists, setAllChecklists] = useState<AllChecklists>(() => {
        try {
            const savedState = localStorage.getItem(CHECKLIST_STORAGE_KEY);
            return savedState ? JSON.parse(savedState) : CHECKLIST_TEMPLATES;
        } catch (error) {
            console.error("Failed to load checklist state from local storage", error);
            return CHECKLIST_TEMPLATES;
        }
    });

    const [selectedChecklist, setSelectedChecklist] = useState<ChecklistName>('General Due Diligence');
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        try {
            localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(allChecklists));
        } catch (error) {
            console.error("Failed to save checklist state to local storage", error);
        }
    }, [allChecklists]);

    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedChecklist(e.target.value as ChecklistName);
    };

    const handleToggleItem = (id: string) => {
        setAllChecklists(prev => {
            const updatedItems = prev[selectedChecklist].map(item =>
                item.id === id ? { ...item, completed: !item.completed } : item
            );
            return {
                ...prev,
                [selectedChecklist]: updatedItems,
            };
        });
    };
    
    const handleResetProgress = () => {
        if (window.confirm('Are you sure you want to reset all checklist progress? This cannot be undone.')) {
            localStorage.removeItem(CHECKLIST_STORAGE_KEY);
            setAllChecklists(CHECKLIST_TEMPLATES);
            showToast('Checklist progress has been reset.');
        }
    };

    const currentChecklistItems = allChecklists[selectedChecklist];
    const completedCount = currentChecklistItems.filter(item => item.completed).length;
    const totalCount = currentChecklistItems.length;
    const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-3xl mx-auto border border-slate-200">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800">M&A Checklist</h2>
                    <p className="text-sm text-slate-500 mt-1">Progress is saved automatically.</p>
                </div>
                 <button 
                    onClick={handleResetProgress}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                    Reset All Progress
                </button>
            </div>
            
            <div className="mb-6">
                <label htmlFor="checklist-template" className="block text-sm font-medium text-slate-600 mb-2">Select Checklist Template</label>
                <select 
                    id="checklist-template" 
                    value={selectedChecklist} 
                    onChange={handleTemplateChange}
                    className="w-full px-4 py-3 text-base text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                    {Object.keys(CHECKLIST_TEMPLATES).map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>

            <div className="my-6">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-slate-500">Progress</span>
                    <span className="text-sm font-medium text-slate-600">{completedCount} / {totalCount} Completed</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div className="bg-amber-500 h-2.5 rounded-full transition-all duration-500" style={{width: `${progress}%`}}></div>
                </div>
            </div>

            <ul className="space-y-3">
                {currentChecklistItems.map(item => (
                    <li key={item.id} className={`p-4 rounded-lg transition-all ${item.completed ? 'bg-slate-100/50 opacity-60' : 'bg-slate-100'}`}>
                        <label className="flex items-center gap-4 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => handleToggleItem(item.id)}
                                className="h-5 w-5 rounded border-slate-300 bg-slate-100 text-amber-600 focus:ring-amber-500 flex-shrink-0"
                            />
                            <span className={`text-slate-800 ${item.completed ? 'line-through text-slate-500' : ''}`}>
                                {item.text}
                            </span>
                        </label>
                    </li>
                ))}
            </ul>
             {toastMessage && <div className="toast">{toastMessage}</div>}
        </div>
    );
};

export default MandaChecklist;