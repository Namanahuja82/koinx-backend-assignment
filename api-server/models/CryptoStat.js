const mongoose = require('mongoose');

const cryptoStatSchema = new mongoose.Schema({
  coin: {
    type: String,
    required: true,
    enum: ['bitcoin', 'ethereum', 'matic-network']
  },
  price: {
    type: Number,
    required: true
  },
  marketCap: {
    type: Number,
    required: true
  },
  change24h: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
});

// Index for better query performance
cryptoStatSchema.index({ coin: 1, timestamp: -1 });

module.exports = mongoose.model('CryptoStat', cryptoStatSchema);