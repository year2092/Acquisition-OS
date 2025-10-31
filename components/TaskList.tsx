import React, { useState, useMemo } from 'react';

type Priority = 'High' | 'Medium' | 'Low';

interface Task {
  id: number;
  text: string;
  priority: Priority;
  completed: boolean;
}

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('Medium');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All');


  const handleAddTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask: Task = {
      id: Date.now(),
      text: newTaskText,
      priority: newTaskPriority,
      completed: false,
    };

    setTasks([newTask, ...tasks]);
    setNewTaskText('');
    setNewTaskPriority('Medium');
  };

  const handleToggleTaskCompletion = (taskId: number) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const statusMatch = 
        statusFilter === 'All' ||
        (statusFilter === 'Completed' && task.completed) ||
        (statusFilter === 'Pending' && !task.completed);
      
      const priorityMatch =
        priorityFilter === 'All' || task.priority === priorityFilter;

      return statusMatch && priorityMatch;
    });
  }, [tasks, statusFilter, priorityFilter]);

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:border-red-500 dark:text-red-200';
      case 'Medium':
        return 'bg-yellow-100 border-yellow-500 text-yellow-700 dark:bg-yellow-900/50 dark:border-yellow-500 dark:text-yellow-200';
      case 'Low':
        return 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:border-green-500 dark:text-green-200';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-700 dark:bg-gray-900/50 dark:border-gray-500 dark:text-gray-200';
    }
  };
  
  const getPriorityBadgeColor = (priority: Priority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'Low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg w-full max-w-3xl mx-auto border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-50 mb-6">
        Deal Room Tasks
      </h2>

      <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row items-center gap-3 mb-6">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Enter a new task..."
          className="flex-grow w-full px-4 py-3 text-base text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-transparent transition dark:placeholder-gray-400"
          aria-label="New task description"
        />
        <select
          value={newTaskPriority}
          onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
          className="w-full sm:w-auto px-4 py-3 text-base text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
          aria-label="Task priority"
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>
        <button
          type="submit"
          className="w-full sm:w-auto px-8 py-3 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition duration-200 ease-in-out disabled:bg-gray-400 dark:disabled:bg-gray-600"
          disabled={!newTaskText.trim()}
        >
          Add Task
        </button>
      </form>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Status</label>
            <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Pending' | 'Completed')}
                className="w-full px-4 py-2 text-base text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
            >
                <option value="All">All</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
            </select>
        </div>
        <div className="flex-1">
            <label htmlFor="priority-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filter by Priority</label>
            <select
                id="priority-filter"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'All' | Priority)}
                className="w-full px-4 py-2 text-base text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400"
            >
                <option value="All">All</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
            </select>
        </div>
      </div>


      <div>
        {tasks.length > 0 ? (
          filteredTasks.length > 0 ? (
            <ul className="space-y-4">
              {filteredTasks.map(task => (
                <li key={task.id} className={`flex items-center justify-between p-4 rounded-lg border-l-4 transition-opacity ${getPriorityColor(task.priority)} ${task.completed ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTaskCompletion(task.id)}
                      className="h-5 w-5 rounded border-gray-300 dark:border-gray-500 text-amber-500 focus:ring-amber-500 bg-gray-100 dark:bg-slate-600"
                      aria-labelledby={`task-label-${task.id}`}
                    />
                    <span id={`task-label-${task.id}`} className={`text-gray-800 dark:text-gray-200 ${task.completed ? 'line-through' : ''}`}>
                      {task.text}
                    </span>
                  </div>
                  <span className={`px-3 py-1 text-sm font-medium text-white rounded-full ${getPriorityBadgeColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-500 dark:text-gray-400 text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <p>No tasks match the current filters.</p>
            </div>
          )
        ) : (
          <div className="text-gray-500 dark:text-gray-400 text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <p>No tasks yet. Add one above to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;