import React from 'react';

// Expanded color palette inspired by common pixel art palettes
const colors = [
  // Reds
  '#FF0000', '#DC143C', '#B22222', '#FF6347', '#FF7F50', '#FFA07A',
  // Oranges
  '#FFA500', '#FF8C00', '#FF7F50', '#FFD700', '#FFDEAD', '#F4A460',
  // Yellows
  '#FFFF00', '#FFD700', '#FFFFE0', '#FAFAD2', '#EEE8AA', '#BDB76B',
  // Greens
  '#008000', '#228B22', '#006400', '#90EE90', '#32CD32', '#ADFF2F',
  // Cyans
  '#00FFFF', '#00CED1', '#40E0D0', '#48D1CC', '#AFEEEE', '#7FFFD4',
  // Blues
  '#0000FF', '#0000CD', '#191970', '#4169E1', '#6495ED', '#ADD8E6',
  // Purples/Magentas
  '#800080', '#4B0082', '#8A2BE2', '#9400D3', '#BA55D3', '#DA70D6',
  // Pinks
  '#FFC0CB', '#FF69B4', '#FF1493', '#DB7093', '#C71585', '#FF00FF',
  // Browns
  '#A52A2A', '#8B4513', '#A0522D', '#D2691E', '#CD853F', '#F4A460',
  // Grays / Blacks / Whites
  '#FFFFFF', '#F5F5F5', '#DCDCDC', '#A9A9A9', '#808080', '#696969', 
  '#2F4F4F', '#000000',
  // Skin Tones (example range)
  '#FFDFC4', '#F0D5BE', '#E1C6AC', '#C6AD96', '#A1887F', '#69524A'
];

function ColorPalette({ selectedColor, onColorSelect }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '5px',
      maxWidth: '400px', // Adjust as needed to fit layout
      justifyContent: 'center',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '5px',
      backgroundColor: '#f9f9f9'
    }}>
      {colors.map((color) => {
        const isSelected = selectedColor === color;
        return (
          <div
            key={color}
            onClick={() => onColorSelect(color)}
            style={{
              width: '20px', // Smaller swatches for more colors
              height: '20px',
              backgroundColor: color,
              border: '1px solid #eee',
              borderRadius: '3px', 
              cursor: 'pointer',
              position: 'relative', // Needed for potential pseudo-elements or transforms
              outline: isSelected ? '2px solid dodgerblue' : 'none', // Use outline for selection
              outlineOffset: isSelected ? '1px' : '0px',
              transform: isSelected ? 'scale(1.15)' : 'scale(1)', // Slightly bigger scale
              transition: 'transform 0.1s ease-out, outline 0.1s ease-out', // Smooth transitions
              boxShadow: isSelected ? '0 0 5px rgba(0,0,0,0.3)' : 'none' // Add shadow when selected
            }}
          />
        );
      })}
    </div>
  );
}

export default ColorPalette; 