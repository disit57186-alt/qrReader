import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { openDB } from "idb";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function QRScanner({ qrBoxSize = 300, fps = 25 }) {
  const [history, setHistory] = useState([]);
  const [lastScan, setLastScan] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const dbRef = useRef(null);
  const scannedSet = useRef(new Set());

  // Initialize IndexedDB
  useEffect(() => {
    const initDB = async () => {
      const db = await openDB("qr-scans-db", 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("scans")) {
            db.createObjectStore("scans", { keyPath: "id", autoIncrement: true });
          }
        },
      });
      dbRef.current = db;

      const allScans = await db.getAll("scans");
      setHistory(allScans);
      scannedSet.current = new Set(allScans.map((x) => x.value));
    };
    initDB();
  }, []);

  // Start scanning
  const startScanning = async () => {
    if (!dbRef.current) return;
    if (scannerRef.current) return;

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        alert("No camera found on device");
        return;
      }

      // Prefer back camera
      const backCamera = cameras.find((cam) =>
        cam.label.toLowerCase().includes("back")
      ) || cameras[0];

      const scanner = new Html5Qrcode("qr-reader");

      await scanner.start(
        { deviceId: { exact: backCamera.id } },
        { fps, qrbox: qrBoxSize },
        async (decodedText) => {
          if (!scannedSet.current.has(decodedText)) {
            scannedSet.current.add(decodedText);
            const entry = {
              value: decodedText,
              time: new Date().toLocaleString(),
            };
            await dbRef.current.add("scans", entry);
            setHistory((prev) => [entry, ...prev]);
            setLastScan(decodedText);
          }
        }
      );

      scannerRef.current = scanner;
      setScanning(true);
    } catch (err) {
      console.error(err);
      alert(
        "Camera start failed. Make sure you allow camera access and are on HTTPS."
      );
    }
  };

  // Stop scanning
  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current = null;
          setScanning(false);
        })
        .catch(() => {});
    }
  };

  // Export scans to Excel
  const exportToExcel = () => {
    if (!history.length) return;

    const worksheet = XLSX.utils.json_to_sheet(history);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Scanned Data");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const file = new Blob([excelBuffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(file, `QRCode_Scans_${Date.now()}.xlsx`);
  };

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h2>Mobile QR Scanner</h2>

      <div
        id="qr-reader"
        style={{
          width: "100%",
          maxWidth: qrBoxSize,
          height: qrBoxSize,
          margin: "20px auto",
          border: "2px solid #444",
          borderRadius: 10,
        }}
      ></div>

      {!scanning ? (
        <button
          onClick={startScanning}
          style={{
            background: "blue",
            color: "#fff",
            padding: "10px 20px",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          Start Scanning
        </button>
      ) : (
        <button
          onClick={stopScanning}
          style={{
            background: "red",
            color: "#fff",
            padding: "10px 20px",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          Stop Scanning
        </button>
      )}

      <h3>Last Scan:</h3>
      <p style={{ fontSize: 18, fontWeight: "bold" }}>
        {lastScan || "Waiting..."}
      </p>

      <button
        onClick={exportToExcel}
        style={{
          background: "green",
          color: "#fff",
          padding: "10px 20px",
          border: "none",
          borderRadius: 5,
          cursor: "pointer",
          marginTop: 20,
        }}
      >
        Download Excel
      </button>

      <h3 style={{ marginTop: 30 }}>Total Scanned: {history.length}</h3>

      <ul style={{ textAlign: "left", maxWidth: "400px", margin: "20px auto" }}>
        {history.map((item) => (
          <li key={item.id}>
            <b>{item.value}</b> – <i>{item.time}</i>
          </li>
        ))}
      </ul>
    </div>
  );
}
