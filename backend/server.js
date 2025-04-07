require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { OAuth2Client } = require('google-auth-library');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors({ // Explicitly allow the frontend origin
  origin: 'http://localhost:5173' // Frontend runs on port 5173
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
const PORT = process.env.PORT || 3000; // Use port 3000
const io = socketIo(server,
  { // Socket.IO CORS configuration
    cors: {
      origin: "http://localhost:5173", // Explicitly allow the frontend origin
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

// Cooldown configuration (e.g., 2 seconds)
const PIXEL_PLACEMENT_COOLDOWN_MS = 2 * 1000; 
// Map to store the timestamp of the last pixel placement for each user ID
const userCooldowns = new Map(); 

// In-memory rate limiting map
const lastPixelTime = new Map();

// Grid Constants
const GRID_SIZE = 64;
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
  console.log('New client connected:', socket.id);
  socket.isAuth = false; // Flag to track authentication status
  socket.userId = null; // Store associated user ID (e.g., Google sub)

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

  // Handle pixel placement requests
  socket.on('placePixel', async (data) => {
    if (!socket.isAuth || !socket.userId) {
      console.warn(`[${socket.id}] Denied placePixel: Socket not authenticated.`);
      socket.emit('error', 'Authentication required to place pixels.');
      return;
    }

    const { x, y, color } = data;
    const userId = socket.userId;
    const now = Date.now();

    // --- Cooldown Check ---
    const lastPlacementTime = userCooldowns.get(userId);
    if (lastPlacementTime && (now - lastPlacementTime < PIXEL_PLACEMENT_COOLDOWN_MS)) {
      const remainingTime = Math.ceil((PIXEL_PLACEMENT_COOLDOWN_MS - (now - lastPlacementTime)) / 1000);
      console.log(`[${socket.id}] User ${userId} cooldown active. ${remainingTime}s remaining.`);
      socket.emit('error', `Please wait ${remainingTime} seconds before placing another pixel.`);
      return;
    }
    // --- End Cooldown Check ---

    // Validate coordinates and color format (basic)
    if (typeof x !== 'number' || typeof y !== 'number' || typeof color !== 'string' ||
        x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE || !/^#[0-9A-F]{6}$/i.test(color))
    { 
      console.warn(`[${socket.id}] Invalid placePixel data:`, data);
      socket.emit('error', 'Invalid pixel data or coordinates.');
      return;
    }

    try {
      // Update the specific pixel in the DB
      const updateField = `grid.${y}.${x}`; // Path to the specific pixel in the nested array
      const result = await canvasCollection.updateOne(
        { _id: CANVAS_DOC_ID }, 
        { $set: { [updateField]: color } },
        { upsert: false } // Don't create if the document doesn't exist (it should)
      );

      if (result.modifiedCount > 0 || result.upsertedCount > 0) {
        console.log(`[${socket.id}] User ${userId} placed pixel at (${x}, ${y}) with color ${color}`);
        
        // Update the user's last placement time *after* successful DB update
        userCooldowns.set(userId, now);

        // Broadcast the update to all connected clients (including sender for confirmation)
        io.emit('pixelUpdate', { x, y, color });
        // Optionally, send confirmation only to sender with cooldown info
        socket.emit('pixelPlacedSuccessfully', { cooldownEnds: now + PIXEL_PLACEMENT_COOLDOWN_MS }); 
      } else {
        // This might happen if the CANVAS_DOC_ID doesn't exist, handle appropriately
        console.warn(`[${socket.id}] Failed to update pixel in DB for (${x}, ${y}). Document might be missing or field path incorrect.`);
        socket.emit('error', 'Failed to save pixel. Please try again.');
      }

    } catch (dbError) {
      console.error(`[${socket.id}] Database error placing pixel for user ${userId} at (${x}, ${y}):`, dbError);
      socket.emit('error', 'A database error occurred.');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 