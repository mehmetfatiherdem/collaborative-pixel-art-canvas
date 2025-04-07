import { useState, useEffect } from 'react'
import PixelGrid from './components/PixelGrid';
import ColorPalette from './components/ColorPalette';
import { GoogleLogin } from '@react-oauth/google';
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
  // State for error handling
  const [error, setError] = useState(null);
  // State for cooldown timer end time (timestamp)
  const [cooldownEndTime, setCooldownEndTime] = useState(null);
  // State for color picker mode
  const [isPickingColor, setIsPickingColor] = useState(false);
  // State for hovered pixel coordinates
  const [hoverCoords, setHoverCoords] = useState(null);

  // Effect to setup and teardown Socket.IO connection
  useEffect(() => {
    console.log('Effect triggered (runs once on mount)');
    console.log('Setting up socket connection to:', BACKEND_URL);
    const newSocket = io(BACKEND_URL, {
      reconnectionAttempts: 3, 
      timeout: 10000, 
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully. ID:', newSocket.id);
      setSocket(newSocket);

      // If token exists when socket connects, authenticate immediately
      // This handles cases like page refresh while logged in
      const currentToken = localStorage.getItem('googleToken'); // Or get from state if preferred
      if (currentToken) { 
        console.log('Socket connected, attempting to authenticate with existing token...');
        newSocket.emit('authenticateSocket', currentToken);
      } else {
        console.log('Socket connected, but no token available for immediate auth.');
      }

      console.log('Requesting initial grid state...');
      newSocket.emit('getInitialGrid');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket Connection Error:', err.message, err.description ? err.description : '');
      setError(`Socket connection failed: ${err.message}. Is the backend running at ${BACKEND_URL}?`);
      setGridData(null); // Ensure grid doesn't stay in loading state indefinitely on error
      setSocket(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected. Reason:', reason);
      setError('Disconnected from server.');
      setSocket(null); // Clear socket state
      // Decide if you want to clear grid data on disconnect
      // setGridData(null);
    });

    // Listen for initial grid data
    newSocket.on('initialGrid', (data) => {
      console.log('Received initial grid data:', data);
      if (Array.isArray(data)) {
        setGridData(data);
      } else {
        console.error('Invalid grid data received:', data);
        setError('Failed to load grid data');
      }
    });

    // Listen for global pixel updates
    newSocket.on('pixelUpdate', (data) => {
      console.log('Received global pixel update:', data);
      setGridData(prevGrid => {
        if (!prevGrid) return prevGrid;
        // Basic validation
        if (data && typeof data.y === 'number' && typeof data.x === 'number' && 
            data.y >= 0 && data.y < prevGrid.length && data.x >= 0 && data.x < prevGrid[0].length) {
          const newGrid = [...prevGrid];
          newGrid[data.y] = [...newGrid[data.y]];
          newGrid[data.y][data.x] = data.color;
          return newGrid;
        } else {
          console.warn('Received invalid pixelUpdate data:', data);
          return prevGrid;
        }
      });
    });

    // Listen for confirmation that *this user* placed a pixel successfully
    newSocket.on('pixelPlacedSuccessfully', (data) => {
      console.log('Pixel placed successfully by this user. Cooldown ends at:', new Date(data.cooldownEnds));
      setCooldownEndTime(data.cooldownEnds);
    });

    // Listen for errors (including cooldown errors)
    newSocket.on('error', (errorMessage) => {
      console.error('Socket error received:', errorMessage);
      setError(errorMessage);
      // Don't auto-clear cooldown errors, let the timer handle it
      if (!errorMessage.includes('Please wait')) { 
          setTimeout(() => setError(null), 5000);
      }
    });

    // Cleanup
    return () => {
      console.log('Cleaning up socket connection on component unmount... Disconnecting socket ID:', newSocket.id);
      newSocket.disconnect();
      setSocket(null); 
    };
  }, []); // <--- Empty dependency array: Run only on mount and unmount

  const handleGoogleSuccess = async (credentialResponse) => {
    console.log("Attempting Google Sign-In...");
    const idToken = credentialResponse.credential;
    console.log("Received Google ID Token:", idToken ? "(token present)" : "(token missing)");

    try {
      console.log("Sending token to backend for verification at:", `${BACKEND_URL}/verify-token`);
      const res = await fetch(`${BACKEND_URL}/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: idToken }),
      });

      console.log("Backend verification response status:", res.status);
      if (!res.ok) {
        const errorBody = await res.text();
        console.error('Backend verification failed. Status:', res.status, 'Body:', errorBody);
        throw new Error(`Backend verification failed with status ${res.status}`);
      }

      const backendData = await res.json();
      console.log('Backend verification successful. Data:', backendData);

      if (!backendData || !backendData.user || !backendData.user.sub) {
        console.error("Received invalid user data from backend:", backendData);
        throw new Error("Invalid user data received from backend.");
      }

      const decoded = jwtDecode(idToken);
      console.log("Decoded JWT on frontend:", decoded);

      console.log("Setting user state:", backendData.user);
      setUser({
        id: backendData.user.sub,
        name: backendData.user.name,
        email: backendData.user.email,
      });

      console.log("Setting Google token state...");
      setGoogleToken(idToken);
      // Optionally store token in localStorage for persistence across refreshes
      localStorage.setItem('googleToken', idToken);

      // Authenticate the *existing* socket connection if it's connected
      if (socket && socket.connected) {
          console.log(`Authenticating existing socket (${socket.id}) with new token...`);
          socket.emit('authenticateSocket', idToken);
      } else {
          console.log('Socket not yet connected, authentication will happen on connect.');
      }

      console.log("Login process complete. State updated.");

    } catch (error) {
      console.error("Login Error Details:", error);
      setError(`Login failed: ${error.message}. Please check console for details.`);
      setUser(null);
      setGoogleToken(null);
      localStorage.removeItem('googleToken'); // Clear stored token on error
    }
  };

  const handleLogout = () => {
    console.log("Logout clicked");
    setUser(null);
    setGoogleToken(null);
    localStorage.removeItem('googleToken'); // Clear stored token on logout
    if (socket) {
      // Optional: Inform backend about logout if needed, otherwise just disconnect
      console.log(`Disconnecting socket (${socket.id}) on logout.`);
      socket.disconnect(); 
    }
  };

  // Load token from localStorage on initial load
  useEffect(() => {
    const storedToken = localStorage.getItem('googleToken');
    if (storedToken) {
      console.log('Found token in localStorage, attempting to set initial state.');
      // You might want to verify this token again before setting state,
      // but for simplicity, we'll assume it's valid for now.
      try {
          const decoded = jwtDecode(storedToken);
          // Basic check if token is expired (optional)
          if (decoded.exp * 1000 > Date.now()) {
              setGoogleToken(storedToken);
              // Setting user info from decoded token for quicker UI update,
              // backend verification will happen via socket auth anyway.
              setUser({ 
                  id: decoded.sub, 
                  name: decoded.name, 
                  email: decoded.email 
              });
              console.log('Initial user/token state set from localStorage.');
          } else {
              console.log('Token from localStorage is expired.');
              localStorage.removeItem('googleToken');
          }
      } catch (e) {
          console.error('Error decoding token from localStorage:', e);
          localStorage.removeItem('googleToken');
      }
    }
  }, []); // Run once on mount

  // Handler for when a pixel is clicked in the grid
  const handleGridPixelClick = (rowIndex, colIndex) => {
    if (!socket || !user) {
      console.warn('Cannot place pixel: Socket not connected or user not logged in.');
      return;
    }

    console.log(`Pixel clicked: (${rowIndex}, ${colIndex}), Color: ${selectedColor}`);
    socket.emit('placePixel', {
      x: colIndex,
      y: rowIndex,
      color: selectedColor,
    });
  };

  // Handler for when a color is picked from the grid
  const handleColorPick = (pickedColor) => {
    if (pickedColor) {
      console.log('Color picked:', pickedColor);
      setSelectedColor(pickedColor);
      setIsPickingColor(false); // Turn off picker mode after selection
    }
  };

  // Handler for when the mouse hovers over a pixel in the grid
  const handlePixelHover = (coords) => {
    setHoverCoords(coords);
  };

  // --- Cooldown Timer Logic ---
  const [remainingCooldown, setRemainingCooldown] = useState(0);

  useEffect(() => {
    if (!cooldownEndTime) {
      setRemainingCooldown(0);
      return;
    }

    const calculateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((cooldownEndTime - now) / 1000));
      setRemainingCooldown(remaining);
      if (remaining === 0) {
        setCooldownEndTime(null); // Clear cooldown when it reaches zero
        setError(null); // Clear any lingering cooldown error messages
      }
    };

    // Calculate immediately
    calculateRemaining();

    // Set up an interval to update the countdown every second
    const intervalId = setInterval(calculateRemaining, 1000);

    // Cleanup interval on unmount or when cooldownEndTime changes
    return () => clearInterval(intervalId);

  }, [cooldownEndTime]);

  const isUserOnCooldown = remainingCooldown > 0;
  // --- End Cooldown Timer Logic ---

  return (
    <div style={{
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px'
    }}>
      <h1>Collaborative Pixel Art</h1>
      <div style={{ marginBottom: '20px', minHeight: '30px' }}> {/* Min height for layout consistency */}
        {user ? (
          <div>
            <span>Welcome, {user.name}!</span>
            <button 
              onClick={handleLogout} 
              style={{ 
                marginLeft: '10px',
                padding: '8px 16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              console.log('Login Failed');
              setUser(null);
              setError('Login failed. Please try again.');
            }}
          />
        )}
      </div>

      {/* Display Cooldown Timer or Error */} 
      <div style={{ minHeight: '40px', marginBottom: '15px', textAlign: 'center' }}>
        {isUserOnCooldown && (
          <div style={{ color: 'orange', fontWeight: 'bold' }}>
            Cooldown: {remainingCooldown}s
          </div>
        )}
        {error && (
          <div style={{
            backgroundColor: '#ffebee', color: '#c62828',
            padding: '8px 15px', borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Main Content Area (Grid + Tools) */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start', // Align items to the top
        gap: '20px' // Space between grid and tools
      }}>
        {/* Grid Area */} 
        {gridData ? (
          <PixelGrid 
            grid={gridData}
            onPixelClick={handleGridPixelClick}
            isAuthenticated={!!user}
            socket={socket}
            isDisabled={isUserOnCooldown}
            isPickingColor={isPickingColor}
            onColorPick={handleColorPick}
            onPixelHover={handlePixelHover}
          />
        ) : (
          <div style={{
            width: '642px',
            height: '642px',
            border: '1px solid #ccc',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '1.2em',
            color: '#888',
            backgroundColor: '#f8f8f8'
          }}>
            Loading Canvas...
          </div>
        )}

        {/* Tools Section (Palette + Picker + Coords) */} 
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '15px',
          position: 'sticky', // Make tools sticky if page scrolls
          top: '20px'         // Adjust top offset as needed
        }}>
          <ColorPalette 
            selectedColor={selectedColor} 
            onColorSelect={(color) => {
              setSelectedColor(color);
              setIsPickingColor(false);
            }}
          />
          <button
            onClick={() => setIsPickingColor(prev => !prev)}
            title={isPickingColor ? "Cancel Color Pick" : "Pick Color from Canvas (Eyedropper)"}
            style={{
              padding: '10px',
              fontSize: '1.5em',
              lineHeight: '1',
              cursor: 'pointer',
              border: isPickingColor ? '2px solid dodgerblue' : '1px solid #ccc',
              backgroundColor: isPickingColor ? '#e0f7ff' : '#f0f0f0',
              borderRadius: '5px',
            }}
          >
            <span role="img" aria-label="eyedropper">💧</span>
          </button>
          {/* Display Hover Coordinates */}
          <div style={{
            marginTop: '10px', // Space above coordinates
            minHeight: '20px', // Prevent layout shift
            fontFamily: 'monospace',
            fontSize: '1.1em', 
            color: '#555' // Slightly dim color
          }}>
            {hoverCoords ? `(${hoverCoords.col}, ${hoverCoords.row})` : ' '} 
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
