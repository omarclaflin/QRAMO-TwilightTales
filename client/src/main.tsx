import React from 'react';
import { createRoot } from "react-dom/client";
import App from './App';
import "./index.css";

// Wrap rendering in a try/catch to catch any errors
try {
  console.log("Attempting to render React app with wouter routing");
  const rootElement = document.getElementById("root");
  if (rootElement) {
    console.log("Root element found, initializing React with routing");
    const root = createRoot(rootElement);
    root.render(<App />);
    console.log("React rendering with routing complete");
  } else {
    console.error("Error: Root element not found!");
  }
} catch (error) {
  console.error("Error rendering React application:", error);
}
