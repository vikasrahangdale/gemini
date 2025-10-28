import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import toast, { Toaster } from "react-hot-toast";

export default function Chat() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [typingMessage, setTypingMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [token, setToken] = useState(null);
  const [user, setUser] = useState({ username: "Guest", email: "guest@example.com" });

  const API_BASE = "http://localhost:5000/user";
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const selectedConversationRef = useRef(selectedConversation);

  // ✅ Keep ref synced
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // ✅ Detect Mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ✅ Auto-close sidebar on mobile
  useEffect(() => {
    if (isMobile && selectedConversation) setSidebarOpen(false);
  }, [selectedConversation, isMobile]);

  // ✅ Cleanup typing interval
  useEffect(() => () => typingIntervalRef.current && clearInterval(typingIntervalRef.current), []);

  // ✅ Dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.backgroundColor = "#1f2937";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.backgroundColor = "#ffffff";
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  // ✅ Scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, []);

  // ✅ Textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  // ✅ Load token/user
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");
    const savedEmail = localStorage.getItem("email");
    if (savedToken) setToken(savedToken);
    setUser({
      username: savedUsername || "Guest",
      email: savedEmail || "guest@example.com",
    });
  }, []);

  // ✅ Load conversations
  useEffect(() => {
    if (!token) return;
    const loadConversations = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/conversations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data;
        if (data.success) {
          const normalized = data.data.conversations.map((c) => ({
            ...c,
            _id: c._id || c.id,
            title: c.title || "New Chat",
            messageCount: c.messageCount || 0,
          }));
          setConversations(normalized);
          if (normalized.length > 0 && !selectedConversation) {
            setSelectedConversation(normalized[0]);
          }
        } else {
          toast.error(data.error || "Failed to load conversations");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load conversations");
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [token]);

  // ✅ Load messages
  useEffect(() => {
    if (!selectedConversation || !token) return;
    const loadMessages = async () => {
      try {
        setLoading(true);
        const convId = selectedConversation._id || selectedConversation.id;
        const res = await axios.get(`${API_BASE}/conversations/${convId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.data;
        if (data.success) {
          setMessages(data.data.messages || []);
        } else toast.error(data.error || "Failed to load messages");
      } catch (err) {
        console.error(err);
        toast.error("Failed to load messages");
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    };
    loadMessages();
  }, [selectedConversation, token, scrollToBottom]);

  // ✅ Typing animation
  const typeText = useCallback(
    (text, speed = 20) =>
      new Promise((resolve) => {
        let i = 0;
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = setInterval(() => {
          if (i < text.length) {
            setTypingMessage(text.substring(0, i + 1));
            i++;
            scrollToBottom();
          } else {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
            resolve();
          }
        }, speed);
      }),
    [scrollToBottom]
  );

  // ✅ Create new conversation
  const createNewConversation = async (initialMessage = null) => {
    if (!token) return toast.error("User not authenticated.");
    try {
      const conversationTitle =
        initialMessage && initialMessage.length > 30
          ? initialMessage.substring(0, 30) + "..."
          : initialMessage || "New Chat";

      const res = await axios.post(
        `${API_BASE}/conversations`,
        { initialMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        const raw = res.data.data.conversation;
        const newConv = {
          ...raw,
          _id: raw._id || raw.id,
          title: raw.title || conversationTitle,
          messageCount: raw.messageCount || (initialMessage ? 1 : 0),
          createdAt: raw.createdAt || new Date().toISOString(),
        };
        setConversations((prev) => [newConv, ...prev]);
        setSelectedConversation(newConv);
        if (!initialMessage) setMessages([]);
        toast.success("New chat created");
        return newConv;
      } else {
        toast.error(res.data.error || "Failed to create conversation");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to create conversation");
    }
  };

  // ✅ Update title in backend + frontend (FIXED)
  const updateConversationTitle = async (conversationId, newTitle) => {
    if (!token || !conversationId) return false;
    try {
      const res = await axios.put(
        `${API_BASE}/conversations/${conversationId}/title`,
        { title: newTitle },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        // ✅ Instant frontend sync (Fix)
        setConversations((prev) =>
          prev.map((c) => (c._id === conversationId ? { ...c, title: newTitle } : c))
        );
        setSelectedConversation((prev) =>
          prev && prev._id === conversationId ? { ...prev, title: newTitle } : prev
        );
        console.log("✅ Title updated locally and in backend:", newTitle);
        return true;
      }
    } catch (err) {
      console.error("❌ Failed to update title:", err);
    }
    return false;
  };

  // ✅ Send message (includes instant title sync fix)
  const sendMessage = async () => {
    if (!newMessage.trim() || sending || isTyping) return;
    if (!token) return toast.error("Please login.");

    const messageToSend = newMessage.trim();
    setNewMessage("");
    setSending(true);

    let conv = selectedConversationRef.current;
    let isNewConversation = false;

    if (!conv || !conv._id) {
      const created = await createNewConversation(messageToSend);
      if (!created) return setSending(false);
      conv = created;
      isNewConversation = true;
    }

    const conversationId = conv._id || conv.id;

    const tempUserMsg = {
      role: "user",
      content: messageToSend,
      _id: `temp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsTyping(true);
    setTypingMessage("");

    try {
      const res = await axios.post(
        `${API_BASE}/chat`,
        { conversationId, message: messageToSend },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = res.data;
      if (data.success) {
        const { userMessage, assistantMessage } = data.data;
        await typeText(assistantMessage.content);

        setMessages((prev) =>
          prev
            .filter((msg) => msg._id !== tempUserMsg._id)
            .concat([
              { ...userMessage, _id: userMessage.id || userMessage._id },
              { ...assistantMessage, _id: assistantMessage.id || assistantMessage._id },
            ])
        );

        const needsTitleUpdate =
          isNewConversation ||
          !conv.title ||
          ["New Chat", "Untitled", "New Conversation"].includes(conv.title);

        if (needsTitleUpdate) {
          const newTitle =
            messageToSend.length > 30
              ? messageToSend.substring(0, 30) + "..."
              : messageToSend;

          const titleUpdated = await updateConversationTitle(conversationId, newTitle);
          if (titleUpdated) {
            console.log("🎉 Title updated instantly:", newTitle);
          }
        }

        setConversations((prev) =>
          prev.map((c) =>
            c._id === conversationId
              ? { ...c, messageCount: (c.messageCount || 0) + 2 }
              : c
          )
        );
      } else throw new Error(data.error || "Failed to send message");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send message");
      setMessages((prev) => prev.filter((m) => m._id !== tempUserMsg._id));
    } finally {
      setSending(false);
      setIsTyping(false);
      setTypingMessage("");
      typingIntervalRef.current && clearInterval(typingIntervalRef.current);
      scrollToBottom();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = async () => {
    setSelectedConversation(null);
    setMessages([]);
    setNewMessage("");
    await createNewConversation();
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const debugState = () => {
    console.log("=== DEBUG STATE ===");
    console.log("Conversations:", conversations);
    console.log("Selected:", selectedConversation);
    console.log("Messages:", messages);
    console.log("===================");
  };


  const formatContent = (content) => {
    if (!content) return "";

    const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
      }

      const language = match[1] || "text";
      const code = match[2].trim();
      parts.push({ type: "code", language, content: code });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push({ type: "text", content: content.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: "text", content }];
  };

  const renderContent = (content) => {
    const parts = formatContent(content);

    return parts.map((part, index) => {
      if (part.type === "code") {
        return (
          <div key={index} className={`my-3 rounded-lg overflow-hidden border ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <div className={`flex justify-between items-center px-3 py-2 text-xs ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'}`}>
              <span className="font-medium">{part.language}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(part.content);
                  toast.success("Code copied to clipboard");
                }}
                className={`px-2 py-1 rounded text-xs transition-colors ${darkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'}`}
              >
                Copy Code
              </button>
            </div>
            <SyntaxHighlighter
              language={part.language}
              style={darkMode ? oneDark : oneLight}
              customStyle={{ 
                margin: 0, 
                borderRadius: 0, 
                fontSize: "0.75rem",
                padding: "12px"
              }}
              wrapLongLines
            >
              {part.content}
            </SyntaxHighlighter>
          </div>
        );
      } else {
        let formattedText = part.content
   .replace(/```([\s\S]*?)```/g, `<pre class="${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'} p-3 rounded-md overflow-x-auto text-sm font-mono"><code>$1</code></pre>`)

  .replace(/^>\s?(.*)$/gm, `<div class="${darkMode ? 'border-l-4 border-blue-400 pl-3 text-gray-300 mb-1' : 'border-l-4 border-blue-600 pl-3 text-gray-700 italic mb-1'}">$1</div>`)

  .replace(/^### (.*)$/gm, `<div class="${darkMode ? 'text-gray-300' : 'text-blue-800'} text-lg font-bold mb-2">$1</div>`)
  .replace(/^## (.*)$/gm, `<div class="${darkMode ? 'text-blue-200' : 'text-blue-700'} text-md font-semibold mb-2">$1</div>`)
  .replace(/^# (.*)$/gm, `<div class="${darkMode ? 'text-blue-100' : 'text-blue-600'} text-md font-semibold mb-2">$1</div>`)
  .replace(/^\d+\.\s+(.*)$/gm, `<div class="flex gap-2 mb-1"><span class="font-semibold">•</span><span>$1</span></div>`)
  .replace(/^[\-•]\s+(.*)$/gm, `<div class="flex gap-2 mb-1"><span>•</span><span>$1</span></div>`)

  .replace(/`([^`]+)`/g, `<code class="${darkMode ? 'text-gray-100 bg-gray-800' : 'bg-gray-100 text-red-600'} px-1 py-0.5 rounded text-sm font-mono">$1</code>`)

  .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
  .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

  .replace(/\n{2,}/g, '<br/><br/>')
  .replace(/\n/g, '<br/>')
  .trim();
        return (
          <div
            key={index}
            className={`p-1 whitespace-pre-wrap leading-relaxed font-medium text-md md:text-md   ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}
            dangerouslySetInnerHTML={{ __html: formattedText }}
          />
        );
      }
    });
  };

  return (
   <div className={`flex h-screen ${darkMode ? 'dark bg-[#1a1c1c] text-white' : 'bg-white text-gray-900'} relative overflow-hidden`}>
  <Toaster position="top-right" toastOptions={{ duration: 4000 }} />

  <style jsx>{`
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    
    /* Mobile optimizations */
    @media (max-width: 767px) {
      .mobile-input-fixed {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: ${darkMode ? '#1a1c1c' : 'white'};
        padding: 12px 16px;
        border-top: 1px solid ${darkMode ? '#374151' : '#e5e7eb'};
        z-index: 50;
      }
      
      .mobile-messages-area {
        padding-bottom: 80px;
              }
      
      /* Fix for message overflow on mobile */
      .mobile-message-container {
        max-width: 100% !important;
        width: 99% !important;
      
      }
      
      .mobile-user-message {
        max-width: 60% !important;
       margin-right:60px
      }
      
      .mobile-assistant-message {
        max-width: 80% !important;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }
    }
  `}</style>

  {/* Sidebar - Mobile Overlay */}
  <div
    className={`flex flex-col transition-all duration-300 fixed h-full z-40 scrollbar-hide
      ${isMobile ? (sidebarOpen ? "w-full" : "w-0 -translate-x-full") : (sidebarOpen ? "w-80" : "w-0")}
      ${darkMode ? 'bg-[#292a2d] border-gray-700' : 'bg-[#f0f5f8] border-gray-200'}`}
  >
    {sidebarOpen && (
      <>
        {/* Mobile Header */}
        {isMobile && (
          <div className={`p-4 flex items-center justify-between ${darkMode ? 'bg-[#292a2d] border-gray-700' : 'bg-[#f0f5f8] border-gray-200'}`}>
            <h2 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-900'}`}>Chat History</h2>
            <button
              onClick={toggleSidebar}
              className={`w-10 h-10 flex items-center justify-center rounded-full ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        )}
        
        {/* Header - Desktop */}
        {!isMobile && (
          <div className={`p-4 ${darkMode ? 'bg-[#292a2d] border-gray-700' : 'bg-[#f0f5f8] border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-md"><i className="ri-gemini-fill"></i></span>
                </div>

                <div>
                  <p className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-gray-900'}`}>Gemini</p>
                  <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Welcome back!</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className={`w-10 h-10 text-2xl flex items-center justify-center rounded-full cursor-pointer ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <i className="ri-layout-left-line"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Chat Button */}
        <div className="p-4 border-gray-50 dark:border-gray-700">
          <button
            className={`flex mb-[-15px] ml-1 cursor-pointer text-xl gap-2 rounded-lg px-1 py-3 w-full transition-colors font-medium
              ${darkMode ? 'text-white hover:text-gray-300' : 'text-gray-900 hover:text-gray-700'}`}
            onClick={startNewChat}
            disabled={loading || sending}
          >
            <span className={`text-md ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}><i className="ri-chat-new-line"></i></span>
            <span className={`text-md ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>New chat</span>
          </button>
          
          {/* Debug button - remove in production */}
          <button 
            onClick={debugState}
            className="text-xs text-gray-500 mt-2"
          >
            Debug State
          </button>
        </div>

        {/* Conversations History */}
        <div className={`flex-1 overflow-y-auto scrollbar-hide 
          ${darkMode ? "bg-[#292a2d]" : "bg-[#f0f5f8]"}`}>
          <div className="p-2 ml-2 text-md">
            <h3 className={`font-semibold ml-2 mb-4 ${darkMode ? "text-white" : "text-gray-900"}`}>
              Recent chats
            </h3>

            {loading ? (
              <div className="text-center mb-4 py-4">
                <div className={`animate-spin rounded-full h-4 w-4 mx-auto border-b-2 ${darkMode ? 'border-white' : 'border-gray-900'}`}></div>
              </div>
            ) : conversations.length > 0 ? (
              <div className="space-y-2">
                {conversations.map((conversation) => (
                  <div
                    key={conversation._id}
                    className={`p-2 rounded-lg cursor-pointer transition-colors ${selectedConversation?._id === conversation._id
                      ? darkMode
                        ? "bg-gray-700"
                        : "bg-white"
                      : darkMode
                        ? "hover:bg-gray-700"
                        : "hover:bg-gray-100"
                      }`}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <div className="flex px-2 items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-medium truncate text-sm md:text-base ${darkMode ? "text-white" : "text-gray-700"}`}
                          title={conversation.title}
                        >
                          {/* ✅ Title from MongoDB */}
                          {conversation.title}
                        </p>
                        
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className={`text-center py-8 rounded-lg ${darkMode ? "bg-gray-700" : "bg-gray-50"}`}
              >
                <p
                  className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}
                >
                  No conversations yet. Start a new chat!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {user.username?.charAt(0).toUpperCase() || 'G'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate text-sm md:text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {user.username}
              </p>
              <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </>
    )}
  </div>

  {/* Mobile Sidebar Overlay */}
  {isMobile && sidebarOpen && (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-30"
      onClick={() => setSidebarOpen(false)}
    />
  )}

  <div
    className={`flex-1 flex flex-col transition-all duration-300 scrollbar-hide ${sidebarOpen && !isMobile ? "ml-80" : "ml-0"
      } ${darkMode ? 'bg-[#1a1c1c]' : 'bg-white'}`}
  >
    <div className={`px-4 md:px-6 py-4 flex items-center justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="flex items-center gap-4">
        {(!sidebarOpen || isMobile) && (
          <button
            className={`w-10 h-10 text-xl flex items-center justify-center rounded-lg cursor-pointer ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            onClick={toggleSidebar}
          >
            <i className="ri-menu-line"></i>
          </button>
        )}
        <div className="flex items-center gap-2">
          <h1 className={`font-bold text-lg md:text-xl ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            <span className="hidden sm:inline">Gemini 2.5 Flash</span>
            <span className="sm:hidden">Gemini</span>
            {selectedConversation && (
              <span className="text-sm font-normal ml-2 opacity-70 hidden md:inline">
                - {selectedConversation.title}
              </span>
            )}
          </h1>
        </div>
      </div>

    <button
  onClick={toggleDarkMode}
  className={`w-[2.5rem] mr-10 h-[2.5rem] sm:w-10 sm:h-12 md:w-12 md:h-12 flex-shrink-0 rounded-full cursor-pointer transition-colors 
    flex items-center justify-center
    ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}
  `}
>
  {darkMode ? (
    <i className="ri-sun-line text-lg"></i>
  ) : (
    <i className="ri-moon-fill text-lg"></i>
  )}
</button>

    </div>

    {/* Chat Content */}
    {selectedConversation || messages.length > 0 ? (
      <>
        {/* Messages Area - Fixed for mobile */}
        <div className={`flex-1 overflow-y-auto scrollbar-hide mobile-messages-area ${isMobile ? 'pb-4' : ''}`}>
          {messages.length > 0 ? (
            <div className="max-w-5xl mx-auto py-4 md:py-8 px-3 md:px-4 w-full mobile-message-container">
              {messages.map((msg) => (
                <div
                  key={msg._id}
                  className={`mb-6 ${msg.role === "user" ? "text-right" : "text-left"}`}
                >
                  <div
                    className={`inline-block text-start px-1  py-1 md:px-2 md:py-2 rounded-2xl ${
                      msg.role === "user"
                        ? `${
                            darkMode
                              ? "bg-[#323536] text-white rounded-br-none"
                              : "bg-[#e9eef6] text-gray-800 rounded-br-none"
                          } ${isMobile ? "mobile-user-message" : "max-w-[80%]  "}`
                        : `${
                            darkMode
                              ? "bg-transparent text-white rounded-bl-none"
                              : "bg-transparent text-gray-800 rounded-bl-none"
                          } ${isMobile ? "mobile-assistant-message" : "max-w-[80%]"}`
                    }`}
                  >
                    {renderContent(msg.content)}
                  </div>
                </div>
              ))}

              {/* Typing Animation */}
  {isTyping && (
  <div className="text-left mb-6">
    <div
      className={`inline-block px-4 py-3 md:px-6 md:py-4 rounded-2xl rounded-bl-none transition-all duration-300 ${
        darkMode ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900"
      } ${isMobile ? "mobile-assistant-message" : "max-w-[80%]"}`}
    >
      {/* Typing dots (visible before text starts) */}
      {!typingMessage && (
        <div className="flex space-x-1 mb-1">
          <div
            className={`w-2 h-2 rounded-full animate-bounce ${
              darkMode ? "bg-gray-400" : "bg-gray-600"
            }`}
          ></div>
          <div
            className={`w-2 h-2 rounded-full animate-bounce ${
              darkMode ? "bg-gray-400" : "bg-gray-600"
            }`}
            style={{ animationDelay: "0.08s" }}
          ></div>
          <div
            className={`w-2 h-2 rounded-full animate-bounce ${
              darkMode ? "bg-gray-400" : "bg-gray-600"
            }`}
            style={{ animationDelay: "0.16s" }}
          ></div>
        </div>
      )}

      {/* Smooth & Fast Typing Text */}
      {typingMessage && (
        <div
          className={`mt-2 whitespace-pre-wrap leading-relaxed font-medium text-sm md:text-base ${
            darkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {typingMessage.split("").map((char, index) => (
            <span
              key={index}
              className="inline-block opacity-0 animate-[fadeInFast_0.01s_ease-in_forwards]"
              style={{ animationDelay: `${index * 0.005}s` }}  // ⏩ FAST speed here
            >
              {char}
            </span>
          ))}
        </div>
      )}
    </div>
  </div>
)}


            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
              <div className="text-center max-w-2xl px-4">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto mb-6 md:mb-8 flex items-center justify-center">
                  <span className="text-white text-xl md:text-3xl font-bold"><i className="ri-gemini-fill"></i></span>
                </div>
                <h1 className={`text-2xl md:text-5xl font-semibold mb-4 md:mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {isMobile ? "Gemini AI" : "AI assistant."}
                </h1>
                <p className={`text-lg md:text-2xl mb-8 md:mb-12 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {isMobile ? "Your AI assistant" : "Let's create something amazing together!"}
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Fixed on Mobile */}
        <div className={`${isMobile ? 'mobile-input-fixed' : 'p-6 md:p-8'}`}>
          <div className="max-w-4xl mx-auto">
            <div className={`flex items-center border rounded-full px-4 py-3 md:px-6 md:py-4 ${darkMode ? 'border-gray-700 bg-[#1B1C1D]' : 'border-gray-300 bg-white'
              }`}>
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Ask Gemini..."
                className={`flex-1 resize-none border-none outline-none overflow-hidden bg-transparent text-base md:text-lg
                  ${darkMode ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}`}
                rows={1}
                onKeyDown={handleKeyDown}
                disabled={sending || isTyping}
              />

              {newMessage.trim() && (
                <button
                  onClick={sendMessage}
                  disabled={sending || isTyping || !newMessage.trim()}
                  className={`ml-3 p-3 md:p-4 rounded-full transition-colors ${darkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                    } ${(sending || isTyping || !newMessage.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
            {!isMobile && (
              <p className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                Google Terms and the Google Privacy Policy apply. Gemini can make mistakes, so double-check it.
              </p>
            )}
          </div>
        </div>
      </>
    ) : (
      // Empty State
      <div className="flex-1 flex flex-col items-center justify-center text-center scrollbar-hide px-4">
        <div className="max-w-2xl w-full">
          <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto mb-6 md:mb-8 flex items-center justify-center">
            <span className="text-white text-xl md:text-3xl font-bold">G</span>
          </div>
          <h1 className={`text-2xl md:text-5xl font-normal mb-4 md:mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Meet Gemini,
          </h1>
          <p className={`text-lg md:text-2xl mb-8 md:mb-12 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            your personal AI assistant
          </p>

          {/* Centered Input Area */}
          <div className="max-w-4xl mx-auto mb-6 md:mb-8">
            <div className={`flex items-center border rounded-full px-4 py-3 md:px-6 md:py-4 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-white'
              }`}>
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Ask Gemini..."
                className={`flex-1 resize-none border-none outline-none overflow-hidden bg-transparent text-base md:text-lg
                  ${darkMode ? 'text-white placeholder-gray-400' : 'text-gray-900 placeholder-gray-500'}`}
                rows={1}
                onKeyDown={handleKeyDown}
                disabled={sending || isTyping}
              />
              {newMessage.trim() && (
                <button
                  onClick={sendMessage}
                  disabled={sending || isTyping || !newMessage.trim()}
                  className={`ml-3 p-3 rounded-full transition-colors ${darkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                    } ${(sending || isTyping) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <p className={`text-xs md:text-sm ${darkMode ? 'text-gray-500' : 'text-gray-600'} mb-6 md:mb-8`}>
            Google Terms and the Google Privacy Policy apply. Gemini can make mistakes, so double-check it.
          </p>
        </div>
      </div>
    )}
  </div>
</div>
  );
}