import React, { useState, useEffect } from 'react';

const GRID_SIZE = 64;
const PIXEL_SIZE = 10; // Adjust for desired pixel display size (might need to be smaller for larger grid)
const DEFAULT_COLOR = '#FFFFFF'; // White

function PixelGrid({ 
  grid, 
  isAuthenticated, 
  onPixelClick, 
  socket, 
  isDisabled, 
  isPickingColor, // New prop
  onColorPick, // New prop
  onPixelHover // New prop
}) {
  // Initialize grid state with the provided grid data
  const [localGrid, setLocalGrid] = useState(grid || 
    Array(GRID_SIZE).fill(0).map(() => 
      Array(GRID_SIZE).fill(DEFAULT_COLOR)
    )
  );

  // Update local grid when prop changes
  useEffect(() => {
    if (grid) {
      setLocalGrid(grid);
    }
  }, [grid]);

  // Effect to listen for incoming pixel updates from the server
  useEffect(() => {
    if (socket) {
      // Handler for receiving updates
      const handlePixelUpdate = (data) => {
        console.log('Received pixel update:', data);
        const { x, y, color } = data;

        // Update the grid state immutably
        setLocalGrid(prevGrid => {
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
  }, [socket]);

  const handlePixelClick = (rowIndex, colIndex) => {
    // If in color picking mode, handle that first
    if (isPickingColor) {
      const pickedColor = localGrid[rowIndex][colIndex];
      if (onColorPick) {
        onColorPick(pickedColor);
      }
      return; // Don't proceed with regular pixel placement
    }

    // Prevent clicks if user is not authenticated OR if on cooldown
    if (!isAuthenticated) {
      console.log("User not authenticated, ignoring pixel click.");
      return;
    }
    if (isDisabled) {
      console.log("User is on cooldown, ignoring pixel click.");
      return;
    }

    // Call the handler passed via props (to send update via socket later)
    if (onPixelClick) {
      onPixelClick(rowIndex, colIndex);
    }
  };

  // Determine cursor style based on state
  let cursorStyle = 'pointer';
  if (isPickingColor) {
    cursorStyle = 'crosshair'; // Or 'copy', 'cell' - depends on preference
  } else if (isDisabled) {
    cursorStyle = 'not-allowed';
  }

  return (
    <div 
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_SIZE}, ${PIXEL_SIZE}px)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, ${PIXEL_SIZE}px)`,
        width: `${GRID_SIZE * PIXEL_SIZE}px`,
        height: `${GRID_SIZE * PIXEL_SIZE}px`,
        border: '1px solid #ccc',
        gap: '0',
        cursor: cursorStyle, // Apply dynamic cursor
        opacity: isDisabled && !isPickingColor ? 0.7 : 1 // Dim only if disabled and not picking
      }}
      onMouseLeave={() => onPixelHover(null)}
    >
      {localGrid.map((row, rowIndex) => 
        row.map((color, colIndex) => (
          <div 
            key={`${rowIndex}-${colIndex}`}
            onClick={() => handlePixelClick(rowIndex, colIndex)}
            onMouseEnter={() => onPixelHover({ row: rowIndex, col: colIndex })}
            style={{
              width: `${PIXEL_SIZE}px`,
              height: `${PIXEL_SIZE}px`,
              backgroundColor: color,
              border: '1px solid #eee',
              // No individual pixel changes needed for disabled state, handled by container
            }}
          />
        ))
      )}
    </div>
  );
}

export default PixelGrid; 