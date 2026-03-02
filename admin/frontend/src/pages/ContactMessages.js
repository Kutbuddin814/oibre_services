import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import "../styles/ContactMessages.css";

const statusOptions = ["new", "in_progress", "closed"];

const labelForStatus = (status) => {
  if (status === "in_progress") return "In Progress";
  if (status === "closed") return "Closed";
  return "New";
};

const notify = (message, type = "info") => {
  if (typeof window !== "undefined" && typeof window.__oibreToast === "function") {
    window.__oibreToast(String(message || ""), { type });
    return;
  }
  window.alert(String(message || ""));
};

export default function ContactMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.get("/admin/contact-messages", { params });
      const rows = Array.isArray(res.data) ? res.data : [];
      setMessages(rows);
      if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0]._id);
      }
    } catch (err) {
      console.error("Failed to fetch contact messages", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const statusPriority = { new: 0, in_progress: 1, closed: 2 };
    const sorted = [...messages].sort((a, b) => {
      const aPriority = statusPriority[a.status] ?? 9;
      const bPriority = statusPriority[b.status] ?? 9;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    if (!q) return sorted;
    return sorted.filter((m) =>
      [m.name, m.email, m.phone, m.subject, m.message]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [messages, search]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !filtered.some((m) => m._id === selectedId)) {
      setSelectedId(filtered[0]._id);
    }
  }, [filtered, selectedId]);

  const selectedMessage = useMemo(
    () => filtered.find((m) => m._id === selectedId) || null,
    [filtered, selectedId]
  );

  const counts = useMemo(() => {
    const data = { all: messages.length, new: 0, in_progress: 0, closed: 0 };
    for (const msg of messages) {
      const key = msg.status || "new";
      if (Object.prototype.hasOwnProperty.call(data, key)) data[key] += 1;
    }
    return data;
  }, [messages]);

  const updateStatus = async (id, status) => {
    try {
      setUpdatingId(id);
      await api.patch(`/admin/contact-messages/${id}/status`, { status });
      setMessages((prev) =>
        prev.map((item) => (item._id === id ? { ...item, status } : item))
      );
    } catch (err) {
      console.error("Failed to update status", err);
      notify("Failed to update status", "error");
    } finally {
      setUpdatingId("");
    }
  };

  const openReplyModal = (msg) => {
    const email = String(msg?.email || "").trim();
    if (!email) {
      notify("Customer email is missing for this message.", "error");
      return;
    }
    setReplyText(
      `Hi ${msg?.name || "Customer"},\n\n` +
      `Thank you for contacting Oibre. We reviewed your message regarding "${msg?.subject || "your request"}".\n\n` +
      `Regards,\nOibre Support Team`
    );
    setReplySubject(`Re: ${msg?.subject || "Your message to Oibre"}`);
    setShowReplyModal(true);
  };

  const sendReplyEmail = async () => {
    if (!selectedMessage?._id) return;
    const trimmed = String(replyText || "").trim();
    if (!trimmed) {
      notify("Please enter reply message.", "error");
      return;
    }
    const subject = String(replySubject || "").trim();
    if (!subject) {
      notify("Please enter email title/subject.", "error");
      return;
    }

    try {
      setSendingReply(true);
      await api.post(`/admin/contact-messages/${selectedMessage._id}/reply`, {
        message: trimmed,
        subject
      });
      setMessages((prev) =>
        prev.map((item) =>
          item._id === selectedMessage._id
            ? {
                ...item,
                status: "in_progress",
                lastReplySubject: subject,
                lastReplyMessage: trimmed,
                repliedAt: new Date().toISOString()
              }
            : item
        )
      );
      setShowReplyModal(false);
      setReplyText("");
      setReplySubject("");
      notify("Reply email sent. Message moved to In Progress.", "success");
    } catch (err) {
      console.error("Failed to send reply email", err);
      notify(err?.response?.data?.message || "Failed to send reply email.", "error");
    } finally {
      setSendingReply(false);
    }
  };

  const getFlowHint = (msg) => {
    if (!msg) return "";
    if (msg.status === "new") return "Start with In Progress, then send a reply and close.";
    if (msg.status === "in_progress") return "Reply to customer now, then mark Closed after resolution.";
    return "Message completed. Reopen only if customer follows up.";
  };

  return (
    <div className="contact-messages-page">
      <div className="page-header">
        <h2>Contact Messages</h2>
        <p>Customer messages submitted from the Contact form.</p>
      </div>

      <div className="cm-summary-grid">
        <div className="cm-summary-card">
          <p>Total</p>
          <h3>{counts.all}</h3>
        </div>
        <div className="cm-summary-card new">
          <p>New</p>
          <h3>{counts.new}</h3>
        </div>
        <div className="cm-summary-card in_progress">
          <p>In Progress</p>
          <h3>{counts.in_progress}</h3>
        </div>
        <div className="cm-summary-card closed">
          <p>Closed</p>
          <h3>{counts.closed}</h3>
        </div>
      </div>

      <div className="cm-controls">
        <input
          type="text"
          placeholder="Search by name, email, phone, subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="cm-search"
        />
        <select
          className="cm-filter cm-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {loading ? (
        <div className="cm-empty">Loading messages...</div>
      ) : filtered.length === 0 ? (
        <div className="cm-empty">No contact messages found.</div>
      ) : (
        <div className="cm-layout">
          <div className="cm-list-panel">
            <div className="cm-panel-head">
              <h3>Inbox</h3>
              <span>{filtered.length}</span>
            </div>
            <div className="cm-list">
              {filtered.map((msg) => (
                <button
                  key={msg._id}
                  type="button"
                  className={`cm-list-item ${selectedId === msg._id ? "active" : ""}`}
                  onClick={() => setSelectedId(msg._id)}
                >
                  <div className="cm-list-item-top">
                    <h3>{msg.subject || "No subject"}</h3>
                    <span className={`cm-status ${msg.status || "new"}`}>
                      {labelForStatus(msg.status)}
                    </span>
                  </div>
                  <p className="cm-meta">
                    {msg.name || "-"} | {msg.email || "-"}
                  </p>
                  <p className="cm-preview">{msg.message || "-"}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="cm-detail">
            {!selectedMessage ? (
              <div className="cm-empty">Select a message to view details.</div>
            ) : (
              <>
                <div className="cm-panel-head detail">
                  <h3>Conversation</h3>
                </div>
                <div className="cm-top">
                  <div>
                    <h3>{selectedMessage.subject || "No subject"}</h3>
                    <p className="cm-meta">
                      {selectedMessage.name || "-"} | {selectedMessage.email || "-"} | {selectedMessage.phone || "-"}
                    </p>
                  </div>
                  <div className="cm-status-wrap">
                    <span className={`cm-status ${selectedMessage.status || "new"}`}>
                      {labelForStatus(selectedMessage.status)}
                    </span>
                    <select
                      className="cm-status-select cm-select"
                      value={selectedMessage.status || "new"}
                      disabled={updatingId === selectedMessage._id}
                      onChange={(e) => updateStatus(selectedMessage._id, e.target.value)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {labelForStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="cm-flow-hint">{getFlowHint(selectedMessage)}</div>

                <p className="cm-message">{selectedMessage.message}</p>

                <div className="cm-actions">
                  {selectedMessage.status !== "in_progress" && (
                    <button
                      type="button"
                      className="cm-action-btn secondary"
                      disabled={updatingId === selectedMessage._id}
                      onClick={() => updateStatus(selectedMessage._id, "in_progress")}
                    >
                      Mark In Progress
                    </button>
                  )}
                  {selectedMessage.status !== "closed" && (
                    <button
                      type="button"
                      className="cm-action-btn primary"
                      disabled={updatingId === selectedMessage._id}
                      onClick={() => updateStatus(selectedMessage._id, "closed")}
                    >
                      Mark Closed
                    </button>
                  )}
                  {selectedMessage.status === "closed" && (
                    <button
                      type="button"
                      className="cm-action-btn secondary"
                      disabled={updatingId === selectedMessage._id}
                      onClick={() => updateStatus(selectedMessage._id, "in_progress")}
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    className="cm-action-btn ghost"
                    onClick={() => openReplyModal(selectedMessage)}
                  >
                    Reply by Email
                  </button>
                </div>

                {selectedMessage.lastReplyMessage ? (
                  <div className="cm-last-reply">
                    <p className="cm-last-reply-title">Last Reply Sent</p>
                    {selectedMessage.lastReplySubject ? (
                      <p className="cm-last-reply-meta">Subject: {selectedMessage.lastReplySubject}</p>
                    ) : null}
                    <p className="cm-last-reply-text">{selectedMessage.lastReplyMessage}</p>
                    <p className="cm-last-reply-meta">
                      Sent: {selectedMessage.repliedAt ? new Date(selectedMessage.repliedAt).toLocaleString() : "-"}
                    </p>
                  </div>
                ) : null}

                <p className="cm-date">
                  Submitted: {selectedMessage.createdAt ? new Date(selectedMessage.createdAt).toLocaleString() : "-"}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {showReplyModal && (
        <div className="cm-reply-modal-overlay" onClick={() => setShowReplyModal(false)}>
          <div className="cm-reply-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reply by Email</h3>
            <p className="cm-reply-meta">
              To: <strong>{selectedMessage?.email || "-"}</strong>
            </p>
            <input
              type="text"
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              placeholder="Email title/subject"
              className="cm-reply-subject"
            />
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply message..."
              className="cm-reply-textarea"
              rows={8}
            />
            <div className="cm-reply-actions">
              <button
                type="button"
                className="cm-action-btn secondary"
                onClick={() => setShowReplyModal(false)}
                disabled={sendingReply}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cm-action-btn primary"
                onClick={sendReplyEmail}
                disabled={sendingReply}
              >
                {sendingReply ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
