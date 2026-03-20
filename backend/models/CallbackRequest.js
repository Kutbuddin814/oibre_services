const mongoose = require('mongoose');

const CallbackRequestSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  serviceType: { type: String, required: true },
  location: { type: String, required: true },
  preferredTime: { type: String, default: 'as soon as possible' },
  status: { type: String, enum: ['pending', 'assigned', 'completed', 'cancelled'], default: 'pending' },
  assignedProviderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CallbackRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CallbackRequest', CallbackRequestSchema);
