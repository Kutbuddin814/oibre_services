const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const Customer = require("../models/Customer");
const customerAuth = require("../middleware/customerAuth");

const UNREAD_RETENTION_DAYS = 30;
const READ_RETENTION_DAYS = 7;

const addDays = (date, days) => {
  const dt = new Date(date);
  dt.setDate(dt.getDate() + days);
  return dt;
};

/* =========================
   GET CUSTOMER NOTIFICATIONS
========================= */
router.get("/", customerAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customerId).select("name");
    const resolvedCustomerName = customer?.name || "";
    const unreadExpiry = addDays(new Date(), UNREAD_RETENTION_DAYS);

    if (resolvedCustomerName) {
      await Notification.updateMany(
        {
          customerId: req.customerId,
          $or: [
            { customerName: { $exists: false } },
            { customerName: null },
            { customerName: "" }
          ]
        },
        { $set: { customerName: resolvedCustomerName } }
      );
    }

    await Notification.updateMany(
      {
        customerId: req.customerId,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }]
      },
      { $set: { expiresAt: unreadExpiry } }
    );

    const notifications = await Notification.find({
      customerId: req.customerId,
    }).sort({ createdAt: -1 });

    const normalized = notifications.map((item) => ({
      ...item.toObject(),
      customerName: item.customerName || resolvedCustomerName || ""
    }));

    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

/* =========================
   MARK AS READ
========================= */
router.put("/read/:id", customerAuth, async (req, res) => {
  try {
    const readExpiry = addDays(new Date(), READ_RETENTION_DAYS);

    await Notification.findOneAndUpdate(
      { _id: req.params.id, customerId: req.customerId },
      {
      read: true,
        expiresAt: readExpiry
      }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to update notification" });
  }
});

/* =========================
   CLEAR CUSTOMER NOTIFICATIONS
========================= */
router.delete("/clear", customerAuth, async (req, res) => {
  try {
    await Notification.deleteMany({ customerId: req.customerId });
    res.json({ success: true, message: "Notifications cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear notifications" });
  }
});

module.exports = router;
