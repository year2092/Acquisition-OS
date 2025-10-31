
import React, { useState, useMemo, useEffect } from 'react';
import { Task } from '../src/App';

interface DealRoomTasksProps {
    tasks: Task[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

// --- Constants ---
const STATUS_OPTIONS: string[] = ["To Do", "In Progress", "Under Review", "Blocked", "Waiting on Seller", "Needs Discussion", "Done"];
const TASK_CATEGORIES: string[] = [
    "Sourcing", 
    "Diligence-Financial", 
    "Diligence-Legal", 
    "Financing", 
    "Closing", 
    "Integration-General",
    "Integration-Cash",
    "Integration-People",
    "Integration-Process",
    "Integration-Market",
    "Integration-Quick Win",
    "General"
];
const ASSIGNEE_ROLES = ["Buyer", "Legal", "CPA", "Lender", "Seller", "Other"];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];


const DealRoomTasks: React.FC<DealRoomTasksProps> = ({ tasks, setTasks }) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>(TASK_CATEGORIES[TASK_CATEGORIES.length - 1]);
  const [newDueDate, setNewDueDate] = useState<string>('');

  // --- UI State ---
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // --- Filters ---
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('All');
  const [dueDateFilter, setDueDateFilter] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>("All");

  // --- Modal State ---
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // --- Task Handlers ---
  const handleAddTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newTaskTitle.trim(),
      priority: 'Medium',
      status: STATUS_OPTIONS[0],
      dueDate: newDueDate || null,
      assignee: ASSIGNEE_ROLES[0],
      category: newCategory,
      description: '',
      attachments: [],
    };

    setTasks(prevTasks => [newTask, ...prevTasks]);
    setNewTaskTitle('');
    setNewCategory(TASK_CATEGORIES[TASK_CATEGORIES.length - 1]);
    setNewDueDate('');
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks(prevTasks => prevTasks.map(task => (task.id === updatedTask.id ? updatedTask : task)));
  };

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        if (editingTask && editingTask.id === taskId) {
            setIsModalOpen(false);
            setEditingTask(null);
        }
    }
  };

  const handleAttachFile = () => {
    if (!fileToUpload || !editingTask) return;
    const newAttachmentName = fileToUpload.name;
    if (editingTask.attachments.includes(newAttachmentName)) {
      alert(`File "${newAttachmentName}" is already attached.`);
      return;
    }
    const newAttachments = [...editingTask.attachments, newAttachmentName];
    const updatedTask = { ...editingTask, attachments: newAttachments };
    handleUpdateTask(updatedTask);
    setEditingTask(updatedTask);
    setFileToUpload(null);
    const fileInput = document.getElementById('taskAttachmentInput') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // --- Modal Handlers ---
  const openEditModal = (task: Task) => {
    setEditingTask({ ...task });
    setIsModalOpen(true);
  };
  
  const handleSaveChanges = () => {
    if (editingTask) handleUpdateTask(editingTask);
    setIsModalOpen(false);
    setEditingTask(null);
  };
  
  const handleModalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      if(editingTask) setEditingTask({...editingTask, [e.target.name]: e.target.value});
  }

  // --- Filtering ---
  const filteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter(task => {
      const statusMatch = statusFilter === 'All' || task.status === statusFilter;
      const priorityMatch = priorityFilter === 'All' || task.priority === priorityFilter;
      const assigneeMatch = assigneeFilter === 'All' || task.assignee === assigneeFilter;
      const categoryMatch = filterCategory === 'All' || task.category === filterCategory;
      let dueDateMatch = true;
      if (dueDateFilter !== 'All' && task.dueDate) {
        const taskDueDate = new Date(task.dueDate);
        taskDueDate.setMinutes(taskDueDate.getMinutes() + taskDueDate.getTimezoneOffset());
        if (dueDateFilter === 'Overdue') dueDateMatch = taskDueDate < today && task.status !== 'Done';
        else if (dueDateFilter === 'Today') dueDateMatch = taskDueDate.getTime() === today.getTime();
        else if (dueDateFilter === 'This Week') {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          dueDateMatch = taskDueDate >= startOfWeek && taskDueDate <= endOfWeek;
        }
      } else if (dueDateFilter !== 'All' && !task.dueDate) {
        dueDateMatch = false;
      }
      return statusMatch && priorityMatch && assigneeMatch && categoryMatch && dueDateMatch;
    });
  }, [tasks, statusFilter, priorityFilter, assigneeFilter, dueDateFilter, filterCategory]);
  
  // --- UI Helpers ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done': return 'border-green-500 bg-green-100 text-green-700';
      case 'In Progress':
      case 'Under Review': return 'border-blue-500 bg-blue-100 text-blue-700';
      case 'Blocked': return 'border-red-500 bg-red-100 text-red-700';
      case 'Waiting on Seller': return 'border-yellow-500 bg-yellow-100 text-yellow-700';
      default: return 'border-slate-300 bg-slate-100 text-slate-700';
    }
  };

  const getPriorityClasses = (priority: string) => {
    switch (priority) {
      case 'High': return { dot: 'bg-red-500', text: 'text-red-600' };
      case 'Medium': return { dot: 'bg-yellow-500', text: 'text-yellow-600' };
      case 'Low': return { dot: 'bg-green-500', text: 'text-green-600' };
      default: return { dot: 'bg-slate-500', text: 'text-slate-600' };
    }
  };
  
  const isTaskOverdue = (task: Task): boolean => {
      if (!task.dueDate || task.status === 'Done') return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.dueDate);
      dueDate.setMinutes(dueDate.getMinutes() + dueDate.getTimezoneOffset());
      return dueDate < today;
  };

  // --- Bulk Action Handlers ---
  const handleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedTaskIds(filteredTasks.map(t => t.id));
    else setSelectedTaskIds([]);
  };
  const handleBulkUpdate = (field: keyof Task, value: any) => {
    if (!value) return;
    setTasks(prevTasks => prevTasks.map(task => selectedTaskIds.includes(task.id) ? { ...task, [field]: value } : task));
    setSelectedTaskIds([]);
  };
  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedTaskIds.length} selected tasks?`)) {
        setTasks(prevTasks => prevTasks.filter(task => !selectedTaskIds.includes(task.id)));
        setSelectedTaskIds([]);
    }
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
      e.dataTransfer.effectAllowed = 'move';
      setDraggedTaskId(taskId);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: string) => {
      e.preventDefault();
      if (draggedTaskId) {
          const taskToUpdate = tasks.find(t => t.id === draggedTaskId);
          if (taskToUpdate && taskToUpdate.status !== newStatus) {
              handleUpdateTask({ ...taskToUpdate, status: newStatus });
          }
          setDraggedTaskId(null);
      }
  };

  const commonSelectClasses = "w-full px-4 py-2 text-base text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500";
  const isAllSelected = selectedTaskIds.length > 0 && selectedTaskIds.length === filteredTasks.length;

  return (
    <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-7xl mx-auto border border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <h2 className="text-2xl font-semibold text-slate-800">Deal Room Tasks</h2>
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">View:</span>
            <div className="flex items-center bg-slate-100 rounded-md p-1">
                <button onClick={() => setViewMode('list')} className={`px-3 py-1 text-sm rounded ${viewMode === 'list' ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm' : 'text-slate-600'}`}>List</button>
                <button onClick={() => setViewMode('board')} className={`px-3 py-1 text-sm rounded ${viewMode === 'board' ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm' : 'text-slate-600'}`}>Board</button>
            </div>
        </div>
      </div>

      <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end mb-6">
        <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Enter new task title..." className="md:col-span-3 w-full px-4 py-3 text-base text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={commonSelectClasses}>{TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className={`${commonSelectClasses}`} />
        <button type="submit" className="px-8 py-3 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 disabled:bg-slate-300 transition" disabled={!newTaskTitle.trim()}>Add Task</button>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <select onChange={(e) => setStatusFilter(e.target.value)} className={commonSelectClasses}><option value="All">All Statuses</option>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select onChange={(e) => setFilterCategory(e.target.value)} className={commonSelectClasses}><option value="All">All Categories</option>{TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select onChange={(e) => setPriorityFilter(e.target.value)} className={commonSelectClasses}><option value="All">All Priorities</option>{PRIORITY_OPTIONS.map(p=><option key={p}>{p}</option>)}</select>
        <select onChange={(e) => setAssigneeFilter(e.target.value)} className={commonSelectClasses}><option value="All">All Assignees</option>{ASSIGNEE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
        <select onChange={(e) => setDueDateFilter(e.target.value)} className={commonSelectClasses}><option value="All">All Due Dates</option><option value="Overdue">Overdue</option><option value="Today">Today</option><option value="This Week">This Week</option></select>
      </div>

      {selectedTaskIds.length > 0 && viewMode === 'list' && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 my-4 flex flex-col sm:flex-row items-center gap-4">
            <span className="font-medium text-slate-700 text-sm flex-shrink-0">{selectedTaskIds.length} tasks selected</span>
            <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
                <select onChange={(e) => handleBulkUpdate('status', e.target.value)} className={commonSelectClasses}><option value="">Change Status...</option>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select>
                <select onChange={(e) => handleBulkUpdate('priority', e.target.value)} className={commonSelectClasses}><option value="">Change Priority...</option>{PRIORITY_OPTIONS.map(p=><option key={p}>{p}</option>)}</select>
                <select onChange={(e) => handleBulkUpdate('assignee', e.target.value)} className={commonSelectClasses}><option value="">Change Assignee...</option>{ASSIGNEE_ROLES.map(r=><option key={r}>{r}</option>)}</select>
                <button onClick={handleBulkDelete} className="px-4 py-2 text-sm font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Delete Selected</button>
            </div>
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                    <tr>
                        <th scope="col" className="p-4"><input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} className="w-4 h-4 text-amber-600 bg-slate-100 border-slate-300 rounded focus:ring-amber-500" /></th>
                        <th scope="col" className="px-6 py-3">Task</th>
                        <th scope="col" className="px-6 py-3">Assignee</th>
                        <th scope="col" className="px-6 py-3">Due Date</th>
                        <th scope="col" className="px-6 py-3">Status</th>
                        <th scope="col" className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTasks.map(task => (
                        <tr key={task.id} className={`border-b border-slate-200 hover:bg-slate-50 ${task.status === 'Done' ? 'opacity-60' : ''}`}>
                            <td className="w-4 p-4"><input type="checkbox" checked={selectedTaskIds.includes(task.id)} onChange={() => handleSelectTask(task.id)} className="w-4 h-4 text-amber-600 bg-slate-100 border-slate-300 rounded focus:ring-amber-500" /></td>
                            <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                    <span className={`h-2.5 w-2.5 rounded-full ${getPriorityClasses(task.priority).dot}`}></span>
                                    {task.title}
                                </div>
                            </td>
                            <td className="px-6 py-4"><span className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full">{task.assignee}</span></td>
                            <td className={`px-6 py-4 ${isTaskOverdue(task) ? 'text-red-500 font-semibold' : ''}`}>{task.dueDate || 'N/A'}</td>
                            <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>{task.status}</span></td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {isTaskOverdue(task) && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>}
                                  {task.attachments.length > 0 && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a3 3 0 106 0V7a1 1 0 112 0v4a5 5 0 11-10 0V7a3 3 0 013-3z" clipRule="evenodd" /></svg>}
                                  <button onClick={() => openEditModal(task)} className="p-2 text-slate-500 hover:text-amber-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" /></svg></button>
                                  <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-slate-500 hover:text-red-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
            {STATUS_OPTIONS.map(status => (
                <div key={status} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)} className={`p-3 bg-slate-100 rounded-lg border-t-4 ${getStatusColor(status).replace('bg-','border-')} min-w-[280px]`}>
                    <h3 className="font-semibold text-slate-700 mb-3">{status}</h3>
                    <div className="space-y-3 min-h-[100px]">
                        {filteredTasks.filter(t => t.status === status).map(task => (
                            <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task.id)} onClick={() => openEditModal(task)} className={`p-3 rounded-lg shadow-sm cursor-grab ${getStatusColor(status)}`}>
                                <p className="font-medium text-slate-800 text-sm mb-2">{task.title}</p>
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getPriorityClasses(task.priority).text} ${getPriorityClasses(task.priority).dot.replace('bg-', 'bg-opacity-20 ')}`}>{task.priority}</span>
                                    <span className="text-xs text-slate-500">{task.assignee}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      )}
      
      {filteredTasks.length === 0 && (
         <div className="text-center py-10 text-slate-500 border-2 border-dashed border-slate-300 rounded-lg mt-4">
            <p>{tasks.length > 0 ? "No tasks match the current filters." : "No tasks yet. Add one to get started!"}</p>
          </div>
      )}

      {isModalOpen && editingTask && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-8 w-full max-w-3xl shadow-lg" onClick={(e) => e.stopPropagation()}>
            <input name="title" value={editingTask.title} onChange={handleModalChange} className="text-xl font-bold text-slate-800 mb-4 bg-transparent border-none p-0 focus:outline-none w-full" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <select name="status" value={editingTask.status} onChange={handleModalChange} className={commonSelectClasses}>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}</select>
              <select name="priority" value={editingTask.priority} onChange={handleModalChange} className={commonSelectClasses}>{PRIORITY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}</select>
              <select name="assignee" value={editingTask.assignee} onChange={handleModalChange} className={commonSelectClasses}>{ASSIGNEE_ROLES.map(r=><option key={r} value={r}>{r}</option>)}</select>
              <input name="dueDate" type="date" value={editingTask.dueDate || ''} onChange={handleModalChange} className={`${commonSelectClasses}`} />
            </div>
            <textarea name="description" value={editingTask.description} onChange={handleModalChange} rows={4} className={commonSelectClasses} placeholder="Add a description or notes..."></textarea>
            
            <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Attachments</h4>
              <ul className="mb-3 space-y-1">{editingTask.attachments.length === 0 ? <li className="text-xs text-slate-500">No files attached.</li> : editingTask.attachments.map((file, i) => <li key={i} className="text-sm text-slate-700 bg-slate-200 px-2 py-1 rounded-md">{file}</li>)}</ul>
              <div className="flex gap-3">
                  <input id="taskAttachmentInput" type="file" onChange={(e) => setFileToUpload(e.target.files ? e.target.files[0] : null)} className="flex-grow w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300" />
                  <button type="button" onClick={handleAttachFile} disabled={!fileToUpload} className="px-4 py-2 text-sm font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition">Attach</button>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
                <button type="button" onClick={() => handleDeleteTask(editingTask.id)} className="px-5 py-2.5 font-medium text-red-600 rounded-lg hover:bg-red-50 transition">Delete Task</button>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Cancel</button>
                    <button onClick={handleSaveChanges} className="px-5 py-2.5 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 transition">Save Changes</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealRoomTasks;
