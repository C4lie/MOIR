import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Clock, Hash } from 'lucide-react';
import { motion } from 'framer-motion';

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface InsightsData {
  has_enough_data: boolean;
  message?: string;
  summary_text?: string;
  top_keywords?: string[];
  dominant_time?: string;
  entry_count?: number;
}

export default function WeeklyReflection() {
  const navigate = useNavigate();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights();
  }, []);

  /* Imports processed */

  const fetchInsights = async () => {
    if (!auth.currentUser) return;
    try {
      // Calculate start of week (Monday) and end of week (Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
      const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

      console.log('📅 Week Range:', { startOfWeekStr, endOfWeekStr, today: now.toISOString().split('T')[0] });

      // First, fetch notebooks with weekly summary enabled
      const notebooksRef = collection(db, 'notebooks');
      const notebooksQuery = query(
        notebooksRef,
        where('userId', '==', auth.currentUser.uid),
        where('include_in_weekly_summary', '==', true)
      );
      const notebooksSnapshot = await getDocs(notebooksQuery);
      const weeklyNotebookIds = notebooksSnapshot.docs.map((doc: any) => doc.id);

      console.log('📚 Enabled Notebooks:', weeklyNotebookIds);

      // If no notebooks have weekly summary enabled, show message
      if (weeklyNotebookIds.length === 0) {
        setData({ 
          has_enough_data: false,
          message: "No notebook is enabled for weekly reflection. Go to Notebooks and enable 'Include in Weekly Summary' for one notebook."
        });
        return;
      }

      // Now fetch entries from the enabled notebook(s) within the current week
      const entriesRef = collection(db, 'entries');
      const q = query(
          entriesRef, 
          where('userId', '==', auth.currentUser.uid),
          where('notebookId', 'in', weeklyNotebookIds)
      );
      
      const snapshot = await getDocs(q);
      let entries = snapshot.docs.map((doc: any) => doc.data());

      console.log('📝 All entries from enabled notebook:', entries.map((e: any) => ({ date: e.entry_date, title: e.title })));

      // Client-side filtering for current week
      entries = entries.filter((entry: any) => 
        entry.entry_date >= startOfWeekStr && entry.entry_date <= endOfWeekStr
      );
      
      console.log('✅ Entries within current week:', entries.map((e: any) => ({ date: e.entry_date, title: e.title })));
      console.log('📊 Entry count:', entries.length);
      
      // Client-side sorting
      entries.sort((a: any, b: any) => {
        if (a.entry_date < b.entry_date) return 1;
        if (a.entry_date > b.entry_date) return -1;
        return 0;
      });
      
      if (entries.length === 0) {
           setData({ 
             has_enough_data: false,
             message: "No entries found for this week in your enabled notebook. Start writing to see insights!"
           });
           return;
      }

      if (entries.length < 3) {
           setData({ 
             has_enough_data: false,
             message: `You have ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} this week. Write at least 3 entries to see meaningful insights.`
           });
           return;
      }

      // Real analysis from actual entries
      const entryCount = entries.length;
      
      // Extract keywords from entry content (basic implementation)
      const allWords = entries
        .map((e: any) => `${e.title || ''} ${e.content || ''}`)
        .join(' ')
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter((word: string) => word.length > 4); // Only words longer than 4 chars

      // Count word frequency
      const wordFreq: Record<string, number> = {};
      allWords.forEach((word: string) => {
        if (!['about', 'would', 'could', 'should', 'think', 'there', 'their', 'these', 'those'].includes(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });

      // Get top 3 keywords
      const topKeywords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

      // Calculate dominant time from created_at timestamps
      let dominantTime = 'Various times';
      const timeSlots = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
      
      entries.forEach((e: any) => {
        if (e.created_at && e.created_at.toDate) {
          const date = e.created_at.toDate();
          const hour = date.getHours();
          if (hour >= 5 && hour < 12) timeSlots.Morning++;
          else if (hour >= 12 && hour < 17) timeSlots.Afternoon++;
          else if (hour >= 17 && hour < 21) timeSlots.Evening++;
          else timeSlots.Night++;
        }
      });

      const maxSlot = Object.entries(timeSlots).reduce((a, b) => a[1] > b[1] ? a : b);
      if (maxSlot[1] > 0) {
        dominantTime = maxSlot[0];
      }

      // Generate dynamic summary
      let summaryText = '';
      if (entryCount >= 5) {
        summaryText = `You've been very consistent this week with ${entryCount} entries. Your dedication to reflection is impressive!`;
      } else if (entryCount >= 3) {
        summaryText = `You've maintained a good writing rhythm this week. Keep it up to discover deeper patterns.`;
      }

      console.log('🎯 Analysis complete:', { entryCount, topKeywords, dominantTime, summaryText });

      setData({
          has_enough_data: true,
          summary_text: summaryText,
          entry_count: entryCount,
          dominant_time: dominantTime,
          top_keywords: topKeywords.length > 0 ? topKeywords : undefined
      });

    } catch (err) {
      console.error('Error fetching insights:', err);
      setError('Failed to load insights.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
     return (
        <div className="flex items-center justify-center min-h-screen bg-paper">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600"></div>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-paper p-6 flex flex-col items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-sage-100 overflow-hidden relative"
      >
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-sage-50 to-transparent pointer-events-none" />
        
        <div className="relative p-6 md:p-12">
            <div className="flex justify-between items-center mb-8">
                <button 
                    onClick={() => navigate('/dashboard')}
                    className="group flex items-center gap-2 text-sage-500 hover:text-sage-800 transition-colors"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium">Close</span>
                </button>
                <div className="flex items-center gap-2 text-sage-600 bg-sage-50 px-3 py-1 rounded-full text-sm font-medium">
                    <Sparkles size={16} />
                    Weekly Reflection
                </div>
            </div>

            {error ? (
                 <div className="text-center py-12">
                    <p className="text-red-500">{error}</p>
                 </div>
            ) : !data?.has_enough_data ? (
                <div className="text-center py-12">
                    <h2 className="text-2xl font-serif font-bold text-sage-900 mb-4">Not enough data yet</h2>
                    <p className="text-sage-600 max-w-md mx-auto mb-6">
                        {data?.message || "Write a few more entries in your 'Weekly Summary' enabled notebooks to see insights here."}
                    </p>
                    <button 
                        onClick={() => navigate('/write')}
                        className="btn-primary"
                    >
                        Write an Entry
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Main Summary Card */}
                    <div className="text-center">
                        <h2 className="text-3xl md:text-4xl font-serif font-bold text-sage-900 mb-6 leading-tight">
                            Your Week in Words
                        </h2>
                        <div className="bg-gradient-to-br from-sage-50 to-indigo-50/50 p-6 rounded-2xl border border-sage-100 shadow-sm">
                            <p className="text-lg md:text-xl text-sage-800 leading-relaxed italic font-serif">
                                "{data.summary_text}"
                            </p>
                        </div>
                    </div>

                    {/* Subtle Insights Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Time Insight */}
                        <div className="p-4 rounded-xl bg-white border border-sage-100 flex items-center gap-4 shadow-sm">
                             <div className="bg-amber-50 p-3 rounded-full text-amber-600">
                                <Clock size={24} />
                             </div>
                             <div>
                                 <p className="text-xs font-semibold text-sage-400 uppercase tracking-wider">Most Active</p>
                                 <p className="text-sage-900 font-medium capitalize">{data.dominant_time}</p>
                             </div>
                        </div>

                         {/* Volume Insight */}
                        <div className="p-4 rounded-xl bg-white border border-sage-100 flex items-center gap-4 shadow-sm">
                             <div className="bg-indigo-50 p-3 rounded-full text-indigo-600">
                                <Hash size={24} />
                             </div>
                             <div>
                                 <p className="text-xs font-semibold text-sage-400 uppercase tracking-wider">Entries</p>
                                 <p className="text-sage-900 font-medium">{data.entry_count} entries this week</p>
                             </div>
                        </div>
                    </div>

                    {/* Keywords (Subtle) */}
                    {data.top_keywords && data.top_keywords.length > 0 && (
                        <div>
                             <p className="text-center text-xs font-semibold text-sage-400 uppercase tracking-wider mb-3">
                                Recurring Themes
                             </p>
                             <div className="flex flex-wrap justify-center gap-2">
                                {data.top_keywords.map((word, i) => (
                                    <span 
                                        key={i}
                                        className="px-3 py-1 bg-sage-50 text-sage-600 text-sm rounded-full border border-sage-100"
                                    >
                                        #{word}
                                    </span>
                                ))}
                             </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
}
