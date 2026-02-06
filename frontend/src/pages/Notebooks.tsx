import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, Book, X, PenTool } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';

interface Notebook {
  id: string | number;
  name: string;
  description: string;
  color_theme: string;
  entry_count?: number;
  include_in_weekly_summary?: boolean;
}

export default function Notebooks() {
  const navigate = useNavigate();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const { loading: authLoading, user } = useAuth();
  // We still have local loading for data fetch
  const [loading, setLoading] = useState(true);

  // Trigger fetch when auth is ready
  useEffect(() => {
     if (!authLoading && user) {
        fetchNotebooks();
     }
  }, [authLoading, user]);
  const [showModal, setShowModal] = useState(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notebookToDelete, setNotebookToDelete] = useState<number | string | null>(null);

  // Old useEffect removed

  // Firestore logic active

  const fetchNotebooks = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
      // 1. Fetch Notebooks
      const notebooksRef = collection(db, 'notebooks');
      const q = query(notebooksRef, where('userId', '==', uid));
      const querySnapshot = await getDocs(q);
      
      const notebooksData = querySnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // 2. Fetch Entry Counts (Optimized: Get all user entries metadata)
      // Alternatively, perform a count query per notebook.
      // For now, let's fetch all user entries to count.
      const entriesRef = collection(db, 'entries');
      const entriesQ = query(entriesRef, where('userId', '==', uid));
      const entriesSnapshot = await getDocs(entriesQ);
      
      const entryCounts: Record<string, number> = {};
      entriesSnapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          if (data.notebookId) {
             entryCounts[data.notebookId] = (entryCounts[data.notebookId] || 0) + 1;
          }
      });

      const notebooksWithCounts = notebooksData.map(nb => ({
        ...nb,
        entry_count: entryCounts[nb.id] || 0
      }));
      
      setNotebooks(notebooksWithCounts);

    } catch (error) {
      console.error('Failed to fetch notebooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotebook = () => {
    setEditingNotebook(null);
    setShowModal(true);
  };

  const handleEditNotebook = (notebook: Notebook) => {
    setEditingNotebook(notebook);
    setShowModal(true);
  };

  const handleDeleteNotebook = (id: number | string) => {
     // Cast to support string IDs
    setNotebookToDelete(id as any);
    setShowDeleteModal(true);
  };

  const confirmDeleteNotebook = async () => {
    if (!notebookToDelete) return;
    
    // Ensure ID is string
    const id = notebookToDelete.toString();

    try {
      await deleteDoc(doc(db, 'notebooks', id));
      setNotebooks(notebooks.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notebook:', error);
      alert('Failed to delete notebook. Please try again.');
    } finally {
      setShowDeleteModal(false);
      setNotebookToDelete(null);
    }
  };

  const handleNotebookSaved = () => {
    fetchNotebooks();
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-sage-900">Your Notebooks</h1>
          <p className="text-sage-600 mt-1">Organize your thoughts in dedicated spaces</p>
        </div>
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCreateNotebook}
            className="btn-primary flex items-center gap-2 shadow-lg shadow-sage-200"
        >
            <Plus size={20} />
            New Notebook
        </motion.button>
      </div>

      {notebooks.length === 0 ? (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-sage-200"
        >
          <div className="w-20 h-20 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Book className="w-10 h-10 text-sage-400" />
          </div>
          <h3 className="text-xl font-medium text-sage-900 mb-2">No notebooks yet</h3>
          <p className="text-sage-500 mb-6 max-w-sm mx-auto">Create your first notebook to start organizing your daily journals and thoughts.</p>
          <button onClick={handleCreateNotebook} className="btn-primary">
            Create Notebook
          </button>
        </motion.div>
      ) : (
        <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence>
            {notebooks.map((notebook) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -4, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                key={notebook.id}
                className="group relative bg-white rounded-xl shadow-sm border border-sage-100 overflow-hidden"
              >
                {/* Color strip */}
                <div 
                    className="h-2 w-full" 
                    style={{ backgroundColor: notebook.color_theme || '#9fb09f' }}
                />
                
                <div className="p-6">
                  <div 
                    className="cursor-pointer" 
                    onClick={() => navigate(`/notebook/${notebook.id}`)}
                  >
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-serif font-semibold text-sage-900 group-hover:text-sage-700 transition-colors">
                        {notebook.name}
                        </h3>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-medium bg-sage-50 text-sage-600 px-2 py-1 rounded-full">
                              {notebook.entry_count || 0} entries
                          </span>
                          {notebook.include_in_weekly_summary && (
                            <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full">
                              📊 Weekly
                            </span>
                          )}
                        </div>
                    </div>
                    
                    <p className="text-sage-600 text-sm mb-6 line-clamp-2 min-h-[2.5rem]">
                      {notebook.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-sage-50">
                    <button
                        onClick={() => navigate(`/write?notebook=${notebook.id}`)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-sage-700 bg-sage-50 hover:bg-sage-100 rounded-lg transition-colors"
                    >
                        <PenTool size={16} />
                        Write
                    </button>
                    <button
                      onClick={() => handleEditNotebook(notebook)}
                      className="p-2 text-sage-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteNotebook(notebook.id)}
                      className="p-2 text-sage-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Notebook Modal */}
      <AnimatePresence>
        {showModal && (
          <NotebookModal
            notebook={editingNotebook}
            onClose={() => setShowModal(false)}
            onSaved={handleNotebookSaved}
          />
        )}
      </AnimatePresence>


      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDeleteModal(false)}
                className="absolute inset-0 bg-sage-900/20 backdrop-blur-sm"
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm relative z-10 text-center"
            >
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="text-red-600" size={24} />
                </div>
                <h3 className="text-xl font-serif font-bold text-sage-900 mb-2">
                    Delete Notebook?
                </h3>
                <p className="text-sage-600 mb-6">
                    Are you sure you want to delete this notebook? All entries inside it will be permanently removed.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowDeleteModal(false)}
                        className="flex-1 btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={confirmDeleteNotebook}
                        className="flex-1 bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Notebook Modal Component
interface NotebookModalProps {
  notebook: Notebook | null;
  onClose: () => void;
  onSaved: () => void;
}

function NotebookModal({ notebook, onClose, onSaved }: NotebookModalProps) {
  const [name, setName] = useState(notebook?.name || '');
  const [description, setDescription] = useState(notebook?.description || '');
  const [colorTheme, setColorTheme] = useState(notebook?.color_theme || '#9fb09f');
  const [includeInSummary, setIncludeInSummary] = useState(notebook?.include_in_weekly_summary || false);
  const [saving, setSaving] = useState(false);

  const colors = [
    '#9fb09f', // Sage
    '#64748b', // Slate
    '#94a3b8', // Cool Gray
    '#d4a373', // Earth
    '#e76f51', // Terra Cotta
    '#2a9d8f', // Teal
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
      // If enabling weekly summary on this notebook, disable it on all others
      if (includeInSummary) {
        const notebooksRef = collection(db, 'notebooks');
        const q = query(
          notebooksRef, 
          where('userId', '==', uid),
          where('include_in_weekly_summary', '==', true)
        );
        const snapshot = await getDocs(q);
        
        // Disable weekly summary on all other notebooks
        const batch = snapshot.docs
          .filter((doc: any) => doc.id !== notebook?.id?.toString())
          .map((doc: any) => updateDoc(doc.ref, { include_in_weekly_summary: false }));
        
        await Promise.all(batch);
      }

      if (notebook) {
         // Update
         const notebookRef = doc(db, 'notebooks', notebook.id.toString());
         await updateDoc(notebookRef, {
            name,
            description,
            color_theme: colorTheme,
            include_in_weekly_summary: includeInSummary,
            updatedAt: new Date().toISOString()
         });
      } else {
         // Create
         await addDoc(collection(db, 'notebooks'), {
            userId: uid,
            name,
            description,
            color_theme: colorTheme,
            include_in_weekly_summary: includeInSummary,
            createdAt: new Date().toISOString()
         });
      }
      onSaved();
    } catch (error) {
      console.error('Failed to save notebook:', error);
      alert('Failed to save notebook. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-sage-900/20 backdrop-blur-sm"
        />
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative z-10"
        >
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif font-bold text-sage-900">
                    {notebook ? 'Edit Notebook' : 'Create New Notebook'}
                </h3>
                <button onClick={onClose} className="text-sage-400 hover:text-sage-600 transition-colors">
                    <X size={24} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                Name
                </label>
                <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="e.g., Daily Reflections"
                required
                autoFocus
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                Description (optional)
                </label>
                <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field min-h-[80px]"
                rows={3}
                placeholder="What is this notebook for?"
                />
            </div>

            {/* Privacy Toggle */}
             <div className="flex items-center justify-between p-3 bg-sage-50 rounded-lg border border-sage-100">
                <div className="flex-1 mr-4">
                    <label className="text-sm font-medium text-sage-900">Include in Weekly Summary</label>
                    <p className="text-xs text-sage-500">Allow Moir to generate privacy-focused insights from this notebook.</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={includeInSummary}
                    onClick={() => setIncludeInSummary(!includeInSummary)}
                    className={`
                        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sage-600 focus:ring-offset-2
                        ${includeInSummary ? 'bg-sage-600' : 'bg-gray-200'}
                    `}
                >
                    <span
                        aria-hidden="true"
                        className={`
                            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                            ${includeInSummary ? 'translate-x-5' : 'translate-x-0'}
                        `}
                    />
                </button>
            </div>


            <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">
                Color Theme
                </label>
                <div className="flex flex-wrap gap-3">
                {colors.map((color) => (
                    <button
                        key={color}
                        type="button"
                        onClick={() => setColorTheme(color)}
                        className={`w-8 h-8 rounded-full transition-transform ring-2 ring-offset-2 ${
                            colorTheme === color ? 'scale-110 ring-sage-400' : 'ring-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                    />
                ))}
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button
                type="button"
                onClick={onClose}
                className="flex-1 btn-secondary"
                disabled={saving}
                >
                Cancel
                </button>
                <button
                type="submit"
                className="flex-1 btn-primary"
                disabled={saving}
                >
                {saving ? 'Saving...' : notebook ? 'Save Changes' : 'Create Notebook'}
                </button>
            </div>
            </form>
        </motion.div>
    </div>
  );
}
