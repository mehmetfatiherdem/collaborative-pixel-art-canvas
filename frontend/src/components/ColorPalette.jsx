import React from 'react';

const COLORS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#FF0000', // Red
  '#00FF00', // Lime
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#C0C0C0', // Silver
  '#808080', // Gray
  '#800000', // Maroon
  '#008000', // Green
  '#000080', // Navy
  '#808000', // Olive
  '#800080', // Purple
  '#008080', // Teal
];

function ColorPalette({ selectedColor, onColorSelect }) {
  return (
    <div 
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '5px',
        marginTop: '15px',
        padding: '10px',
        border: '1px solid #ccc',
        maxWidth: 'fit-content'
      }}
    >
      {COLORS.map((color) => (
        <div 
          key={color}
          onClick={() => onColorSelect(color)}
          style={{
            width: '25px',
            height: '25px',
            backgroundColor: color,
            border: color === selectedColor ? '2px solid black' : '1px solid #eee',
            cursor: 'pointer',
            boxSizing: 'border-box' // Include border in width/height
          }}
        />
      ))}
    </div>
  );
}

export default ColorPalette; 