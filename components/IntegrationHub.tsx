import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Deal, Task } from '../App';

// --- Interfaces --- //
export interface MetricEntry {
  id: string;
  date: string;
  cashBalance: string;
  revenue: string;
  customMetric: string;
  employeeCount: string;
}

export interface CommunicationLog {
  dailyHuddleLastCompleted: string | null;
  weeklyAllHandsLastCompleted: string | null;
  fridayEmailLastCompleted: string | null;
}

export interface IntegrationData {
  metrics: MetricEntry[];
  customMetricName: string;
  communications: CommunicationLog;
}

interface IntegrationHubProps {
    deals: Deal[]; // Should be pre-filtered for "Closed" status
    tasks: Task[];
    onAddTask: (title: string, description: string, category: string, dealId?: string) => void;
    integrationData: Record<string, IntegrationData>;
    setIntegrationData: React.Dispatch<React.SetStateAction<Record<string, IntegrationData>>>;
}

// --- Constants & Helpers --- //
const defaultIntegrationData: IntegrationData = {
    metrics: [],
    customMetricName: 'Key Operational Metric',
    communications: {
        dailyHuddleLastCompleted: null,
        weeklyAllHandsLastCompleted: null,
        fridayEmailLastCompleted: null,
    }
};

const inputClasses = "w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2 px-3 text-sm transition focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/80";
const parseNum = (val: string) => parseFloat(String(val).replace(/,/g, '')) || 0;
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

const MILESTONES = {
    'Stabilize Cash': 'Integration-Cash',
    'Stabilize People': 'Integration-People',
    'Fix One Process': 'Integration-Process',
    'Make Market Promise': 'Integration-Market',
};

// --- Main Component --- //
const IntegrationHub: React.FC<IntegrationHubProps> = ({ deals, tasks, onAddTask, integrationData, setIntegrationData }) => {
    const [selectedDealId, setSelectedDealId] = useState<string | null>(deals[0]?.id || null);

    const currentData = useMemo(() => {
        if (!selectedDealId) return defaultIntegrationData;
        return integrationData[selectedDealId] || defaultIntegrationData;
    }, [selectedDealId, integrationData]);

    const updateCurrentData = (data: Partial<IntegrationData>) => {
        if (!selectedDealId) return;
        const updatedData = { ...currentData, ...data };
        setIntegrationData(prev => ({ ...prev, [selectedDealId]: updatedData }));
    };

    const handleSelectDeal = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedDealId(e.target.value);
    };

    const tasksForSelectedDeal = useMemo(() => {
        return tasks.filter(t => t.dealId === selectedDealId);
    }, [tasks, selectedDealId]);
    
    // --- Metric Dashboard Logic ---
    const handleAddMetricEntry = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newEntry: MetricEntry = {
            id: crypto.randomUUID(),
            date: formData.get('date') as string,
            cashBalance: formData.get('cashBalance') as string,
            revenue: formData.get('revenue') as string,
            customMetric: formData.get('customMetric') as string,
            employeeCount: formData.get('employeeCount') as string,
        };
        updateCurrentData({ metrics: [...currentData.metrics, newEntry].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) });
        (e.target as HTMLFormElement).reset();
    };
    
    const chartData = useMemo(() => 
        currentData.metrics.map(m => ({
            date: m.date,
            'Cash Balance': parseNum(m.cashBalance),
            'Revenue': parseNum(m.revenue),
            [currentData.customMetricName]: parseNum(m.customMetric),
            'Employees': parseNum(m.employeeCount),
        })), [currentData.metrics, currentData.customMetricName]);

    // --- Communication Log Logic ---
    const handleCommunicationCheck = (comm: keyof CommunicationLog) => {
        const today = new Date().toISOString().split('T')[0];
        const newComms = { ...currentData.communications, [comm]: today };
        updateCurrentData({ communications: newComms });
    };

    if (deals.length === 0) {
        return (
            <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-7xl mx-auto border border-slate-200 text-center">
                <h2 className="text-2xl font-semibold text-slate-800">Post-Acquisition Integration Hub</h2>
                <p className="text-slate-500 mt-4">This hub becomes active once you have a deal marked as "Closed" in your Deal Pipeline.</p>
                <p className="text-slate-400 mt-2">Close a deal to begin your 90-day integration plan.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-7xl mx-auto border border-slate-200 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-800">Post-Acquisition Integration Hub</h2>
                    <p className="text-slate-500 mt-1">Your command center for the first 90 days (Chapter 7).</p>
                </div>
                <div className="flex-shrink-0">
                    <label htmlFor="deal-select" className="block text-sm font-medium text-slate-600 mb-1">Select Closed Deal</label>
                    <select id="deal-select" value={selectedDealId || ''} onChange={handleSelectDeal} className={inputClasses}>
                        {deals.map(deal => <option key={deal.id} value={deal.id}>{deal.companyName}</option>)}
                    </select>
                </div>
            </div>

            {/* 90-Day Plan Tracker */}
            <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">90-Day Plan Tracker</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(MILESTONES).map(([milestone, category]) => (
                        <div key={milestone} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <h4 className="font-semibold text-amber-600 mb-3 text-center">{milestone}</h4>
                            <div className="space-y-2 min-h-[100px]">
                                {tasksForSelectedDeal.filter(t => t.category === category).map(task => (
                                    <div key={task.id} className={`p-2 rounded text-sm ${task.status === 'Done' ? 'bg-green-100 text-green-700 line-through' : 'bg-white text-slate-700'}`}>
                                        {task.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Key Metric Dashboard */}
                <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-800 mb-3">Key Metric Dashboard</h3>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <form onSubmit={handleAddMetricEntry} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end mb-4">
                            <label className="text-xs text-slate-500">Date <input type="date" name="date" required className={`${inputClasses} mt-1`} /></label>
                            <label className="text-xs text-slate-500">Cash Balance <input type="text" name="cashBalance" className={`${inputClasses} mt-1`} /></label>
                            <label className="text-xs text-slate-500">Revenue <input type="text" name="revenue" className={`${inputClasses} mt-1`} /></label>
                            <label className="text-xs text-slate-500">{currentData.customMetricName} <input type="text" name="customMetric" className={`${inputClasses} mt-1`} /></label>
                            <label className="text-xs text-slate-500">Employees <input type="text" name="employeeCount" className={`${inputClasses} mt-1`} /></label>
                            <button type="submit" className="px-4 py-2 text-sm font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600">Log Data</button>
                        </form>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US',{month:'short', day:'numeric'})} />
                                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} />
                                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} formatter={(value: any, name: any) => [name === 'Employees' ? value : formatCurrency(value), name]} />
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                                <Line yAxisId="left" type="monotone" dataKey="Cash Balance" stroke="#10b981" />
                                <Line yAxisId="left" type="monotone" dataKey="Revenue" stroke="#3b82f6" />
                                <Line yAxisId="right" type="monotone" dataKey="Employees" stroke="#a855f7" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Communication & Quick Wins */}
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-3">Communication Cadence</h3>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" onChange={() => handleCommunicationCheck('dailyHuddleLastCompleted')} className="h-4 w-4 rounded bg-slate-200 text-amber-600 focus:ring-amber-500" /> Daily Huddle <span className="ml-auto text-xs text-slate-400">{currentData.communications.dailyHuddleLastCompleted}</span></label>
                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" onChange={() => handleCommunicationCheck('weeklyAllHandsLastCompleted')} className="h-4 w-4 rounded bg-slate-200 text-amber-600 focus:ring-amber-500" /> Weekly All-Hands <span className="ml-auto text-xs text-slate-400">{currentData.communications.weeklyAllHandsLastCompleted}</span></label>
                            <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" onChange={() => handleCommunicationCheck('fridayEmailLastCompleted')} className="h-4 w-4 rounded bg-slate-200 text-amber-600 focus:ring-amber-500" /> Friday Email <span className="ml-auto text-xs text-slate-400">{currentData.communications.fridayEmailLastCompleted}</span></label>
                        </div>
                    </div>
                     <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-3">"Quick Wins" Tracker</h3>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                             {tasksForSelectedDeal.filter(t => t.category === 'Integration-Quick Win').map(task => (
                                <div key={task.id} className={`p-2 rounded text-sm ${task.status === 'Done' ? 'bg-green-100 text-green-700 line-through' : 'bg-white border border-slate-200 text-slate-700'}`}>
                                    {task.title}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntegrationHub;