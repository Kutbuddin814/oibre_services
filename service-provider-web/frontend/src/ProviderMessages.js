import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./config/axios";
import "./ProviderStyles.css";

const formatTime = (dateValue) => {
  if (!dateValue) return "";
  try {
    return new Date(dateValue).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
};

const ProviderMessages = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [contactUnlocked, setContactUnlocked] = useState(false);
  const [customerContact, setCustomerContact] = useState(null);
  const chatEndRef = useRef(null);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c._id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const res = await api.get("/chat/provider/conversations", {
        headers: { Authorization: `Bearer ${localStorage.getItem("providerToken")}` }
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setConversations(list);
      if (!selectedConversationId && list.length > 0) {
        setSelectedConversationId(list[0]._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load conversations");
    } finally {
      setLoadingConversations(false);
    }
  }, [selectedConversationId]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      setLoadingMessages(true);
      const res = await api.get(`/chat/provider/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("providerToken")}` }
      });
      setMessages(res.data?.messages || []);
      setContactUnlocked(Boolean(res.data?.contactUnlocked));
      setCustomerContact(res.data?.customerContact || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConversationId) return;
    loadMessages(selectedConversationId);
  }, [selectedConversationId, loadMessages]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadConversations();
      if (selectedConversationId) {
        loadMessages(selectedConversationId);
      }
    }, 8000);

    return () => clearInterval(timer);
  }, [selectedConversationId, loadConversations, loadMessages]);

  const handleSend = async () => {
    if (!selectedConversationId || !String(inputText || "").trim()) return;

    const text = String(inputText || "").trim();
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      senderType: "provider",
      text,
      createdAt: new Date().toISOString()
    };

    try {
      setSending(true);
      setError("");
      setMessages((prev) => [...prev, optimistic]);
      setInputText("");
      const res = await api.post(
        `/chat/provider/${selectedConversationId}/messages`,
        { text },
        { headers: { Authorization: `Bearer ${localStorage.getItem("providerToken")}` } }
      );

      if (res.data?.message) {
        setMessages((prev) => prev.map((m) => (m._id === tempId ? res.data.message : m)));
      }
      await loadConversations();
      await loadMessages(selectedConversationId);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      setError(err.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        <div className="dashboard-header">
          <h1>Customer Messages</h1>
          <button className="action-btn secondary" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="provider-messages-layout">
          <aside className="provider-conversations-panel">
            <h3>Conversations</h3>
            {loadingConversations ? (
              <p className="provider-chat-muted">Loading...</p>
            ) : conversations.length === 0 ? (
              <p className="provider-chat-muted">No chats yet.</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv._id}
                  className={`provider-conversation-item ${selectedConversationId === conv._id ? "active" : ""}`}
                  onClick={() => setSelectedConversationId(conv._id)}
                >
                  <div className="provider-conversation-head">
                    <strong>{conv.customer?.name || "Customer"}</strong>
                    {conv.unreadCount > 0 && <span className="provider-unread-badge">{conv.unreadCount}</span>}
                  </div>
                  <span>{conv.lastMessageText || "No messages yet"}</span>
                  <small>{formatTime(conv.lastMessageAt || conv.updatedAt)}</small>
                </button>
              ))
            )}
          </aside>

          <section className="provider-chat-panel">
            {selectedConversation ? (
              <>
                <div className="provider-chat-topbar">
                  <div className="provider-chat-topbar-header">
                    <div className="provider-chat-avatar">
                      {selectedConversation.customer?.name?.charAt(0).toUpperCase() || "C"}
                    </div>
                    <div className="provider-chat-topbar-text">
                      <span className="provider-chat-topbar-label">Customer</span>
                      <h3>{selectedConversation.customer?.name || "Customer"}</h3>
                    </div>
                  </div>
                  <div>
                    {!contactUnlocked ? (
                      <p className="provider-chat-warning">Contact hidden until booking is created.</p>
                    ) : (
                      <p className="provider-chat-success">
                        Contact unlocked: {customerContact?.mobile || "-"} {customerContact?.email ? `| ${customerContact.email}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className="provider-chat-messages">
                  {loadingMessages ? (
                    <p className="provider-chat-muted">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="provider-chat-muted">No messages yet.</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg._id}
                        className={`provider-chat-bubble ${msg.senderType === "provider" ? "provider-chat-bubble-me" : msg.senderType === "system" ? "provider-chat-bubble-system" : "provider-chat-bubble-other"}`}
                      >
                        <div>{msg.text}</div>
                        <small>{formatTime(msg.createdAt)}</small>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="provider-chat-input-row">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a reply"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button className="action-btn primary" onClick={handleSend} disabled={sending}>
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </>
            ) : (
              <p className="provider-chat-muted">Select a conversation to view messages.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProviderMessages;
