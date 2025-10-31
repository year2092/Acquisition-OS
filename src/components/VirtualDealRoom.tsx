
import React, { useState, useEffect, useRef } from 'react';

// --- Interfaces ---
interface FileRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: 'Requested' | 'Received' | 'In Review' | 'Approved';
}

interface Folder {
  id: string;
  name: string;
  files: FileRecord[];
}

interface VirtualDealRoomProps {
    // Fix: Updated onAddTask to allow for an optional dealId, matching the type in ManagementHub.
    onAddTask: (taskTitle: string, taskDescription: string, category: string, dealId?: string) => void;
}

// --- Constants ---
const VDR_STORAGE_KEY = 'virtualDealRoomState';
const DILIGENCE_CATEGORIES = [
    'Financial Diligence',
    'Legal & Corporate',
    'Customers & Sales',
    'Operations & Technology',
    'Team & HR',
    'Insurance & Risk'
];
const FILE_STATUSES: FileRecord['status'][] = ['Requested', 'Received', 'In Review', 'Approved'];

// --- Helper Functions ---
const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getStatusColor = (status: FileRecord['status']) => {
    switch (status) {
        case 'Approved': return 'bg-green-100 text-green-700';
        case 'In Review': return 'bg-blue-100 text-blue-700';
        case 'Received': return 'bg-sky-100 text-sky-700';
        case 'Requested': return 'bg-yellow-100 text-yellow-700';
        default: return 'bg-slate-200 text-slate-700';
    }
};

const getInitialState = (): Folder[] => {
    try {
        const savedState = localStorage.getItem(VDR_STORAGE_KEY);
        if (savedState) return JSON.parse(savedState);
    } catch (e) {
        console.error("Failed to load VDR state from local storage:", e);
    }
    // Default state if nothing is saved or loading fails
    return DILIGENCE_CATEGORIES.map(name => ({
        id: crypto.randomUUID(),
        name,
        files: []
    }));
};


const VirtualDealRoom: React.FC<VirtualDealRoomProps> = ({ onAddTask }) => {
    const [folders, setFolders] = useState<Folder[]>(getInitialState);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(folders[0]?.id || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- State Persistence ---
    useEffect(() => {
        try {
            localStorage.setItem(VDR_STORAGE_KEY, JSON.stringify(folders));
        } catch (e) {
            console.error("Failed to save VDR state to local storage:", e);
        }
    }, [folders]);

    const activeFolder = folders.find(f => f.id === activeFolderId);

    // --- Folder Management ---
    const handleAddFolder = () => {
        const folderName = prompt("Enter new folder name:");
        if (folderName && folderName.trim()) {
            const newFolder: Folder = { id: crypto.randomUUID(), name: folderName.trim(), files: [] };
            setFolders(prev => [...prev, newFolder]);
            setActiveFolderId(newFolder.id);
        }
    };
    
    const handleRenameFolder = (folderId: string) => {
        const folder = folders.find(f => f.id === folderId);
        const newName = prompt("Enter new folder name:", folder?.name);
        if (newName && newName.trim()) {
            setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newName.trim() } : f));
        }
    };
    
    const handleDeleteFolder = (folderId: string) => {
        const folder = folders.find(f => f.id === folderId);
        if (folder && window.confirm(`Are you sure you want to delete the folder "${folder.name}" and all its files?`)) {
            setFolders(prev => prev.filter(f => f.id !== folderId));
            if (activeFolderId === folderId) {
                setActiveFolderId(folders[0]?.id || null);
            }
        }
    };

    // --- File & Request Management ---
    const updateFilesInActiveFolder = (updatedFiles: FileRecord[]) => {
        if (!activeFolderId) return;
        setFolders(prev => prev.map(f => f.id === activeFolderId ? { ...f, files: updatedFiles } : f));
    };

    const handleAddRequest = () => {
        const docName = prompt("Enter the name of the document to request:");
        if (docName && docName.trim() && activeFolder) {
            const newRequest: FileRecord = {
                id: crypto.randomUUID(),
                name: docName.trim(),
                type: 'Requested Document',
                size: 0,
                uploadedAt: new Date().toISOString(),
                status: 'Requested',
            };
            updateFilesInActiveFolder([newRequest, ...activeFolder.files]);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !activeFolder) return;
        const newFileRecords = Array.from(files).map((file: File) => ({
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type || 'Unknown',
            size: file.size,
            uploadedAt: new Date().toISOString(),
            status: 'Received' as const,
        }));
        updateFilesInActiveFolder([...newFileRecords, ...activeFolder.files]);
        event.target.value = ''; // Reset file input
    };

    const handleFileUpdate = (fileId: string, field: keyof FileRecord, value: any) => {
        if (!activeFolder) return;
        const updatedFiles = activeFolder.files.map(f => f.id === fileId ? { ...f, [field]: value } : f);
        updateFilesInActiveFolder(updatedFiles);
    };
    
    const handleDeleteFile = (fileId: string) => {
        if (!activeFolder) return;
        if(window.confirm("Are you sure you want to delete this file record?")) {
            const updatedFiles = activeFolder.files.filter(f => f.id !== fileId);
            updateFilesInActiveFolder(updatedFiles);
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-7xl mx-auto border border-slate-200">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6">Virtual Deal Room (VDR)</h2>
            <div className="flex flex-col md:flex-row gap-8">
                {/* Folder List */}
                <div className="w-full md:w-1/4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-slate-700">Folders</h3>
                        <button onClick={handleAddFolder} className="text-amber-600 hover:text-amber-700 text-sm font-medium">+ New</button>
                    </div>
                    <ul className="space-y-1">
                        {folders.map(folder => (
                            <li key={folder.id}>
                                <button 
                                    onClick={() => setActiveFolderId(folder.id)}
                                    className={`w-full text-left p-2 rounded-md text-sm truncate ${activeFolderId === folder.id ? 'bg-amber-100 text-amber-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {folder.name} ({folder.files.length})
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* File List for Active Folder */}
                <div className="w-full md:w-3/4">
                    {activeFolder ? (
                        <div>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3">
                                <h3 className="font-semibold text-slate-700 text-lg">{activeFolder.name}</h3>
                                <div className="flex gap-2">
                                    <button onClick={handleAddRequest} className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200">Add Request</button>
                                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600">Upload File</button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />
                                </div>
                            </div>
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                <table className="w-full text-sm text-left text-slate-500">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">Name</th>
                                            <th scope="col" className="px-6 py-3">Size</th>
                                            <th scope="col" className="px-6 py-3">Status</th>
                                            <th scope="col" className="px-6 py-3">Uploaded</th>
                                            <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeFolder.files.length > 0 ? activeFolder.files.map(file => (
                                            <tr key={file.id} className="bg-white border-b hover:bg-slate-50">
                                                <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{file.name}</th>
                                                <td className="px-6 py-4">{file.size > 0 ? formatBytes(file.size) : '-'}</td>
                                                <td className="px-6 py-4">
                                                    <select value={file.status} onChange={(e) => handleFileUpdate(file.id, 'status', e.target.value)} className={`text-xs p-1 rounded-md border-0 focus:ring-0 ${getStatusColor(file.status)}`}>
                                                        {FILE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4">{new Date(file.uploadedAt).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => handleDeleteFile(file.id)} className="font-medium text-red-600 hover:underline">Delete</button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="text-center text-slate-500 py-10">No files in this folder.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-500 py-20 border-2 border-dashed border-slate-300 rounded-lg">Select a folder to view files or add a new folder.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VirtualDealRoom;
