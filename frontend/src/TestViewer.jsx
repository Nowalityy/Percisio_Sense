import React, { useState } from 'react';
import GenericViewer3D from './GenericViewer3D';

export default function TestViewer() {
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      <div style={{ padding: '12px 20px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>GenericViewer3D Sandbox</h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Isolated testing wrapper for your colleague's viewer.</p>
        </div>
        <button 
          onClick={() => setIsProcessing(p => !p)}
          style={{ padding: '8px 16px', backgroundColor: isProcessing ? '#ef4444' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Toggle Processing Loader
        </button>
      </div>
      
      {/* Container for the viewer itself */}
      <div style={{ flex: 1, position: 'relative' }}>
        <GenericViewer3D isProcessing={isProcessing} />
      </div>
    </div>
  );
}
