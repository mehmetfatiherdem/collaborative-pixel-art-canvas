require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors({ // Enable CORS for all origins during development
  origin: '*' // Be more specific in production!
}));
app.use(express.json());
app.get('/', (req, res) => {
  res.send('Welcome to the Collaborative Pixel Art Canvas Backend!');
});
app.get('/health', (req, res) => {
  res.send('Server is healthy!');
});
app.get('/status', (req, res) => {
  res.send('Server is running!');
});
app.get('/info', (req, res) => {
  res.send('This is the Collaborative Pixel Art Canvas Backend!');
});
app.get('/ping', (req, res) => {
  res.send('Pong!');
});
app.get('/version', (req, res) => {
  res.send('Version 1.0.0');
});
app.get('/time', (req, res) => {
  res.send(new Date().toISOString());
});
app.get('/users', (req, res) => {
  res.send('List of users: (placeholder)');
});
app.get('/canvas', (req, res) => {
  res.send('Canvas state: (placeholder)');
});
app.get('/stats', (req, res) => {
  res.send('Server stats: (placeholder)');
});
app.get('/help', (req, res) => {
  res.send('Help: (placeholder)');
});
app.get('/about', (req, res) => {
  res.send('About: (placeholder)');
});
app.get('/contact', (req, res) => {
  res.send('Contact: (placeholder)');
});
app.get('/faq', (req, res) => {
  res.send('FAQ: (placeholder)');
});
app.get('/terms', (req, res) => {
  res.send('Terms: (placeholder)');
});
app.get('/privacy', (req, res) => {
  res.send('Privacy: (placeholder)');
});
app.get('/api', (req, res) => {
  res.send('API: (placeholder)');
});
app.get('/docs', (req, res) => {
  res.send('Docs: (placeholder)');
});
app.get('/support', (req, res) => {
  res.send('Support: (placeholder)');
});
app.get('/feedback', (req, res) => {
  res.send('Feedback: (placeholder)');
});
app.get('/report', (req, res) => {
  res.send('Report: (placeholder)');
});
app.get('/admin', (req, res) => {
  res.send('Admin: (placeholder)');
});
app.get('/settings', (req, res) => {
  res.send('Settings: (placeholder)');
});
app.get('/profile', (req, res) => {
  res.send('Profile: (placeholder)');
});
const server = http.createServer(app);
const io = socketIo(server,
  { // Socket.IO CORS configuration
    cors: {
      origin: "*", // Allow connections from any origin (adjust for production)
      methods: ["GET", "POST"]
    }
  }
);

// Replace with your actual Google Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID);

// MongoDB connection URL - replace with your actual connection string
const MONGODB_URI = process.env.MONGODB_URI;
// Add explicit TLS option AND temporary insecure flag for testing
// WARNING: tlsInsecure should NOT be used in production!
const client = new MongoClient(MONGODB_URI, { tls: true });
const DB_NAME = 'pixelArtCanvas';
const CANVAS_COLLECTION = 'canvasState';
const CANVAS_DOC_ID = 'mainCanvas';
let db;
let canvasCollection;

// In-memory rate limiting map
const lastPixelTime = new Map();

// Grid Constants
const GRID_SIZE = 32;
const DEFAULT_COLOR = '#FFFFFF';

// --- In-Memory Grid State ---
// Initialize grid state (replace with DB loading later for persistence)
let gridState = Array(GRID_SIZE).fill(0).map(() => 
  Array(GRID_SIZE).fill(DEFAULT_COLOR)
);
// --- End In-Memory Grid State ---

// Connect to MongoDB
client.connect().then(async () => {
  console.log('Connected successfully to MongoDB');
  db = client.db(DB_NAME);
  canvasCollection = db.collection(CANVAS_COLLECTION);

  // Load initial grid state from DB
  try {
    const savedState = await canvasCollection.findOne({ _id: CANVAS_DOC_ID });
    if (savedState && savedState.grid) {
      console.log('Loaded grid state from DB');
      // Optional: Validate dimensions/content if needed
      if (Array.isArray(savedState.grid) && savedState.grid.length === GRID_SIZE &&
          Array.isArray(savedState.grid[0]) && savedState.grid[0].length === GRID_SIZE) {
          gridState = savedState.grid;
      } else {
          console.warn('Loaded grid state has incorrect dimensions, using default.');
          // If dimensions mismatch, save the default one
          await canvasCollection.replaceOne(
              { _id: CANVAS_DOC_ID },
              { _id: CANVAS_DOC_ID, grid: gridState },
              { upsert: true }
          );
      }
    } else {
      console.log('No saved grid state found, initializing and saving default.');
      // Save the initial default state if not found
      await canvasCollection.insertOne({ _id: CANVAS_DOC_ID, grid: gridState });
    }
  } catch (err) {
    console.error('Error loading/saving initial grid state:', err);
    // Continue with default in-memory state if DB load fails
  }

}).catch(err => {
  console.error('MongoDB connection error:', err);
  // Handle connection error (maybe exit?)
});

// Google Sign-In verification route
app.post('/verify-token', async (req, res) => {
  const { token } = req.body;
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    // Here you would typically find or create a user record in your database
    res.json({ success: true, user: payload });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');
  socket.isAuth = false; // Flag to track authentication status
  socket.userId = null; // Store associated user ID

  // Listen for socket authentication attempt
  socket.on('authenticateSocket', async (token) => {
    console.log(`[${socket.id}] Received authenticateSocket request`);
    if (!token || !GOOGLE_CLIENT_ID) {
        console.error(`[${socket.id}] Auth failed: Missing token or GOOGLE_CLIENT_ID`);
        socket.emit('authResult', { success: false, error: 'Configuration error' });
        return;
    }
    try {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      socket.userId = payload.sub; // Google's unique ID
      socket.isAuth = true;
      console.log(`[${socket.id}] Authenticated successfully as user ${socket.userId}`);
      socket.emit('authResult', { success: true }); // Notify client of successful socket auth
    } catch (error) {
      console.error(`[${socket.id}] Socket token verification failed:`, error.message);
      socket.isAuth = false;
      socket.userId = null;
      socket.emit('authResult', { success: false, error: 'Invalid token for socket' });
    }
  });

  // Listen for request for initial grid state
  socket.on('getInitialGrid', () => {
    console.log(`Sending initial grid state to ${socket.id}`);
    socket.emit('initialGrid', gridState);
  });

  // Handle pixel placement events
  socket.on('placePixel', (data) => {
    console.log(`[${new Date().toISOString()}] Received placePixel:`, data);

    // --- Authentication Check --- 
    if (!socket.isAuth || !socket.userId) {
      console.warn(`[${new Date().toISOString()}] Unauthorized placePixel attempt from socket ${socket.id}. Ignoring.`);
      socket.emit('error', { message: 'Not authenticated. Please log in.' });
      return;
    }
    // --- End Authentication Check ---

    // Use the authenticated userId from the socket, not the potentially spoofed one from data
    const userId = socket.userId; 
    const { x, y, color } = data;

    // --- Rate Limiting Check ---
    const lastTime = lastPixelTime.get(userId) || 0;
    const now = Date.now();
    const cooldown = 100; // 100ms cooldown (allow faster updates)
    if (now - lastTime < cooldown) {
      console.log(`[${new Date().toISOString()}] Rate limit exceeded for user ${userId}. Ignoring.`);
      socket.emit('error', { message: 'Rate limit exceeded. Please wait.' });
      return;
    }
    // Update last pixel time
    lastPixelTime.set(userId, now);

    // --- Update Grid State ---
    if (y >= 0 && y < GRID_SIZE && x >= 0 && x < GRID_SIZE) {
      gridState[y][x] = color;
    } else {
      console.warn(`Invalid coordinates received: (${x}, ${y})`);
      // Optionally send an error back to the client
      return; // Don't broadcast invalid updates
    }
    // --- End Update Grid State ---

    // --- Save Updated Grid State to DB ---
    if (canvasCollection) {
      canvasCollection.updateOne(
        { _id: CANVAS_DOC_ID }, // Filter: find the specific canvas document
        { $set: { grid: gridState } }, // Update: replace the grid field
        { upsert: true } // Options: create if not found
      ).catch(err => {
          console.error('Error saving grid state to DB:', err);
      });
    } else {
        console.warn('Cannot save grid state: DB collection not available.');
    }
    // --- End Save Updated Grid State ---

    console.log(`[${new Date().toISOString()}] Broadcasting pixelUpdate:`, { x, y, color });
    // Broadcast the pixel update to all connected clients
    io.emit('pixelUpdate', { x, y, color });
    console.log(`[${new Date().toISOString()}] Broadcast complete.`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3001; // Default to 3001 if not set in .env or environment
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 