const scrollbarStyle = {
    '&::-webkit-scrollbar': {
      width: '14px',
      height: '6px',
      display: 'block',
    },
    '&::-webkit-scrollbar-track': {
      background: '#f5f7fa',
    },
    '&::-webkit-scrollbar-thumb': {
      background: 'rgba(209, 213, 219, 0.8)',
      borderRadius: '100px',
  
      backgroundClip: 'padding-box',
      minHeight: '40px',
      '&:hover': {
        background: 'rgba(156, 163, 175, 0.4)',
      },
    },
    '&::-webkit-scrollbar-corner': {
      background: 'transparent',
    },
  };
  const scrollableContainerStyle = {
    ...scrollbarStyle,
    overflowY: 'auto',
    position: 'relative',
  };

export default scrollableContainerStyle