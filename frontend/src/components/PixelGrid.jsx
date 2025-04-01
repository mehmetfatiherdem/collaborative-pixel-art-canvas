import React, { useState, useEffect } from 'react';

const GRID_SIZE = 32;
const PIXEL_SIZE = 15; // Adjust for desired pixel display size
const DEFAULT_COLOR = '#FFFFFF'; // White

function PixelGrid({ initialGridData, socket, isAuthenticated, selectedColor, onPixelClick }) {
  // Initialize grid state (e.g., 32x32 array filled with white)
  const [grid, setGrid] = useState(initialGridData || 
    Array(GRID_SIZE).fill(0).map(() => 
      Array(GRID_SIZE).fill(DEFAULT_COLOR)
    )
  );

  // Effect to listen for incoming pixel updates from the server
  useEffect(() => {
    if (socket) {
      // Handler for receiving updates
      const handlePixelUpdate = (data) => {
        console.log('Received pixel update:', data);
        const { x, y, color } = data;

        // Update the grid state immutably
        setGrid(prevGrid => {
          // Ensure coordinates are valid before attempting update
          if (y < 0 || y >= prevGrid.length || x < 0 || x >= prevGrid[0].length) {
            console.warn(`Received update with invalid coordinates: (${x}, ${y})`);
            return prevGrid; // Return previous state if invalid
          }

          // Create a shallow copy of the grid array
          const newGrid = [...prevGrid];
          // Create a shallow copy of the specific row to modify
          const newRow = [...newGrid[y]];
          // Update the color in the new row
          newRow[x] = color;
          // Replace the old row with the new row in the new grid
          newGrid[y] = newRow;
          // Return the updated grid
          return newGrid;
        });
      };

      console.log('PixelGrid: Setting up pixelUpdate listener');
      socket.on('pixelUpdate', handlePixelUpdate);

      // Cleanup: Remove listener when component unmounts or socket changes
      return () => {
        console.log('PixelGrid: Removing pixelUpdate listener');
        socket.off('pixelUpdate', handlePixelUpdate);
      };
    }
  }, [socket]); // Re-run effect if the socket instance changes

  const handlePixelClick = (rowIndex, colIndex) => {
    // Prevent clicks if user is not authenticated
    if (!isAuthenticated) {
      console.log("User not authenticated, ignoring pixel click.");
      return;
    }

    // Update the grid locally immediately for responsiveness
    const newGrid = grid.map((row, rIdx) => 
      row.map((pixelColor, cIdx) => {
        if (rIdx === rowIndex && cIdx === colIndex) {
          return selectedColor || DEFAULT_COLOR; // Use selected color or default
        }
        return pixelColor;
      })
    );
    setGrid(newGrid);

    // Call the handler passed via props (to send update via socket later)
    if (onPixelClick) {
      onPixelClick(rowIndex, colIndex, selectedColor || DEFAULT_COLOR);
    }
  };

  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_SIZE}, ${PIXEL_SIZE}px)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, ${PIXEL_SIZE}px)`,
        width: `${GRID_SIZE * PIXEL_SIZE}px`,
        height: `${GRID_SIZE * PIXEL_SIZE}px`,
        border: '1px solid #ccc',
        gap: '0' // No gap between pixels
      }}
    >
      {grid.map((row, rowIndex) => 
        row.map((color, colIndex) => (
          <div 
            key={`${rowIndex}-${colIndex}`}
            onClick={() => handlePixelClick(rowIndex, colIndex)}
            style={{
              width: `${PIXEL_SIZE}px`,
              height: `${PIXEL_SIZE}px`,
              backgroundColor: color,
              border: '1px solid #eee' // Faint border for grid lines
            }}
          />
        ))
      )}
    </div>
  );
}

export default PixelGrid; 