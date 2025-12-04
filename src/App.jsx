import React from "react";
import QRScanner from "./QRScanner";

export default function App() {
  return (
    <div>
      <QRScanner qrBoxSize={300} fps={30} />
    </div>
  );
}
