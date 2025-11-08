import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import toast, { Toaster } from "react-hot-toast";
import { useSupplier } from "./SupplierService";

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
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    countries: [],
    supplierTypes: [],
    minRating: 0,
    languagePercentage: 0
  });

  const [token, setToken] = useState(null);
  const [user, setUser] = useState({ username: "Guest", email: "guest@example.com" });

  const API_BASE = "http://localhost:5000";
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const selectedConversationRef = useRef(selectedConversation);

  const { supplierMode, toggleSupplierMode, searchSuppliers } = useSupplier();

  // Available options for filters
  const countryOptions = ["United States", "China", "Germany", "India", "Japan", "United Kingdom", "France", "Italy", "South Korea", "Brazil"];
  const supplierTypeOptions = ["supplier", "manufacturer", "factory", "exporter", "wholesaler", "distributor", "trader"];
  const ratingOptions = [1, 2, 3, 4, 5];
  const languagePercentageOptions = [25, 50, 75, 100];

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile && selectedConversation) setSidebarOpen(false);
  }, [selectedConversation, isMobile]);

  useEffect(() => () => typingIntervalRef.current && clearInterval(typingIntervalRef.current), []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.backgroundColor = "#141414";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.backgroundColor = "#ffffff";
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

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

  useEffect(() => {
    if (!token) return;
    const loadConversations = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/user/conversations`, {
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

  useEffect(() => {
    if (!selectedConversation || !token) return;
    const loadMessages = async () => {
      try {
        setLoading(true);
        const convId = selectedConversation._id || selectedConversation.id;
        const res = await axios.get(`${API_BASE}/user/conversations/${convId}/messages`, {
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

  const typeText = useCallback(
    (text, speed = 5) =>
      new Promise((resolve) => {
        // Clear any existing interval first
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }

        let i = 0;
        setTypingMessage(""); // Reset typing message
        
        typingIntervalRef.current = setInterval(() => {
          if (i < text.length) {
            setTypingMessage(prev => text.substring(0, i + 1));
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

  const createNewConversation = async (initialMessage = null) => {
    if (!token) return toast.error("User not authenticated.");
    try {
      const conversationTitle =
        initialMessage && initialMessage.length > 30
          ? initialMessage.substring(0, 30) + "..."
          : initialMessage || "New Chat";

      const res = await axios.post(
        `${API_BASE}/user/conversations`,
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

  const updateConversationTitle = async (conversationId, newTitle) => {
    if (!token || !conversationId) return false;
    try {
      const res = await axios.put(
        `${API_BASE}/user/conversations/${conversationId}/title`,
        { title: newTitle },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setConversations((prev) =>
          prev.map((c) => (c._id === conversationId ? { ...c, title: newTitle } : c))
        );
        setSelectedConversation((prev) =>
          prev && prev._id === conversationId ? { ...prev, title: newTitle } : prev
        );
        return true;
      }
    } catch (err) {
      console.error("❌ Failed to update title:", err);
    }
    return false;
  };

  // Filter handlers
  const handleCountryToggle = (country) => {
    setFilters(prev => ({
      ...prev,
      countries: prev.countries.includes(country)
        ? prev.countries.filter(c => c !== country)
        : [...prev.countries, country]
    }));
  };

  const handleSupplierTypeToggle = (type) => {
    setFilters(prev => ({
      ...prev,
      supplierTypes: prev.supplierTypes.includes(type)
        ? prev.supplierTypes.filter(t => t !== type)
        : [...prev.supplierTypes, type]
    }));
  };

  const handleRatingChange = (rating) => {
    setFilters(prev => ({ ...prev, minRating: rating }));
  };

  const handleLanguagePercentageChange = (percentage) => {
    setFilters(prev => ({ ...prev, languagePercentage: percentage }));
  };

  const applyFilters = () => {
    console.log("Applying filters:", filters);
    toast.success("Filters applied!");
    setFilterSidebarOpen(false);
  };

  const clearFilters = () => {
    setFilters({
      countries: [],
      supplierTypes: [],
      minRating: 0,
      languagePercentage: 0
    });
    toast.success("Filters cleared!");
  };

  // Function to render supplier table
  const renderSupplierTable = (suppliers) => {
    if (!suppliers || suppliers.length === 0) {
      return `<div class="p-4 text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}">No suppliers found</div>`;
    }

    // Take only first 10 suppliers
    const displaySuppliers = suppliers.slice(0, 10);

    return `
      <div class="overflow-x-auto mt-4">
        <table class="min-w-full border-collapse ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-lg overflow-hidden">
          <thead>
            <tr class="${darkMode ? 'bg-gray-700' : 'bg-gray-200'}">
              <th class="py-3 px-4 text-left font-semibold border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">#</th>
              <th class="py-3 px-4 text-left font-semibold border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">Company Name</th>
              <th class="py-3 px-4 text-left font-semibold border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">Country</th>
              <th class="py-3 px-4 text-left font-semibold border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">Type</th>
              <th class="py-3 px-4 text-left font-semibold border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">Rating</th>
              <th class="py-3 px-4 text-left font-semibold border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">Language Match</th>
              <th class="py-3 px-4 text-left font-semibold border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">Contact</th>
            </tr>
          </thead>
          <tbody>
            ${displaySuppliers.map((supplier, index) => `
              <tr class="${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors">
                <td class="py-2 px-4 border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">${index + 1}</td>
                <td class="py-2 px-4 border ${darkMode ? 'border-gray-600' : 'border-gray-300'} font-medium">${supplier.companyName || 'N/A'}</td>
                <td class="py-2 px-4 border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">${supplier.country || 'N/A'}</td>
                <td class="py-2 px-4 border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">
                  <span class="inline-block px-2 py-1 text-xs rounded-full ${darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}">
                    ${supplier.type || 'N/A'}
                  </span>
                </td>
                <td class="py-2 px-4 border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">
                  <div class="flex items-center">
                    <span class="text-yellow-400 mr-1">${'★'.repeat(supplier.rating || 0)}</span>
                    <span class="text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}">(${supplier.rating || 0}/5)</span>
                  </div>
                </td>
                <td class="py-2 px-4 border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">
                  <div class="w-full bg-gray-200 rounded-full h-2 ${darkMode ? 'bg-gray-600' : ''}">
                    <div class="bg-green-500 h-2 rounded-full" style="width: ${supplier.languageMatch || 0}%"></div>
                  </div>
                  <span class="text-xs mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}">${supplier.languageMatch || 0}%</span>
                </td>
                <td class="py-2 px-4 border ${darkMode ? 'border-gray-600' : 'border-gray-300'}">
                  ${supplier.contactEmail ? `
                    <a href="mailto:${supplier.contactEmail}" class="text-blue-500 hover:text-blue-700 underline text-sm">
                      Email
                    </a>
                  ` : 'N/A'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}">
          Showing ${displaySuppliers.length} of ${suppliers.length} suppliers
        </div>
      </div>
    `;
  };


  const waitForBackendResponse = async (conversationId, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Checking backend response, attempt ${attempt}`);
      
      const res = await axios.get(
        `${API_BASE}/user/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        }
      );
      
      if (res.data.success && res.data.data.messages.length > 0) {
        console.log("✅ Backend response received");
        return res.data.data.messages;
      }
      
      // Wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  throw new Error("Backend response timeout");
};

  const sendMessage = async () => {
  if (!newMessage.trim() || sending || isTyping) return;
  if (!token) return toast.error("Please login.");

  const messageToSend = newMessage.trim();
  setNewMessage("");
  setSending(true);
  setBackendLoading(true);

  let conv = selectedConversationRef.current;
  let isNewConversation = false;

  if (!conv || !conv._id) {
    const created = await createNewConversation(messageToSend);
    if (!created) {
      setSending(false);
      setBackendLoading(false);
      return;
    }
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
  
  // Add user message immediately
  setMessages((prev) => [...prev, tempUserMsg]);
  setIsTyping(true);
  setTypingMessage("");

  try {
    let assistantContent = "";

    if (supplierMode) {
      // Supplier mode logic remains the same
      const supplierResults = await searchSuppliers(messageToSend, conversationId, token, filters);
      // ... your existing supplier logic
    } else {
      console.log("💬 Sending to chat API:", messageToSend);

      // IMPROVED: Better API call with detailed logging
      try {
        const res = await axios.post(
          `${API_BASE}/user/chat`,
          { 
            conversationId, 
            message: messageToSend,
            timestamp: new Date().toISOString()
          },
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 45000 // 45 second timeout
          }
        );

        console.log("✅ Chat API Response Status:", res.status);
        console.log("✅ Response Headers:", res.headers);
        console.log("✅ Full Response Data:", res.data);

        // IMPROVED: Comprehensive response extraction
        if (res.data && typeof res.data === 'object') {
          // Try all possible response structures
          const possiblePaths = [
            'data.assistantMessage.content',
            'data.content', 
            'assistantMessage.content',
            'content',
            'message',
            'data.message',
            'response',
            'data.response'
          ];

          for (const path of possiblePaths) {
            const value = path.split('.').reduce((obj, key) => obj?.[key], res.data);
            if (value && typeof value === 'string') {
              assistantContent = value;
              console.log(`✅ Found content at path: ${path}`);
              break;
            }
          }

          // If no content found, show the raw data for debugging
          if (!assistantContent) {
            console.warn("⚠️ No content found in expected paths, using fallback");
            assistantContent = `I understand you're asking about "${messageToSend}". Here's the raw response for debugging: ${JSON.stringify(res.data)}`;
          }
        } else {
          assistantContent = "I received your message but the response format was unexpected.";
        }

      } catch (apiError) {
        console.error("❌ Chat API request failed:", apiError);
        
        // IMPROVED: Detailed error information
        if (apiError.code === 'ECONNABORTED') {
          assistantContent = "Request timeout. The backend is taking too long to respond.";
        } else if (apiError.response) {
          // Server responded with error status
          const status = apiError.response.status;
          const errorData = apiError.response.data;
          
          console.error(`❌ Server Error ${status}:`, errorData);
          
          if (status >= 500) {
            assistantContent = "Backend server error. Please try again later.";
          } else if (status === 401) {
            assistantContent = "Authentication failed. Please login again.";
          } else if (status === 404) {
            assistantContent = "Chat endpoint not found. Please check the API URL.";
          } else {
            assistantContent = `Server error: ${status} - ${errorData?.error || 'Unknown error'}`;
          }
        } else if (apiError.request) {
          // No response received
          console.error("❌ No response received from backend");
          assistantContent = "Backend is currently unavailable. Please check if the server is running and try again.";
        } else {
          // Other errors
          console.error("❌ Request setup error:", apiError.message);
          assistantContent = `Network error: ${apiError.message}`;
        }
      }
    }

    // Only proceed if we have content
    if (assistantContent) {
      // Clear any existing typing interval
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }

      // Type out the response
      await typeText(assistantContent, 3);

      // Create proper message objects
      const userMessage = {
        role: "user",
        content: messageToSend,
        _id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      };

      const assistantMessage = {
        role: "assistant",
        content: assistantContent,
        _id: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      };

      // Update messages state
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg._id !== tempUserMsg._id);
        return [...filtered, userMessage, assistantMessage];
      });

      // Update conversation
      if (isNewConversation) {
        const newTitle = messageToSend.length > 30
          ? messageToSend.substring(0, 30) + "..."
          : messageToSend;
        await updateConversationTitle(conversationId, newTitle);
      }

      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId
            ? { ...c, messageCount: (c.messageCount || 0) + 2 }
            : c
        )
      );

      toast.success(supplierMode ? "Supplier search completed!" : "Message sent!");
    }

  } catch (err) {
    console.error("❌ Fatal error in sendMessage:", err);
    
    // Remove temp message on error
    setMessages((prev) => prev.filter((msg) => msg._id !== tempUserMsg._id));
    
    toast.error("Something went wrong. Please try again.");
  } finally {
    setSending(false);
    setIsTyping(false);
    setBackendLoading(false);
    setTypingMessage("");
    
    // Ensure typing interval is cleared
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    
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
  const toggleFilterSidebar = () => setFilterSidebarOpen(!filterSidebarOpen);

  const debugState = () => {
    console.log("=== DEBUG STATE ===");
    console.log("Conversations:", conversations);
    console.log("Selected:", selectedConversation);
    console.log("Messages:", messages);
    console.log("Supplier Mode:", supplierMode);
    console.log("Filters:", filters);
    console.log("===================");
  };

  const formatContent = (content) => {
    if (!content) return "";

    // Check if content contains supplier table HTML
    if (content.includes('<table') && content.includes('supplier')) {
      return [{ type: "html", content }];
    }

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

  const formatTextWithLinks = (text) => {
    if (!text) return "";
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700 underline transition-colors">${url}</a>`;
    });
  };

  const renderContent = (content) => {
    const parts = formatContent(content);
    return parts.map((part, index) => {
      if (part.type === "code") {
        return (
          <div key={index} className={`my-3 rounded-lg overflow-hidden border ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <div className={`flex justify-between items-center px-3 py-2 text-xs ${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
              <span className="font-medium">{part.language}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(part.content);
                  toast.success("Code copied to clipboard");
                }}
                className={`px-2 py-1 rounded text-xs transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
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
      } else if (part.type === "html") {
        // Render HTML content directly (for supplier tables)
        return (
          <div
            key={index}
            className="supplier-table-container"
            dangerouslySetInnerHTML={{ __html: part.content }}
          />
        );
      } else {
        let formattedText = part.content
          .replace(/```([\s\S]*?)```/g, `<pre class="${darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'} p-3 rounded-md overflow-x-auto text-sm font-mono"><code>$1</code></pre>`)
          .replace(/^>\s?(.*)$/gm, `<div class="${darkMode ? 'border-l-4 border-gray-500 pl-3 text-gray-300 mb-1' : 'border-l-4 border-gray-400 pl-3 text-gray-700 italic mb-1'}">$1</div>`)
          .replace(/^### (.*)$/gm, `<div class="${darkMode ? 'text-gray-300' : 'text-gray-800'} text-lg font-bold mb-2">$1</div>`)
          .replace(/^## (.*)$/gm, `<div class="${darkMode ? 'text-gray-300' : 'text-gray-800'} text-md font-semibold mb-2">$1</div>`)
          .replace(/^# (.*)$/gm, `<div class="${darkMode ? 'text-gray-300' : 'text-gray-800'} text-md font-semibold mb-2">$1</div>`)
          .replace(/^\d+\.\s+(.*)$/gm, `<div class="flex gap-2 mb-1"><span class="font-semibold">•</span><span>$1</span></div>`)
          .replace(/^[\-•]\s+(.*)$/gm, `<div class="flex gap-2 mb-1"><span>•</span><span>$1</span></div>`)
          .replace(/`([^`]+)`/g, `<code class="${darkMode ? 'text-gray-100 bg-gray-800' : 'bg-gray-100 text-gray-800'} px-1 py-0.5 rounded text-sm font-mono">$1</code>`)
          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
          .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
          .replace(/\n{2,}/g, '<br/><br/>')
          .replace(/\n/g, '<br/>')
          .trim();
        
        formattedText = formatTextWithLinks(formattedText);
        
        return (
          <div
            key={index}
            className={`p-1 whitespace-pre-wrap leading-relaxed font-medium text-md md:text-md ${darkMode ? 'text-gray-200' : 'text-[#1F1F23]'}`}
            dangerouslySetInnerHTML={{ __html: formattedText }}
          />
        );
      }
    });
  };

  return (
    <div className={`flex h-screen ${darkMode ? 'dark bg-[#141414] text-white' : 'bg-white text-[#1F1F23]'} relative overflow-hidden`}>
      <Toaster 
        position="top-right" 
        toastOptions={{ 
          duration: 4000,
          style: {
            background: darkMode ? '#141414' : '#ffffff',
            color: darkMode ? '#ffffff' : '#1F1F23',
            border: darkMode ? '1px solid #333' : '1px solid #e5e7eb',
            borderRadius: '8px',
          }
        }} 
      />

      {/* Debug Component - Remove in production */}
      <div className="fixed bottom-2 left-2 bg-red-500 text-white p-2 rounded text-xs z-50">
        Debug: 
        Messages: {messages.length} | 
        Typing: {isTyping ? 'Yes' : 'No'} | 
        Sending: {sending ? 'Yes' : 'No'}
      </div>

      {/* Main Sidebar */}
      <div
        className={`flex flex-col transition-all border duration-300 fixed h-full z-40 scrollbar-hide
          ${isMobile ? (sidebarOpen ? "w-full" : "w-0 -translate-x-full") : (sidebarOpen ? "w-80" : "w-0")}
          ${darkMode ? 'bg-[#141414] border-[#212020]' : 'bg-white border-gray-200'}`}
      >
        {sidebarOpen && (
          <>
            {isMobile && (
              <div className={`p-4 flex items-center justify-between ${darkMode ? 'bg-[#141414] border-[#212020]' : 'bg-white border-gray-200'}`}>
                <h2 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}>Chat History</h2>
                <button
                  onClick={toggleSidebar}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg ${darkMode ? 'text-gray-300 hover:text-white bg-[#212020]' : 'text-gray-600 hover:text-[#1F1F23] bg-gray-100'}`}
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
            )}
            
            {!isMobile && (
              <div className={`p-4 border-b ${darkMode ? 'bg-[#141414] border-[#212020]' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${darkMode ? 'bg-[#212020]' : 'bg-gray-100'}`}>
                      <span className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}><i className="ri-gemini-fill"></i></span>
                    </div>

                    <div>
                      <p className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}>AEG Service</p>
                      <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Welcome back!</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className={`w-10 h-10 text-xl flex items-center justify-center rounded-lg cursor-pointer ${darkMode ? 'text-gray-300 hover:text-white bg-[#212020]' : 'text-gray-600 hover:text-[#1F1F23] bg-gray-100'}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <i className="ri-layout-left-line"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* New Chat Button */}
            <div className="p-4 border-gray-100 dark:border-[#212020]">
              <button
                className={`flex items-center mt-5 gap-3 mb-4 cursor-pointer text-lg rounded-lg px-4 py-3 w-full transition-all font-medium 
                  ${darkMode 
                    ? 'bg-[#212020] text-white hover:bg-gray-700' 
                    : 'bg-gray-100 text-[#1F1F23] hover:bg-gray-200'
                  }`}
                onClick={startNewChat}
                disabled={loading || sending}
              >
                <i className="ri-chat-new-line text-lg"></i>
                <span className="text-md">New chat</span>
              </button>
            </div>

            {/* Conversations History */}
            <div className={`flex-1 overflow-y-auto scrollbar-hide 
              ${darkMode ? "bg-[#141414]" : "bg-transparent"}`}>
              <div className="p-4">
                <h3 className={`font-semibold mb-4 ${darkMode ? "text-white" : "text-[#1F1F23]"}`}>
                  Recent chats
                </h3>

                {loading ? (
                  <div className="text-center mb-4 py-4">
                    <div className={`animate-spin rounded-full h-4 w-4 mx-auto border-b-2 ${darkMode ? 'border-white' : 'border-gray-100'}`}></div>
                  </div>
                ) : conversations.length > 0 ? (
                  <div className="space-y-2">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation._id}
                        className={`p-3 rounded-lg text-black cursor-pointer transition-all duration-200 ${
                          selectedConversation?._id === conversation._id
                            ? darkMode
                              ? "bg-[#212020] border-[#212020]"
                              : "bg-gray-100 border-gray-300"
                            : darkMode
                              ? "hover:bg-[#212020] text-gray-100 border-[#212020]"
                              : "hover:bg-gray-100 text-[#000] border-gray-200"
                        }`}
                        onClick={() => setSelectedConversation(conversation)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            selectedConversation?._id === conversation._id 
                              ? darkMode ? 'bg-white' : 'bg-green-700'
                              : darkMode 
                                ? 'bg-gray-500' 
                                : 'bg-gray-400'
                          }`}></div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-medium truncate text-sm md:text-base ${
                                selectedConversation?._id === conversation._id
                                  ? darkMode ? 'text-white' : 'text-black'
                                  : darkMode
                                    ? "text-white"
                                    : "text-[#000]"
                              }`}
                              title={conversation.title}
                            >
                              {conversation.title}
                            </p>
                            <p className={`text-xs mt-1 ${
                              selectedConversation?._id === conversation._id
                                ? darkMode ? 'text-gray-300' : 'text-gray-600'
                                : darkMode
                                  ? "text-gray-400"
                                  : "text-gray-600"
                            }`}>
                              {conversation.messageCount || 0} messages
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`text-center py-8 rounded-lg border ${darkMode ? "bg-[#212020] border-[#212020]" : "bg-gray-100 border-gray-300"}`}
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
            <div className="p-4 border-t border-gray-200 dark:border-[#212020]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${darkMode ? 'bg-[#212020]' : 'bg-gray-100'}`}>
                  <span className={`font-medium ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}>
                    {user.username?.charAt(0).toUpperCase() || 'G'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate text-sm md:text-base ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}>
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

      {/* Filter Sidebar */}
      <div
        className={`flex flex-col transition-all duration-300 fixed h-full z-50 scrollbar-hide right-0
          ${isMobile ? (filterSidebarOpen ? "w-full" : "w-0 translate-x-full") : (filterSidebarOpen ? "w-80" : "w-0")}
          ${darkMode ? 'bg-[#141414] border-gray-800' : 'bg-[#334443] border-gray-200'}`}
      >
        {filterSidebarOpen && (
          <>
            {/* Header */}
            <div className={`p-5 flex items-center justify-between border-b ${darkMode ? 'border-gray-800 bg-[#141414]' : 'border-gray-200 bg-[#334443]'}`}>
              <h2 className={`font-bold text-2xl ${darkMode ? 'text-white' : 'text-[#fff]'}`}>Supplier Filters</h2>
              <button
                onClick={toggleFilterSidebar}
                className={`w-10 h-10 flex items-center justify-center rounded-full cursor-pointer transition-all ${
                  darkMode
                    ? 'text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700'
                    : 'text-gray-600 hover:text-[#1F1F23] bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            {/* Filter Options */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
              
              {/* 🌍 Country Filter */}
              <div>
                <h3 className={`font-bold text-xl mb-3 ${darkMode ? 'text-white' : 'text-[#fff]'}`}>Country</h3>
                <div className="grid grid-cols-1 gap-2">
                  {countryOptions.map(country => (
                    <label
                      key={country}
                      className={`flex items-center justify-between p-2 rounded-full border cursor-pointer transition-all shadow-sm
                        ${darkMode
                          ? 'bg-[#1b1b1b] border-gray-700 hover:border-gray-500 hover:bg-[#222222]'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-400 hover:bg-gray-100'}
                      `}
                    >
                      <span className={`text-md ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{country}</span>
                      <input
                        type="checkbox"
                        checked={filters.countries.includes(country)}
                        onChange={() => handleCountryToggle(country)}
                        className="accent-blue-500 w-4 h-4"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* 🏷️ Supplier Type */}
              <div>
                <h3 className={`font-bold mb-3 text-xl ${darkMode ? 'text-white' : 'text-[#fff]'}`}>Supplier Type</h3>
                <div className="space-y-2">
                  {supplierTypeOptions.map(type => (
                    <label
                      key={type}
                      className={`flex justify-between items-center p-3 rounded-full border cursor-pointer transition-all shadow-sm
                        ${darkMode
                          ? 'bg-[#1b1b1b] border-gray-700 hover:border-gray-500 hover:bg-[#222222]'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-400 hover:bg-gray-100'}
                      `}
                    >
                      <span className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                      <input
                        type="checkbox"
                        checked={filters.supplierTypes.includes(type)}
                        onChange={() => handleSupplierTypeToggle(type)}
                        className="accent-blue-500 w-4 h-4"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* ⭐ Rating Filter */}
              <div>
                <h3 className={`font-bold text-xl mb-3 ${darkMode ? 'text-white' : 'text-[#fff]'}`}>Minimum Rating</h3>
                <div className="space-y-2">
                  {ratingOptions.map(rating => (
                    <label
                      key={rating}
                      className={`flex justify-between items-center p-3 rounded-full border cursor-pointer transition-all shadow-sm
                        ${darkMode
                          ? 'bg-[#1b1b1b] border-gray-700 hover:border-gray-500 hover:bg-[#222222]'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-400 hover:bg-gray-100'}
                      `}
                    >
                      <span className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {Array.from({ length: rating }).map((_, i) => (
                          <span key={i} className="text-yellow-400">⭐</span>
                        ))}{rating === 5 ? '' : ' & above'}
                      </span>
                      <input
                        type="radio"
                        name="rating"
                        checked={filters.minRating === rating}
                        onChange={() => handleRatingChange(rating)}
                        className="accent-blue-500 w-4 h-4"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* 🗣️ Language Match */}
              <div>
                <h3 className={`font-bold mb-3 text-xl ${darkMode ? 'text-white' : 'text-[#fff]'}`}>Language Match</h3>
                <div className="space-y-2">
                  {languagePercentageOptions.map(percentage => (
                    <label
                      key={percentage}
                      className={`flex justify-between items-center p-3 rounded-full border cursor-pointer transition-all shadow-sm
                        ${darkMode
                          ? 'bg-[#1b1b1b] border-gray-700 hover:border-gray-500 hover:bg-[#222222]'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-400 hover:bg-gray-100'}
                      `}
                    >
                      <span className={`text-sm ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        {percentage}% & above
                      </span>
                      <input
                        type="radio"
                        name="language"
                        checked={filters.languagePercentage === percentage}
                        onChange={() => handleLanguagePercentageChange(percentage)}
                        className="accent-blue-500 w-4 h-4"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className={`p-4 border-t ${darkMode ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-[#334443]'} space-y-3`}>
              <button
                onClick={applyFilters}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                  darkMode
                    ? 'bg-yellow-500 hover:bg-yellow-600  text-white shadow-md'
                    : 'bg-yellow-500 hover:bg-yellow-600 cursor-pointer text-white shadow-md'
                }`}
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className={`w-full py-2 px-4 cursor-pointer rounded-lg font-medium transition-all ${
                  darkMode
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-300'
                }`}
              >
                Clear All Filters
              </button>
            </div>
          </>
        )}
      </div>

      {/* Overlay for mobile */}
      {isMobile && (sidebarOpen || filterSidebarOpen) && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => {
            setSidebarOpen(false);
            setFilterSidebarOpen(false);
          }}
        />
      )}

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen && !isMobile ? "ml-80" : "ml-0"
          } ${filterSidebarOpen && !isMobile ? "mr-80" : "mr-0"} ${darkMode ? 'bg-[#191918]' : 'bg-white'} scrollbar-hide`}
      >
        {/* Header */}
        <div className={`px-4 md:px-6 py-5 flex items-center justify-between border-b ${darkMode ? 'border-[#212020]' : 'border-gray-200'}`}>
          <div className="flex items-center gap-4">
            {(!sidebarOpen || isMobile) && (
              <button
                className={`w-10 h-10 text-xl cursor-pointer flex items-center justify-center rounded-lg cursor-pointer transition-all  ${
                  darkMode 
                    ? 'text-gray-300 hover:text-white bg-[#212020] border-gray-700 hover:bg-gray-700' 
                    : 'text-gray-600 hover:text-[#1F1F23] bg-[#f3f5f7] border-gray-300 hover:bg-gray-100'
                }`}
                onClick={toggleSidebar}
              >
                <i className="ri-menu-line"></i>
              </button>

            )}
            <div className="flex items-center gap-2">
              <h1 className={`font-bold text-lg md:text-xl ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}>
                <span className="hidden sm:inline">AEG Service</span>
                <span className="sm:hidden">Gemini</span>
                {selectedConversation && (
                  <span className="text-sm font-normal ml-2 opacity-70 hidden md:inline">
                    - {selectedConversation.title}
                  </span>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Button - Only show in supplier mode */}
            {supplierMode && (
              <button
                onClick={toggleFilterSidebar}
                className={`flex items-center cursor-pointer gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm border ${
                  darkMode 
                    ? 'bg-[#313031]  text-white hover:bg-gray-700 border-[#313031]' 
                    : 'bg-white text-[#1F1F23] hover:bg-gray-100 border-gray-300'
                }`}
              >
                <i className="ri-filter-line"></i>
                <span className="hidden sm:inline">Filters</span>
              </button>
            )}

            {/* Supplier Mode Toggle Button */}
            <button
              onClick={toggleSupplierMode}
              className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg transition-all font-medium text-sm  ${
                supplierMode 
                  ? darkMode
                    ? 'bg-[#313031]  text-white border-[#313031]'
                    : 'bg-gray-100 text-[#1F1F23] border-gray-400'
                  : darkMode 
                    ? 'bg-[#313031] text-gray-200 hover:bg-[#313031] border-[#313031]' 
                    : 'bg-[#f3f5f7] text-gray-800  '
              }`}
            >
              <i className={`ri-${supplierMode ? 'store-2-fill' : 'store-2-line'}`}></i>
              <span className="hidden sm:inline">
                {supplierMode ? 'Supplier Mode ON' : 'Supplier Mode'}
              </span>
            </button>

            <button
              onClick={toggleDarkMode}
              className={`w-10 h-10 flex-shrink-0 rounded-lg cursor-pointer transition-all 
                flex items-center justify-center
                ${darkMode 
                  ? 'bg-[#313031] hover:bg-[#191918] text-yellow-300 border-[#212020]' 
                  : 'bg-[#f3f5f7] text-gray-800'}
              `}
            >
              {darkMode ? (
                <i className="ri-sun-line text-lg"></i>
              ) : (
                <i className="ri-moon-fill text-lg"></i>
              )}
            </button>
          </div>
        </div>

        {/* Chat Content */}
        {selectedConversation || messages.length > 0 ? (
          <>
            {/* Messages Area */}
            <div className={`flex-1 overflow-y-auto scrollbar-hide ${isMobile ? 'pb-20 mobile-messages-area' : ''}`}>
              {messages.length > 0 ? (
                <div className={`max-w-4xl mx-auto py-4 md:py-8 px-4 md:px-6 w-full ${isMobile ? 'mobile-message-container' : ''}`}>
                  {messages.map((msg) => (
                    <div
                      key={msg._id}
                      className={`mb-6 ${msg.role === "user" ? "text-right" : "text-left"}`}
                    >
                      <div
                        className={`inline-block text-start max-w-[90%] md:max-w-[90%]  py-2 px-2 rounded-xl  ${
                          msg.role === "user"
                            ? darkMode
                              ? "bg-[#313031] text-white p-2 border-gray-700"
                              : "bg-gray-100 text-[#1F1F23] border-gray-300"
                            : darkMode
                              ? " text-gray-200 border-gray-700"
                              : "bg-white text-[#1F1F23] border-gray-300"
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
                        className={`inline-block max-w-[85%] md:max-w-[80%] px-4 py-3 rounded-lg ${
                          darkMode 
                            ? "bg-gray-800 text-gray-200" 
                            : "bg-white text-[#1F1F23] "
                        }`}
                      >
                        {!typingMessage && (
                          <div className="flex space-x-1 mb-1">
                            <div
                              className={`w-2 h-2 rounded-full animate-bounce ${
                                darkMode ? "bg-gray-400" : "bg-gray-500"
                              }`}
                            ></div>
                            <div
                              className={`w-2 h-2 rounded-full animate-bounce ${
                                darkMode ? "bg-gray-400" : "bg-gray-500"
                              }`}
                              style={{ animationDelay: "0.08s" }}
                            ></div>
                            <div
                              className={`w-2 h-2 rounded-full animate-bounce ${
                                darkMode ? "bg-gray-400" : "bg-gray-500"
                              }`}
                              style={{ animationDelay: "0.16s" }}
                            ></div>
                          </div>
                        )}

                        {typingMessage && (
                          <div
                            className={`whitespace-pre-wrap leading-relaxed font-medium text-sm md:text-base ${
                              darkMode ? "text-gray-200" : "text-[#1F1F23]"
                            }`}
                          >
                            {typingMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                  <div className="text-center max-w-2xl px-4">
                    <div className={`w-16 h-16 md:w-24 md:h-24 rounded-lg mx-auto mb-6 md:mb-8 flex items-center justify-center ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                      <span className={`text-xl md:text-3xl font-bold ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}> <i className="ri-gemini-fill"></i> </span>
                    </div>
                    <h1 className={`text-2xl md:text-5xl font-bold mb-4 md:mb-1 ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}>
                      {isMobile ? "Gemini AI" : "AEG Service AI."}
                    </h1>
                    <p className={`text-lg md:text-xl mb-8 md:mb-12 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {isMobile ? "Your AI assistant" : "Let's create something amazing together!"}
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={`${isMobile ? 'fixed bottom-0 left-0 right-0 bg-white dark:bg-[#141414] border-t border-gray-200 dark:border-gray-800 p-4 z-50' : 'p-6 md:p-8'}`}>
              <div className="max-w-4xl mx-auto">
                <div
                  className={`flex items-center border rounded-full px-4 py-2 md:px-6 md:py-3 transition-all ${
                    darkMode ? 'border-[#212020]' : 'border-gray-500'
                  }`}
                >
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={
                      supplierMode
                        ? 'Search for suppliers, manufacturers, contractors...'
                        : 'Ask Anything...'
                    }
                    className={`flex-1 resize-none border-none outline-none overflow-hidden bg-transparent text-base md:text-lg
                      ${darkMode ? 'text-white placeholder-gray-400' : 'text-[#1F1F23] placeholder-gray-500'}`}
                    rows={1}
                    onKeyDown={handleKeyDown}
                    disabled={sending || isTyping}
                  />

                  {/* Send Icon Always Visible */}
                  <button
                    onClick={sendMessage}
                    disabled={sending || isTyping || !newMessage.trim()}
                    className={`ml-3 p-2 md:p-1 rounded-full ransition-all  flex items-center justify-center ${
                      darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600'
                        : 'bg-yellow-400 hover:bg-gray-200 text-[#1F1F23] border-gray-300'
                    } ${sending || isTyping ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 md:h-6 md:w-6"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                {!isMobile && (
                  <p
                    className={`text-xs text-center mt-4 ${
                      darkMode ? 'text-gray-500' : 'text-gray-600'
                    }`}
                  >
                    {supplierMode
                      ? 'Searching for suppliers, manufacturers, and contractors...'
                      : 'Google Terms and the Google Privacy Policy apply. Gemini can make mistakes, so double-check it.'}
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          // Empty State
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 scrollbar-hide">
            <div className="max-w-2xl w-full">
              <div className={`w-16 h-16 md:w-24 md:h-24 rounded-full mx-auto mb-6 md:mb-8 flex items-center justify-center ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <span className={`text-xl md:text-3xl font-bold ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}>G</span>
              </div>
              <h1 className={`text-2xl md:text-5xl font-bold  ${darkMode ? 'text-white' : 'text-[#1F1F23]'}`}>
                AEG Service AI,
              </h1>
              <p className={`text-md md:text-xl mb-8 md:mb-12 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                your personal AI assistant
              </p>

              {/* Centered Input Area */}
              <div className="max-w-8xl mx-auto  mb-4">
                <div className={`flex items-center border rounded-full px-4 py-3 md:px-6 md:py-4 transition-all ${
                  darkMode ? 'border-[#212121] border-2' : 'border-gray-300 bg-white'
                }`}>
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={supplierMode ? "Search for suppliers, manufacturers, contractors..." : "Ask Anything......."}
                    className={`flex-1 resize-none border-none outline-none overflow-hidden bg-transparent text-base md:text-lg
                      ${darkMode ? 'text-white placeholder-gray-400' : 'text-[#1F1F23] placeholder-gray-500'}`}
                    rows={1}
                    onKeyDown={handleKeyDown}
                    disabled={sending || isTyping}
                  />
                  {newMessage.trim() && (
                    <button
                      onClick={sendMessage}
                      disabled={sending || isTyping || !newMessage.trim()}
                      className={`ml-3 p-3 rounded-lg transition-all border ${darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600'
                        : 'bg-gray-100 hover:bg-gray-200 text-[#1F1F23] border-gray-300'
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
                {supplierMode 
                  ? "Searching for suppliers, manufacturers, and contractors..." 
                  : "Google Terms and the Google Privacy Policy apply. Gemini can make mistakes, so double-check it."
                }
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        @keyframes fadeInFast {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        .typing-char {
          animation: fadeInFast 0.01s ease-in forwards;
        }
        
        @media (max-width: 767px) {
          .mobile-messages-area {
            padding-bottom: 120px;
          }
          
          .mobile-message-container {
            max-width: 100% !important;
            width: 100% !important;
            padding-left: 8px;
            padding-right: 8px;
          }
        }
      `}</style>
    </div>
  );
}