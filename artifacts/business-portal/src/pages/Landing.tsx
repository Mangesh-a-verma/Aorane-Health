import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Testimonials } from "@/components/landing/Testimonials";

export default function Landing({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <>
      <Helmet>
        <title>Aorane Business | Premium Healthcare Intelligence</title>
      </Helmet>

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Simple Header */}
        <header style={{
          padding: "20px 40px", display: "flex", justifyContent: "space-between",
          alignItems: "center", background: "white", borderBottom: "1px solid rgba(0,0,0,0.05)",
          position: "sticky", top: 0, zIndex: 50
        }}>
          <div style={{ fontWeight: 800, fontSize: 24, color: "#005d90", letterSpacing: "-1px" }}>
            Aorane<span style={{ color: "#6dfad4" }}>.</span>
          </div>
          <button
            onClick={onOpenAuth}
            style={{
              background: "#005d90", color: "white", border: "none",
              padding: "10px 24px", borderRadius: 20, fontWeight: 600, cursor: "pointer"
            }}
          >
            Sign In
          </button>
        </header>

        <main style={{ flex: 1 }}>
          <Hero onOpenAuth={onOpenAuth} />
          <Features />
          <Testimonials />
        </main>

        <footer style={{ padding: "40px", textAlign: "center", background: "#181c20", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
          © 2024 Aorane. Premium Healthcare Intelligence.
        </footer>
      </div>
    </>
  );
}
