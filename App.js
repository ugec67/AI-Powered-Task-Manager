import React, { useState, useEffect } from 'react';

// Main App component
const App = () => {
  // Initialize theme from localStorage or default to 'light'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'light';
  });

  // Task structure now includes a 'status' field: 'todo', 'in-progress', 'done'
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = '';
  const [aiLoadingTaskId, setAiLoadingTaskId] = useState(null); // Tracks which task is being analyzed by AI
  const [breakdownLoadingTaskId, setBreakdownLoadingTaskId] = useState(null); // Tracks which task is being broken down

  // Effect to apply theme class to the documentElement and save to localStorage
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Function to toggle theme between 'light' and 'dark'
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Function to add a new task
  const addTask = () => {
    if (newTaskText.trim() !== '') {
      const newId = Date.now(); // Simple unique ID
      // New tasks default to 'todo' status
      setTasks([...tasks, { id: newId, text: newTaskText, completed: false, status: 'todo', aiAnalysis: null, aiSubTasks: null, isSubTasksVisible: false }]);
      setNewTaskText('');
    }
  };

  // Function to toggle task completion status and update status
  const toggleComplete = (id) => {
    setTasks(tasks.map(task => {
      if (task.id === id) {
        // If completing, set status to 'done', otherwise to 'todo' or 'in-progress'
        const newStatus = !task.completed ? 'done' : 'todo';
        return { ...task, completed: !task.completed, status: newStatus };
      }
      return task;
    }));
  };

  // Function to toggle visibility of sub-tasks
  const toggleSubTasksVisibility = (id) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, isSubTasksVisible: !task.isSubTasksVisible } : task
    ));
  };

  // Function to delete a task
  const deleteTask = (id) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Allows dropping
  };

  const handleDrop = (e, newStatus) => {
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        // If moving to 'done', mark as completed, otherwise uncomplete
        const newCompleted = newStatus === 'done' ? true : false;
        return { ...task, status: newStatus, completed: newCompleted };
      }
      return task;
    }));
  };

  // Function to analyze a task using AI for category, priority, and notes
  const analyzeTaskWithAI = async (taskId, taskText) => {
    setAiLoadingTaskId(taskId); // Set loading state for this specific task
    try {
      let chatHistory = [];
      const prompt = `Analyze the following task and provide its category, priority, and any relevant notes in JSON format.
      Consider implied deadlines, importance, and workload from the task description to determine the priority.
      Categories could include: "Work", "Personal", "Learning", "Health", "Home", "Finance", "Social", "Urgent".
      Priorities should be: "High", "Medium", "Low".

      Task: "${taskText}"`;

      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = {
        contents: chatHistory,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              "category": { "type": "STRING" },
              "priority": { "type": "STRING" },
              "notes": { "type": "STRING" }
            },
            propertyOrdering: ["category", "priority", "notes"]
          }
        }
      };

      // API key is handled by the Canvas environment for gemini-2.0-flash
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonString = result.candidates[0].content.parts[0].text;
        const aiAnalysis = JSON.parse(jsonString);

        setTasks(tasks.map(task =>
          task.id === taskId ? { ...task, aiAnalysis: aiAnalysis } : task
        ));
      } else {
        console.error("AI response structure is unexpected or content is missing:", result);
        setTasks(tasks.map(task =>
            task.id === taskId ? { ...task, aiAnalysis: { category: "Error", priority: "Error", notes: "Could not analyze" } } : task
        ));
      }
    } catch (error) {
      console.error("Error analyzing task with AI:", error);
      setTasks(tasks.map(task =>
          task.id === taskId ? { ...task, aiAnalysis: { category: "Error", priority: "Error", notes: `Analysis failed: ${error.message}` } } : task
      ));
    } finally {
      setAiLoadingTaskId(null); // Clear loading state
    }
  };

  // Function to break down a task into sub-tasks using AI
  const breakdownTaskWithAI = async (taskId, taskText) => {
    setBreakdownLoadingTaskId(taskId); // Set loading state for this specific task
    try {
      let chatHistory = [];
      const prompt = `Break down the following complex task into a list of smaller, actionable sub-tasks.
      Return the sub-tasks as a JSON array of strings.

      Task: "${taskText}"`;

      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = {
        contents: chatHistory,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: { "type": "STRING" }
          }
        }
      };

      const apiKey = ""; // API key is handled by the Canvas environment
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonString = result.candidates[0].content.parts[0].text;
        const aiSubTasks = JSON.parse(jsonString);

        setTasks(tasks.map(task =>
          task.id === taskId ? { ...task, aiSubTasks: aiSubTasks, isSubTasksVisible: true } : task
        ));
      } else {
        console.error("AI breakdown response structure is unexpected or content is missing:", result);
        setTasks(tasks.map(task =>
            task.id === taskId ? { ...task, aiSubTasks: ["Could not break down task."], isSubTasksVisible: true } : task
        ));
      }
    } catch (error) {
      console.error("Error breaking down task with AI:", error);
      setTasks(tasks.map(task =>
          task.id === taskId ? { ...task, aiSubTasks: [`Breakdown failed: ${error.message}`], isSubTasksVisible: true } : task
      ));
    } finally {
      setBreakdownLoadingTaskId(null); // Clear loading state
    }
  };

  const renderTaskCard = (task) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      className="bg-task-item p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 transition duration-200 hover:shadow-md mb-4 cursor-grab"
    >
      {/* Main Task Text and Checkbox */}
      <div className="flex items-start sm:items-center flex-grow mb-3 w-full">
        <input
          type="checkbox"
          className="form-checkbox h-6 w-6 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer flex-shrink-0 mt-1 sm:mt-0"
          checked={task.completed}
          onChange={() => toggleComplete(task.id)}
        />
        <span className={`ml-4 text-xl flex-grow ${task.completed ? 'line-through text-completed-task' : 'text-task-item'}`}>
          {task.text}
        </span>
      </div>

      {/* AI Analysis and Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4 sm:mt-0 w-full">
        {task.aiAnalysis && (
          <div className="text-sm bg-ai-analysis px-3 py-1 rounded-lg font-medium shadow-inner flex-shrink-0 w-full sm:w-auto">
            <span className="font-semibold">Cat:</span> {task.aiAnalysis.category} | <span className="font-semibold">Prio:</span> {task.aiAnalysis.priority}
            {task.aiAnalysis.notes && <p className="text-xs text-indigo-700 dark:text-indigo-200 mt-1 italic">{task.aiAnalysis.notes}</p>}
          </div>
        )}

        <button
          onClick={() => analyzeTaskWithAI(task.id, task.text)}
          disabled={aiLoadingTaskId === task.id}
          className={`px-4 py-2 text-md font-medium rounded-lg transition duration-200 whitespace-nowrap
            ${aiLoadingTaskId === task.id
              ? 'bg-blue-300 text-white cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
            }`}
        >
          {aiLoadingTaskId === task.id ? 'Analyzing...' : 'AI Analyze'}
        </button>

        <button
          onClick={() => breakdownTaskWithAI(task.id, task.text)}
          disabled={breakdownLoadingTaskId === task.id}
          className={`px-4 py-2 text-md font-medium rounded-lg transition duration-200 whitespace-nowrap
            ${breakdownLoadingTaskId === task.id
              ? 'bg-green-300 text-white cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
            }`}
        >
          {breakdownLoadingTaskId === task.id ? 'Breaking Down...' : 'Breakdown Task'}
        </button>

        <button
          onClick={() => deleteTask(task.id)}
          className="px-4 py-2 text-md font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 shadow-sm transition duration-200 whitespace-nowrap"
        >
          Delete
        </button>
      </div>

      {/* AI Sub-Tasks Section */}
      {task.aiSubTasks && (
        <div className="mt-4 w-full bg-subtask-container p-4 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-lg text-subtask">AI Suggested Sub-Tasks:</h4>
            <button
              onClick={() => toggleSubTasksVisibility(task.id)}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-medium"
            >
              {task.isSubTasksVisible ? 'Hide' : 'Show'}
            </button>
          </div>
          {task.isSubTasksVisible && (
            <ul className="list-disc pl-5 text-subtask space-y-1">
              {task.aiSubTasks.map((subTask, index) => (
                <li key={index} className="text-base">{subTask}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`${theme} min-h-screen ${theme === 'light' ? 'bg-gradient-to-br from-purple-600 to-indigo-800' : 'bg-gradient-to-br from-gray-900 to-gray-700'} p-8 font-inter antialiased transition-colors duration-300`}>
      {/* Tailwind CSS is loaded in public/index.html */}
      {/* Inter font is loaded in public/index.html */}
      <style>{`
        /* Custom styles for light/dark mode transitions */
        /* These styles could also be moved to index.css and configured via Tailwind's @apply directives */
        .light .bg-container { background-color: white; }
        .light .text-primary { color: #1f2937; /* gray-900 */ }
        .light .bg-task-item { background-color: #f9fafb; /* gray-50 */ border-color: #e5e7eb; /* gray-200 */ }
        .light .text-task-item { color: #1f2937; /* gray-800 */ }
        .light .text-completed-task { color: #6b7280; /* gray-500 */ }
        .light .bg-input-border { border-color: #d1d5db; /* gray-300 */ }
        .light .focus-ring-input { border-color: #6366f1; /* indigo-500 */ }
        .light .text-placeholder { color: #9ca3af; /* gray-400 */ }
        .light .bg-ai-analysis { background-color: #e0e7ff; /* indigo-100 */ color: #3730a3; /* indigo-800 */ }
        .light .bg-subtask-container { background-color: #f3f4f6; /* gray-100 */ border-color: #e5e7eb; /* gray-200 */ }
        .light .text-subtask { color: #374151; /* gray-700 */ }
        .light .kanban-column-bg { background-color: #f3f4f6; /* gray-100 */ }
        .light .kanban-column-border { border-color: #e5e7eb; /* gray-200 */ }
        .light .kanban-header-text { color: #1f2937; /* gray-900 */ }

        .dark .bg-container { background-color: #1f2937; /* gray-900 */ }
        .dark .text-primary { color: #f3f4f6; /* gray-100 */ }
        .dark .bg-task-item { background-color: #374151; /* gray-700 */ border-color: #4b5563; /* gray-600 */ }
        .dark .text-task-item { color: #f3f4f6; /* gray-100 */ }
        .dark .text-completed-task { color: #9ca3af; /* gray-400 */ }
        .dark .bg-input-border { border-color: #4b5563; /* gray-600 */ background-color: #374151; /* gray-700 */ color: #f3f4f6; /* gray-100 */ }
        .dark .focus-ring-input { border-color: #818cf8; /* indigo-400 */ }
        .dark .text-placeholder { color: #6b7280; /* gray-500 */ }
        .dark .bg-ai-analysis { background-color: #4338ca; /* indigo-700 */ color: #e0e7ff; /* indigo-100 */ }
        .dark .bg-subtask-container { background-color: #374151; /* gray-700 */ border-color: #4b5563; /* gray-600 */ }
        .dark .text-subtask { color: #d1d5db; /* gray-300 */ }
        .dark .kanban-column-bg { background-color: #374151; /* gray-700 */ }
        .dark .kanban-column-border { border-color: #4b5563; /* gray-600 */ }
        .dark .kanban-header-text { color: #f3f4f6; /* gray-100 */ }
      `}</style>

      <div className="max-w-6xl mx-auto bg-container rounded-3xl shadow-xl p-8 sm:p-10 transition-colors duration-300">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-primary">
            AI-Powered Task Manager
          </h1>
          <button
            onClick={toggleTheme}
            className="p-3 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors duration-300"
            aria-label="Toggle light/dark mode"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h1M3 12h1m15.325-4.275l-.707-.707M4.372 19.325l-.707-.707m12.728 0l.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Task Input Section */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <input
            type="text"
            className="flex-grow p-4 bg-input-border border rounded-xl focus:outline-none focus-ring-input transition duration-200 text-lg text-primary placeholder-text-placeholder"
            placeholder="Add a new task..."
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addTask();
              }
            }}
          />
          <button
            onClick={addTask}
            className="px-6 py-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-200 text-lg whitespace-nowrap"
          >
            Add Task
          </button>
        </div>

        {/* Kanban Board Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['todo', 'in-progress', 'done'].map((status) => (
            <div
              key={status}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
              className="kanban-column-bg p-5 rounded-2xl shadow-lg border kanban-column-border min-h-[300px]"
            >
              <h2 className="text-2xl font-bold mb-6 capitalize text-center kanban-header-text">
                {status.replace('-', ' ')} ({tasks.filter(task => task.status === status).length})
              </h2>
              {tasks
                .filter((task) => task.status === status)
                .map((task) => renderTaskCard(task))}
              {tasks.filter(task => task.status === status).length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 italic">Drag tasks here or add new ones!</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
