const express = require('express');
const mongoose = require('mongoose');
const { connect, JSONCodec } = require('nats');
const CryptoStat = require('./models/CryptoStat');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Connect to NATS and subscribe to events
async function setupNATS() {
  try {
    const nc = await connect({ servers: process.env.NATS_SERVER || 'nats://localhost:4222' });
    const jc = JSONCodec();
    
    const sub = nc.subscribe('crypto.update');
    
    for await (const m of sub) {
      const data = jc.decode(m.data);
      if (data.trigger === 'update') {
        console.log('Received update trigger, fetching crypto stats...');
        await storeCryptoStats();
      }
    }
  } catch (err) {
    console.error('NATS connection error:', err);
  }
}

// Function to store crypto stats from CoinGecko API
async function storeCryptoStats() {
  const coins = ['bitcoin', 'ethereum', 'matic-network'];
  const endpoint = `https://api.coingecko.com/api/v3/simple/price?ids=${coins.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`;
  
  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    
    for (const coinId of coins) {
      if (data[coinId]) {
        const cryptoStat = new CryptoStat({
          coin: coinId,
          price: data[coinId].usd,
          marketCap: data[coinId].usd_market_cap,
          change24h: data[coinId].usd_24h_change,
          timestamp: new Date()
        });
        
        await cryptoStat.save();
        console.log(`Saved stats for ${coinId}`);
      }
    }
  } catch (error) {
    console.error('Error fetching crypto stats:', error);
  }
}

// API Routes

// Get latest stats for a specific coin
app.get('/stats', async (req, res) => {
  try {
    const { coin } = req.query;
    
    if (!coin) {
      return res.status(400).json({ error: 'coin parameter is required' });
    }
    
    const latestStat = await CryptoStat.findOne({ coin })
      .sort({ timestamp: -1 })
      .limit(1);
    
    if (!latestStat) {
      return res.status(404).json({ error: 'No data found for the specified coin' });
    }
    
    res.json({
      price: latestStat.price,
      marketCap: latestStat.marketCap,
      '24hChange': latestStat.change24h
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get standard deviation of price for last 100 records
app.get('/deviation', async (req, res) => {
  try {
    const { coin } = req.query;
    
    if (!coin) {
      return res.status(400).json({ error: 'coin parameter is required' });
    }
    
    const records = await CryptoStat.find({ coin })
      .sort({ timestamp: -1 })
      .limit(100);
    
    if (records.length === 0) {
      return res.status(404).json({ error: 'No data found for the specified coin' });
    }
    
    // Calculate standard deviation
    const prices = records.map(record => record.price);
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const deviation = Math.sqrt(variance);
    
    res.json({
      deviation: parseFloat(deviation.toFixed(2))
    });
  } catch (error) {
    console.error('Error calculating deviation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start server and setup NATS
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
  setupNATS();
});