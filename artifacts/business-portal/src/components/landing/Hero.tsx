import React from "react";
import { useLocation } from "wouter";

const PRIMARY = "#005d90";

export function Hero({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #005d90 0%, #003a5c 100%)",
      padding: "120px 20px 80px",
      textAlign: "center",
      color: "white",
      position: "relative",
      overflow: "hidden"
    }}>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{
          fontSize: "clamp(32px, 5vw, 56px)",
          fontWeight: 800,
          lineHeight: 1.1,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          marginBottom: 24,
          letterSpacing: "-0.02em"
        }}>
          Premium Health Analytics for <span style={{ color: "#6dfad4" }}>Your Workforce</span>
        </h1>
        <p style={{
          fontSize: "clamp(16px, 2vw, 20px)",
          lineHeight: 1.6,
          color: "rgba(255,255,255,0.85)",
          marginBottom: 40,
          fontWeight: 500
        }}>
          A single platform to manage corporate wellness, monitor real-time health signals, and provide top-tier benefits to your team.
        </p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={onOpenAuth}
            style={{
              padding: "16px 32px",
              background: "white",
              color: PRIMARY,
              borderRadius: 30,
              fontSize: 16,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              transition: "transform 0.2s, box-shadow 0.2s"
            }}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
