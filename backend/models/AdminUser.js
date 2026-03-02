const mongoose = require("mongoose");

const AdminUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      default: "admin"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminUser", AdminUserSchema);
