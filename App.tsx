import React, { useState, useEffect, useRef } from 'react';
import { 
  CompassIcon, 
  LibraryIcon, 
  PlusIcon, 
  SearchIcon, 
  MicIcon, 
  SendIcon, 
  ExternalLinkIcon, 
  UserIcon,
  BrainIcon,
  VolumeIcon
} from './components/Icons';
import MarkdownRenderer from './components/MarkdownRenderer';
import { streamResponse, generateTitle } from './services/geminiService';
import { startListening, speakText } from './services/voiceService';
import { Thread, Message, AppView, Source, DiscoveryItem } from './types';

// Mock Discovery Data
const DISCOVERY_DATA: DiscoveryItem[] = [
  {
    id: '1',
    title: 'Quantum Computing Breakthroughs',
    snippet: 'Recent advances in qubit stability have led to error rates dropping below the critical threshold...',
    author: 'Sarah Chen',
    likes: 342,
    tags: ['Science', 'Tech']
  },
  {
    id: '2',
    title: 'The Future of Sustainable Cities',
    snippet: 'Vertical farming integration into residential skyscrapers is becoming a viable standard for new eco-cities...',
    author: 'Marcus Aurelius',
    likes: 215,
    tags: ['Environment', 'Future']
  },
  {
    id: '3',
    title: 'Understanding Baroque Art',
    snippet: 'The dramatic use of light and shadow, known as chiaroscuro, defines the emotional intensity of the Baroque period...',
    author: 'Elena R.',
    likes: 189,
    tags: ['Art', 'History']
  }
];

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load threads from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('kenotrix_threads');
    if (saved) {
      setThreads(JSON.parse(saved));
    }
  }, []);

  // Save threads to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('kenotrix_threads', JSON.stringify(threads));
  }, [threads]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (activeThreadId) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [threads, activeThreadId, isTyping]);

  const activeThread = threads.find(t => t.id === activeThreadId);

  const createNewThread = () => {
    const newThread: Thread = {
      id: Date.now().toString(),
      title: 'New Search',
      messages: [],
      updatedAt: Date.now()
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    setCurrentView(AppView.HOME);
    return newThread.id;
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    let threadId = activeThreadId;
    if (!threadId) {
      threadId = createNewThread();
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    setThreads(prev => prev.map(t => {
      if (t.id === threadId) {
        return { ...t, messages: [...t.messages, newMessage] };
      }
      return t;
    }));

    setInput('');
    setIsTyping(true);

    // Prepare history for Gemini
    const thread = threads.find(t => t.id === threadId);
    // If it's a new thread (just created above), we use empty history (except the message we just added)
    // Actually, we need to pass previous messages.
    // NOTE: state update is async, so `activeThread` might not be updated yet. 
    // We use functional update logic or the local variable.
    
    // Let's get the current messages from the state for the API call
    // We filter out the message we just added because we pass it as 'currentMessage' 
    // Wait, createNewThread sets state, but handleSend continues. 
    // Safe bet: Pass accumulated history.
    
    const currentMessages = thread ? thread.messages : []; 
    const history = currentMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
    }));

    // Create a placeholder for the AI response
    const aiMessageId = (Date.now() + 1).toString();
    
    setThreads(prev => prev.map(t => {
        if (t.id === threadId) {
            return {
                ...t,
                messages: [...t.messages, {
                    id: aiMessageId,
                    role: 'model',
                    content: '',
                    timestamp: Date.now()
                }]
            };
        }
        return t;
    }));

    let fullResponse = "";
    
    await streamResponse(
      history,
      text,
      (chunk) => {
        fullResponse += chunk;
        setThreads(prev => prev.map(t => {
            if (t.id === threadId) {
                const msgs = t.messages.map(m => {
                    if (m.id === aiMessageId) {
                        return { ...m, content: fullResponse };
                    }
                    return m;
                });
                return { ...t, messages: msgs };
            }
            return t;
        }));
      },
      (sources) => {
          setThreads(prev => prev.map(t => {
              if (t.id === threadId) {
                  const msgs = t.messages.map(m => {
                      if (m.id === aiMessageId) {
                          return { ...m, sources: sources };
                      }
                      return m;
                  });
                  return { ...t, messages: msgs };
              }
              return t;
          }));
      }
    );

    setIsTyping(false);

    // Update Title if it's the first exchange
    const updatedThread = threads.find(t => t.id === threadId); // Re-fetch
    if (updatedThread && updatedThread.messages.length <= 2) {
       const newTitle = await generateTitle(text);
       setThreads(prev => prev.map(t => t.id === threadId ? { ...t, title: newTitle } : t));
    }
  };

  const handleVoiceInput = () => {
    setIsListening(true);
    startListening(
      (text) => {
        setInput(text);
        // Optional: Auto-send
        // handleSend(text); 
      },
      () => setIsListening(false)
    );
  };

  const handleDeleteThread = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setThreads(prev => prev.filter(t => t.id !== id));
    if (activeThreadId === id) {
      setActiveThreadId(null);
    }
  };

  // Render Helpers
  const renderHome = () => {
    if (!activeThreadId) {
      // Empty State / Landing
      return (
        <div className="flex flex-col items-center justify-center h-full px-4 max-w-3xl mx-auto w-full">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-semibold text-zinc-100 mb-4 tracking-tight">
              Where knowledge begins
            </h1>
            <p className="text-zinc-400 text-lg">
              Ask <span className="text-brand-400 font-medium">Kenotrix</span> anything.
            </p>
          </div>
          
          <div className="w-full relative bg-zinc-850 rounded-xl border border-zinc-700/50 shadow-2xl p-4 transition-all focus-within:ring-2 focus-within:ring-brand-500/50 focus-within:border-brand-500/50">
             <textarea 
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Ask anything..."
                className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 resize-none outline-none h-14 text-lg"
             />
             <div className="flex justify-between items-center mt-2">
                 <div className="flex items-center gap-2">
                     <button 
                       onClick={handleVoiceInput}
                       className={`p-2 rounded-full hover:bg-zinc-700 transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`}>
                         <MicIcon />
                     </button>
                 </div>
                 <button 
                   onClick={() => handleSend()}
                   disabled={!input.trim()}
                   className="bg-brand-500 hover:bg-brand-400 text-black p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                     <SendIcon className="w-5 h-5" />
                 </button>
             </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            {['History of Jazz', 'How to bake sourdough', 'Latest AI news', 'Quantum physics basics'].map(suggestion => (
                <button 
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm border border-zinc-700 transition-colors"
                >
                  {suggestion}
                </button>
            ))}
          </div>
        </div>
      );
    }

    // Chat View
    return (
      <div className="flex flex-col h-full max-w-3xl mx-auto w-full relative">
        <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-32">
           {activeThread?.messages.map((msg, idx) => (
             <div key={msg.id} className="group">
               {msg.role === 'user' ? (
                 <div className="flex justify-end">
                    <div className="max-w-[80%]">
                       <h3 className="text-2xl font-medium text-zinc-100 mb-2">{msg.content}</h3>
                    </div>
                 </div>
               ) : (
                 <div className="flex gap-4">
                   <div className="mt-1 flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-400">
                          <BrainIcon className="w-5 h-5" />
                      </div>
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-zinc-100">Kenotrix</span>
                          <span className="text-xs text-zinc-500 uppercase tracking-wider">Answer</span>
                          <button onClick={() => speakText(msg.content)} className="ml-2 text-zinc-600 hover:text-zinc-400">
                             <VolumeIcon className="w-4 h-4" />
                          </button>
                      </div>

                      {/* Sources Section */}
                      {msg.sources && msg.sources.length > 0 && (
                          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                             {msg.sources.slice(0, 4).map((source, i) => (
                                 <a 
                                   key={i} 
                                   href={source.uri} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600 transition-all group/card"
                                 >
                                    <div className="flex-1 min-w-0">
                                       <div className="text-xs text-zinc-400 truncate mb-0.5">{new URL(source.uri).hostname}</div>
                                       <div className="text-sm text-zinc-200 truncate font-medium group-hover/card:text-brand-400 transition-colors">{source.title}</div>
                                    </div>
                                    <ExternalLinkIcon className="w-4 h-4 text-zinc-600 group-hover/card:text-brand-400" />
                                 </a>
                             ))}
                          </div>
                      )}

                      <MarkdownRenderer content={msg.content} />
                      
                      {/* Footer actions for message could go here */}
                   </div>
                 </div>
               )}
               {idx === activeThread.messages.length - 1 && isTyping && (
                  <div className="flex gap-4 mt-8 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-zinc-800"></div>
                      <div className="flex-1 space-y-2">
                          <div className="h-4 bg-zinc-800 rounded w-1/4"></div>
                          <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
                      </div>
                  </div>
               )}
             </div>
           ))}
           <div ref={bottomRef} />
        </div>

        {/* Sticky Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e] to-transparent pt-10 pb-6 px-4">
           <div className="bg-zinc-850 rounded-xl border border-zinc-700/50 shadow-2xl p-3 flex items-center gap-3 focus-within:ring-1 focus-within:ring-zinc-600">
               <button 
                  onClick={handleVoiceInput}
                  className={`p-2 rounded-full hover:bg-zinc-700 transition-colors ${isListening ? 'text-red-500' : 'text-zinc-400'}`}>
                    <MicIcon className="w-5 h-5" />
               </button>
               <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  placeholder="Ask follow-up..."
                  className="flex-1 bg-transparent text-zinc-200 placeholder-zinc-500 outline-none"
               />
               <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className="bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 p-2 rounded-lg transition-colors disabled:opacity-50">
                   <SendIcon className="w-5 h-5" />
               </button>
           </div>
           <div className="text-center mt-2 text-xs text-zinc-600">
               Kenotrix can make mistakes. Consider checking important information.
           </div>
        </div>
      </div>
    );
  };

  const renderDiscover = () => (
    <div className="max-w-4xl mx-auto px-4 py-8 overflow-y-auto h-full">
       <h2 className="text-3xl font-bold text-zinc-100 mb-8 flex items-center gap-3">
         <CompassIcon className="w-8 h-8 text-brand-400" />
         Discover
       </h2>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DISCOVERY_DATA.map(item => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl hover:border-zinc-700 transition-all cursor-pointer group">
               <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2">
                     {item.tags.map(tag => (
                       <span key={tag} className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">{tag}</span>
                     ))}
                  </div>
                  <div className="text-zinc-500 text-xs flex items-center gap-1">
                     <UserIcon className="w-3 h-3" /> {item.author}
                  </div>
               </div>
               <h3 className="text-xl font-semibold text-zinc-100 mb-2 group-hover:text-brand-400 transition-colors">{item.title}</h3>
               <p className="text-zinc-400 text-sm line-clamp-3 mb-4">{item.snippet}</p>
               <div className="flex justify-between items-center text-zinc-600 text-sm border-t border-zinc-800 pt-3">
                  <span>{item.likes} likes</span>
                  <button className="text-brand-400 hover:underline text-xs" onClick={() => {
                      // Simulate opening a discovered item
                      const newId = createNewThread();
                      setThreads(prev => prev.map(t => t.id === newId ? {...t, title: item.title, messages: [{
                          id: '1', role: 'user', content: `Tell me about ${item.title}`, timestamp: Date.now()
                      }, {
                          id: '2', role: 'model', content: item.snippet + "...", timestamp: Date.now()
                      }]} : t));
                  }}>View Thread</button>
               </div>
            </div>
          ))}
       </div>
    </div>
  );

  const renderLibrary = () => (
    <div className="max-w-4xl mx-auto px-4 py-8 overflow-y-auto h-full">
        <h2 className="text-3xl font-bold text-zinc-100 mb-8 flex items-center gap-3">
            <LibraryIcon className="w-8 h-8 text-brand-400" />
            Your Library
        </h2>
        {threads.length === 0 ? (
            <div className="text-center text-zinc-500 py-20">
                You haven't searched for anything yet.
            </div>
        ) : (
            <div className="space-y-2">
                {threads.map(thread => (
                    <div 
                      key={thread.id} 
                      onClick={() => {
                          setActiveThreadId(thread.id);
                          setCurrentView(AppView.HOME);
                      }}
                      className="group flex justify-between items-center p-4 rounded-xl bg-zinc-900 border border-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-700 cursor-pointer transition-all"
                    >
                        <div className="flex-1 min-w-0">
                            <h4 className="text-zinc-200 font-medium truncate group-hover:text-brand-400 transition-colors">{thread.title}</h4>
                            <p className="text-zinc-500 text-xs mt-1 truncate">
                                {thread.messages[thread.messages.length - 1]?.content.substring(0, 60)}...
                            </p>
                        </div>
                        <div className="ml-4 text-xs text-zinc-600 flex items-center gap-4">
                            <span>{new Date(thread.updatedAt).toLocaleDateString()}</span>
                            <button 
                               onClick={(e) => handleDeleteThread(e, thread.id)}
                               className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors">
                                Trash
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0c0c0e] text-zinc-100 font-sans selection:bg-brand-500/30">
      
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex flex-col w-64 border-r border-zinc-800 bg-[#0c0c0e] p-4 gap-2">
        <div className="flex items-center gap-3 px-2 py-3 mb-4">
             <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-blue-600 rounded-lg flex items-center justify-center">
                 <span className="font-bold text-black text-lg">K</span>
             </div>
             <span className="font-semibold text-xl tracking-tight">Kenotrix</span>
        </div>

        <button 
          onClick={() => {
              createNewThread();
              // Focus input handling could be better here, but state update triggers render
          }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-100 text-black hover:bg-zinc-300 transition-colors font-medium mb-4">
            <PlusIcon className="w-5 h-5" />
            <span>New Thread</span>
            <div className="ml-auto text-xs bg-zinc-300 px-1.5 py-0.5 rounded text-zinc-600 font-bold">Ctrl I</div>
        </button>

        <nav className="flex-1 space-y-1">
            <button 
              onClick={() => setCurrentView(AppView.HOME)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === AppView.HOME && activeThreadId === null ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}>
                <SearchIcon className="w-5 h-5" />
                Home
            </button>
            <button 
               onClick={() => setCurrentView(AppView.DISCOVER)}
               className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === AppView.DISCOVER ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}>
                <CompassIcon className="w-5 h-5" />
                Discover
            </button>
            <button 
               onClick={() => setCurrentView(AppView.LIBRARY)}
               className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === AppView.LIBRARY ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}>
                <LibraryIcon className="w-5 h-5" />
                Library
            </button>
        </nav>

        {/* Recent History in Sidebar */}
        <div className="mt-8">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-2">Recent</h3>
            <div className="space-y-0.5 overflow-y-auto max-h-[200px] scrollbar-hide">
                {threads.slice(0, 5).map(t => (
                    <button 
                      key={t.id}
                      onClick={() => {
                          setActiveThreadId(t.id);
                          setCurrentView(AppView.HOME);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-sm rounded-lg truncate transition-colors ${activeThreadId === t.id && currentView === AppView.HOME ? 'bg-zinc-800/80 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-300'}`}>
                        {t.title}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="mt-auto border-t border-zinc-800 pt-4 px-2">
            <div className="flex items-center gap-3 text-sm text-zinc-500">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                    <UserIcon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                    <span className="text-zinc-300 text-xs font-medium">Guest User</span>
                    <span className="text-[10px]">Kenotrix Basic</span>
                </div>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          
          {/* Mobile Header */}
          <header className="md:hidden h-14 border-b border-zinc-800 flex items-center justify-between px-4">
              <span className="font-bold text-lg">Kenotrix</span>
              <button 
                onClick={() => createNewThread()}
                className="text-zinc-400 hover:text-white">
                  <PlusIcon />
              </button>
          </header>

          <div className="flex-1 overflow-hidden relative">
             {currentView === AppView.HOME && renderHome()}
             {currentView === AppView.DISCOVER && renderDiscover()}
             {currentView === AppView.LIBRARY && renderLibrary()}
          </div>
          
      </main>
    </div>
  );
}