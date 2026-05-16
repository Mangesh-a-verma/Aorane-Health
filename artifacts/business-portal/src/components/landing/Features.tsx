import React, { useState, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";

export function Features() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  const features = [
    { title: "Corporate Dashboards", desc: "View real-time, aggregated health data for your entire workforce in one beautiful dashboard.", icon: "dashboard" },
    { title: "Predictive Health Risk", desc: "AI-driven insights alert you to potential organizational health risks before they become issues.", icon: "monitoring" },
    { title: "Seamless App Sync", desc: "Directly sync with the Aorane mobile app. Employees just enter an enrollment code.", icon: "sync" },
    { title: "Secure & Compliant", desc: "Bank-level encryption and strict DPDP compliance ensures all employee data is private and secure.", icon: "lock" }
  ];

  return (
    <div style={{ padding: "80px 20px", background: "#f7f9fe" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: 36, fontWeight: 800, color: "#181c20", marginBottom: 40 }}>
          Enterprise-Grade Healthcare Tech
        </h2>

        <div className="embla" ref={emblaRef} style={{ overflow: "hidden", borderRadius: 24, padding: "20px 0" }}>
          <div className="embla__container" style={{ display: "flex", gap: 24, paddingLeft: 10 }}>
            {features.map((f, i) => (
              <div key={i} className="embla__slide" style={{
                flex: "0 0 auto", width: "300px", minWidth: 0,
                background: "white", padding: 32, borderRadius: 24,
                boxShadow: "0 12px 40px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.05)"
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: "#005d9015", color: "#005d90", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
                  <span className="material-symbols-outlined">{f.icon}</span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#181c20" }}>{f.title}</h3>
                <p style={{ color: "#6b7280", lineHeight: 1.6, fontSize: 15 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
