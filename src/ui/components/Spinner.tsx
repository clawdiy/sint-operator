import React from 'react';

export default function Spinner({ text }: { text?: string }) {
  return (
    <div className="spinner-container">
      <div className="spinner" />
      {text && <div className="spinner-text">{text}</div>}
    </div>
  );
}
