const express = require("express");
const mongoose = require("mongoose");
const customerAuth = require("../middleware/customerAuth");
const authMiddleware = require("../middleware/authMiddleware");
const ServiceProvider = require("../models/ServiceProvider");
const Customer = require("../models/Customer");
const ServiceRequest = require("../models/ServiceRequest");
const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");

const router = express.Router();

const SYSTEM_SAFETY_MESSAGE =
  "Safety notice: Do not share phone numbers, email, or off-platform contact before booking. Book through Oibre for secure support.";

const BLOCKED_CONTACT_EXAMPLES = [
  "Phone: 98XXXXXX10",
  "Email: user@example.com",
  "WhatsApp/Telegram handles"
];

const sanitizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const hasBlockedContactData = (text) => {
  const value = String(text || "");
  const emailRegex = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  const phoneCandidateRegex = /(?:\+?\d[\d\s().-]{7,}\d)/g;
  const offPlatformRegex = /(whats\s?app|telegram|call\s?me|text\s?me|contact\s?me|dm\s?me)/i;

  if (emailRegex.test(value)) return true;

  const phoneCandidates = value.match(phoneCandidateRegex) || [];
  const hasPhoneNumber = phoneCandidates.some((raw) => raw.replace(/\D/g, "").length >= 9);
  if (hasPhoneNumber) return true;

  return offPlatformRegex.test(value);
};

const toObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

const syncConversationContactUnlock = async (conversation) => {
  if (!conversation) return false;

  const hasBooking = await ServiceRequest.exists({
    customerId: conversation.customerId,
    providerId: conversation.providerId,
    status: { $ne: "cancelled" }
  });

  const shouldUnlock = Boolean(hasBooking);
  if (conversation.contactUnlocked !== shouldUnlock) {
    conversation.contactUnlocked = shouldUnlock;
    await conversation.save();
  }

  return shouldUnlock;
};

const ensureSafetySystemMessage = async (conversationId) => {
  const exists = await ChatMessage.exists({
    conversationId,
    senderType: "system",
    text: SYSTEM_SAFETY_MESSAGE
  });

  if (!exists) {
    await ChatMessage.create({
      conversationId,
      senderType: "system",
      senderId: null,
      text: SYSTEM_SAFETY_MESSAGE
    });
  }
};

const formatMessages = (rows) =>
  rows.map((item) => ({
    _id: item._id,
    senderType: item.senderType,
    senderId: item.senderId,
    text: item.text,
    createdAt: item.createdAt
  }));

const resolveConversationForCustomer = async (conversationId, customerId) => {
  return ChatConversation.findOne({ _id: conversationId, customerId });
};

const resolveConversationForProvider = async (conversationId, providerId) => {
  return ChatConversation.findOne({ _id: conversationId, providerId });
};

const countUnreadForCustomer = async (conversation) => {
  const after = conversation.customerLastReadAt || new Date(0);
  return ChatMessage.countDocuments({
    conversationId: conversation._id,
    senderType: { $in: ["provider", "system"] },
    createdAt: { $gt: after }
  });
};

const countUnreadForProvider = async (conversation) => {
  const after = conversation.providerLastReadAt || new Date(0);
  return ChatMessage.countDocuments({
    conversationId: conversation._id,
    senderType: { $in: ["customer", "system"] },
    createdAt: { $gt: after }
  });
};

// Customer starts or resumes chat with provider.
router.post("/customer/start/:providerId", customerAuth, async (req, res) => {
  try {
    const providerId = toObjectId(req.params.providerId);
    if (!providerId) {
      return res.status(400).json({ message: "Invalid provider id" });
    }

    const provider = await ServiceProvider.findById(providerId).select("name status");
    if (!provider || provider.status !== "approved") {
      return res.status(404).json({ message: "Provider not found" });
    }

    const customerId = toObjectId(req.customerId);

    let conversation = await ChatConversation.findOne({ customerId, providerId });
    if (!conversation) {
      conversation = await ChatConversation.create({
        customerId,
        providerId,
        lastMessageText: "",
        lastMessageBy: "system",
        customerLastReadAt: new Date()
      });
    }

    const contactUnlocked = await syncConversationContactUnlock(conversation);
    await ensureSafetySystemMessage(conversation._id);

    return res.json({
      conversationId: conversation._id,
      contactUnlocked
    });
  } catch (err) {
    console.error("START CHAT ERROR:", err);
    return res.status(500).json({ message: "Failed to start chat" });
  }
});

router.get("/customer/conversations", customerAuth, async (req, res) => {
  try {
    const customerId = toObjectId(req.customerId);
    const rows = await ChatConversation.find({ customerId })
      .populate("providerId", "name serviceCategory otherService profilePhoto averageRating mobile email")
      .sort({ updatedAt: -1 })
      .lean();

    const mapped = await Promise.all(
      rows.map(async (conv) => ({
        _id: conv._id,
        contactUnlocked: Boolean(conv.contactUnlocked),
        unreadCount: await countUnreadForCustomer(conv),
        updatedAt: conv.updatedAt,
        lastMessageAt: conv.lastMessageAt,
        lastMessageText: conv.lastMessageText || "",
        provider: conv.providerId
          ? {
              _id: conv.providerId._id,
              name: conv.providerId.name,
              serviceCategory: conv.providerId.serviceCategory,
              otherService: conv.providerId.otherService,
              averageRating: conv.providerId.averageRating,
              profilePhoto: conv.providerId.profilePhoto,
              contact: conv.contactUnlocked
                ? {
                    mobile: conv.providerId.mobile || "",
                    email: conv.providerId.email || ""
                  }
                : null
            }
          : null
      }))
    );

    return res.json(mapped);
  } catch (err) {
    console.error("LIST CUSTOMER CONVERSATIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

router.get("/customer/:conversationId/messages", customerAuth, async (req, res) => {
  try {
    const conversationId = toObjectId(req.params.conversationId);
    if (!conversationId) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const customerId = toObjectId(req.customerId);
    const conversation = await resolveConversationForCustomer(conversationId, customerId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const contactUnlocked = await syncConversationContactUnlock(conversation);
    conversation.customerLastReadAt = new Date();
    await conversation.save();

    const messages = await ChatMessage.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    const provider = await ServiceProvider.findById(conversation.providerId).select("name mobile email").lean();

    return res.json({
      conversationId,
      contactUnlocked,
      providerContact: contactUnlocked && provider
        ? {
            name: provider.name || "",
            mobile: provider.mobile || "",
            email: provider.email || ""
          }
        : null,
      messages: formatMessages(messages)
    });
  } catch (err) {
    console.error("GET CUSTOMER MESSAGES ERROR:", err);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

router.post("/customer/:conversationId/messages", customerAuth, async (req, res) => {
  try {
    const conversationId = toObjectId(req.params.conversationId);
    if (!conversationId) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const customerId = toObjectId(req.customerId);
    const conversation = await resolveConversationForCustomer(conversationId, customerId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const text = sanitizeText(req.body?.text);
    if (!text) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const contactUnlocked = await syncConversationContactUnlock(conversation);
    if (!contactUnlocked && hasBlockedContactData(text)) {
      return res.status(400).json({
        code: "CONTACT_SHARING_BLOCKED",
        message: "Contact sharing is blocked before booking. Use Book Service to continue securely.",
        warningExamples: BLOCKED_CONTACT_EXAMPLES
      });
    }

    const newMessage = await ChatMessage.create({
      conversationId,
      senderType: "customer",
      senderId: customerId,
      text
    });

    conversation.lastMessageText = text;
    conversation.lastMessageAt = newMessage.createdAt;
    conversation.lastMessageBy = "customer";
    conversation.customerLastReadAt = newMessage.createdAt;
    await conversation.save();

    return res.status(201).json({
      message: {
        _id: newMessage._id,
        senderType: newMessage.senderType,
        senderId: newMessage.senderId,
        text: newMessage.text,
        createdAt: newMessage.createdAt
      },
      contactUnlocked: conversation.contactUnlocked
    });
  } catch (err) {
    console.error("SEND CUSTOMER MESSAGE ERROR:", err);
    return res.status(500).json({ message: "Failed to send message" });
  }
});

router.get("/provider/conversations", authMiddleware, async (req, res) => {
  try {
    const providerId = toObjectId(req.providerId);
    const rows = await ChatConversation.find({ providerId })
      .populate("customerId", "name mobile email")
      .sort({ updatedAt: -1 })
      .lean();

    const mapped = await Promise.all(
      rows.map(async (conv) => ({
        _id: conv._id,
        contactUnlocked: Boolean(conv.contactUnlocked),
        unreadCount: await countUnreadForProvider(conv),
        updatedAt: conv.updatedAt,
        lastMessageAt: conv.lastMessageAt,
        lastMessageText: conv.lastMessageText || "",
        customer: conv.customerId
          ? {
              _id: conv.customerId._id,
              name: conv.customerId.name,
              contact: conv.contactUnlocked
                ? {
                    mobile: conv.customerId.mobile || "",
                    email: conv.customerId.email || ""
                  }
                : null
            }
          : null
      }))
    );

    return res.json(mapped);
  } catch (err) {
    console.error("LIST PROVIDER CONVERSATIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

router.get("/provider/:conversationId/messages", authMiddleware, async (req, res) => {
  try {
    const conversationId = toObjectId(req.params.conversationId);
    if (!conversationId) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const providerId = toObjectId(req.providerId);
    const conversation = await resolveConversationForProvider(conversationId, providerId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const contactUnlocked = await syncConversationContactUnlock(conversation);
    conversation.providerLastReadAt = new Date();
    await conversation.save();

    const messages = await ChatMessage.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    const customer = await Customer.findById(conversation.customerId).select("name mobile email").lean();

    return res.json({
      conversationId,
      contactUnlocked,
      customerContact: contactUnlocked && customer
        ? {
            name: customer.name || "",
            mobile: customer.mobile || "",
            email: customer.email || ""
          }
        : null,
      messages: formatMessages(messages)
    });
  } catch (err) {
    console.error("GET PROVIDER MESSAGES ERROR:", err);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

router.post("/provider/:conversationId/messages", authMiddleware, async (req, res) => {
  try {
    const conversationId = toObjectId(req.params.conversationId);
    if (!conversationId) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const providerId = toObjectId(req.providerId);
    const conversation = await resolveConversationForProvider(conversationId, providerId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const text = sanitizeText(req.body?.text);
    if (!text) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const contactUnlocked = await syncConversationContactUnlock(conversation);
    if (!contactUnlocked && hasBlockedContactData(text)) {
      return res.status(400).json({
        code: "CONTACT_SHARING_BLOCKED",
        message: "Contact sharing is blocked before booking. Ask customer to book first.",
        warningExamples: BLOCKED_CONTACT_EXAMPLES
      });
    }

    const newMessage = await ChatMessage.create({
      conversationId,
      senderType: "provider",
      senderId: providerId,
      text
    });

    conversation.lastMessageText = text;
    conversation.lastMessageAt = newMessage.createdAt;
    conversation.lastMessageBy = "provider";
    conversation.providerLastReadAt = newMessage.createdAt;
    await conversation.save();

    return res.status(201).json({
      message: {
        _id: newMessage._id,
        senderType: newMessage.senderType,
        senderId: newMessage.senderId,
        text: newMessage.text,
        createdAt: newMessage.createdAt
      },
      contactUnlocked: conversation.contactUnlocked
    });
  } catch (err) {
    console.error("SEND PROVIDER MESSAGE ERROR:", err);
    return res.status(500).json({ message: "Failed to send message" });
  }
});

module.exports = router;
