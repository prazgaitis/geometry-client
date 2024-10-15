const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 3001; // Choose a port that doesn't conflict with your React app

app.use(cors());
app.use(express.json());

app.post('/api/bounding_box', async (req, res) => {
  try {
    const response = await axios.post('https://geometry-engine.fly.dev/bounding_box', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching the bounding box' });
  }
});

app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
});
