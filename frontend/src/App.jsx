import { useState, useEffect } from 'react'
import PixelGrid from './components/PixelGrid';
import ColorPalette from './components/ColorPalette';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode"; // Library to decode JWTs
import { io } from "socket.io-client"; // <-- Import socket.io client

// Backend API URL - adjust if your backend runs elsewhere
const BACKEND_URL = 'http://localhost:3000';

function App() {
  // User state now stores { name, email, id (google sub) }
  const [user, setUser] = useState(null);
  // Store the latest Google ID token
  const [googleToken, setGoogleToken] = useState(null); 
  // Socket instance state
  const [socket, setSocket] = useState(null);
  // State for the currently selected color
  const [selectedColor, setSelectedColor] = useState('#000000'); // Default to black
  // State for the grid data itself
  const [gridData, setGridData] = useState(null); // Initially null or empty array

  // Effect to setup and teardown Socket.IO connection
  useEffect(() => {
    console.log('useEffect running: Setting up socket connection...');
    let currentToken = googleToken; // Capture token at the time effect runs

    // Establish connection (consider adding auth query later)
    const newSocket = io(BACKEND_URL);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setSocket(newSocket); // Store the socket instance in state

      // If we have a token from a previous login, authenticate the socket
      if (currentToken) {
        console.log(`[${newSocket.id}] Attempting to authenticate socket...`);
        newSocket.emit('authenticateSocket', currentToken);
      } else {
        console.log(`[${newSocket.id}] Socket connected, but no token available for auth yet.`);
      }

      // Request the initial grid state from the server
      console.log('Requesting initial grid state...');
      newSocket.emit('getInitialGrid');
    });

    // Listen for the initial grid state directly in App
    const handleInitialGrid = (initialGridData) => {
      console.log('App: Received initial grid state');
      if (Array.isArray(initialGridData) && initialGridData.length > 0) {
        setGridData(initialGridData);
      } else {
        console.error('App: Received invalid initial grid data:', initialGridData);
        // Initialize with a default empty grid if needed
        // setGridData(Array(32).fill(0).map(() => Array(32).fill('#FFFFFF'))); 
      }
    };
    newSocket.on('initialGrid', handleInitialGrid);

    // Optional: Listen for authentication result from backend
    const handleAuthResult = (result) => {
      if (result.success) {
        console.log(`[${newSocket.id}] Socket successfully authenticated by backend.`);
      } else {
        console.error(`[${newSocket.id}] Socket authentication failed:`, result.error);
        // Handle failure - maybe prompt user to re-login?
        // Potentially disconnect or clear user state?
      }
    };
    newSocket.on('authResult', handleAuthResult);

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setSocket(null); // Clear the socket state on disconnect
      setGridData(null); // Clear grid data on disconnect? Or keep last state?
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      // Optionally add retry logic or user feedback here
    });

    // Cleanup function: runs when component unmounts
    return () => {
      console.log('Disconnecting socket...');
      newSocket.off('initialGrid', handleInitialGrid);
      newSocket.off('authResult', handleAuthResult); // Cleanup listener
      newSocket.disconnect();
      setSocket(null); // Ensure socket state is cleared on unmount
    };

  }, [googleToken]); // Re-run effect if the googleToken changes (e.g., after login/logout)
  // This allows re-authentication if the socket reconnects after a token is obtained

  const handleLoginSuccess = async (credentialResponse) => {
    console.log("Login Success:", credentialResponse);
    const idToken = credentialResponse.credential;

    // 1. Send token to backend for verification
    try {
      const res = await fetch(`${BACKEND_URL}/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: idToken }),
      });

      if (!res.ok) {
        throw new Error('Backend token verification failed');
      }

      const backendData = await res.json();
      console.log('Backend verification success:', backendData);

      // 2. Decode token on frontend for immediate UI update (optional but common)
      const decoded = jwtDecode(idToken);
      console.log("Decoded JWT:", decoded);

      // 3. Set user state (using info from backend or decoded token)
      setUser({
        id: backendData.user.sub, // Google's unique user ID
        name: backendData.user.name,
        email: backendData.user.email,
        // Add other fields if needed (e.g., picture)
      });

      // 4. Store the token for socket authentication
      setGoogleToken(idToken);

      // 5. If socket is already connected, authenticate it now
      if (socket) {
        console.log(`[${socket.id}] Login successful, authenticating existing socket...`);
        socket.emit('authenticateSocket', idToken);
      }

    } catch (error) {
      console.error("Login Error:", error);
      setUser(null); // Clear user state on error
      setGoogleToken(null); // Clear token on error
    }
  };

  const handleLogout = () => {
    googleLogout(); // Clears Google session
    console.log("Logout clicked");
    setUser(null);
    setGoogleToken(null); // Clear the token on logout
  };

  // Handler for when a pixel is clicked in the grid
  const handleGridPixelClick = (rowIndex, colIndex, color) => {
    console.log(`Pixel clicked: (${rowIndex}, ${colIndex}), Color: ${color}`);
    // Send pixel update via WebSocket if connected and logged in
    if (socket && user) {
      socket.emit('placePixel', {
        x: colIndex,
        y: rowIndex,
        color: color,
      });
    } else {
      console.warn('Cannot place pixel: Socket not connected or user not logged in.');
    }
  };

  return (
    <div>
      <h1>Collaborative Pixel Art</h1>
      <div style={{ marginBottom: '20px' }}>
        {user ? (
          <div>
            <span>Welcome, {user.name}!</span>
            <button onClick={handleLogout} style={{ marginLeft: '10px' }}>Logout</button>
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleLoginSuccess}
            onError={() => {
              console.log('Login Failed');
              setUser(null);
            }}
          />
        )}
      </div>

      {/* Placeholder for the Pixel Grid Component */} 
      {gridData ? (
        <PixelGrid 
          initialGridData={gridData} // Pass initial data
          socket={socket} // Still need socket for pixel updates
          isAuthenticated={!!user} // Pass auth status
          selectedColor={selectedColor}
          onPixelClick={handleGridPixelClick}
        />
      ) : (
        <div>Loading Canvas...</div> // Show loading state until grid data arrives
      )}

      {/* Placeholder for the Color Palette Component */}
      <ColorPalette 
        selectedColor={selectedColor} 
        onColorSelect={setSelectedColor} 
      />
    </div>
  )
}

export default App
