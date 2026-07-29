import React from "react";
import useEmblaCarousel from "embla-carousel-react";

export function Testimonials() {
  const [emblaRef] = useEmblaCarousel({ loop: true, align: "center" });

  const items = [
    { text: "Aorane has completely transformed how we manage our corporate wellness program. The dashboards are beautiful and deeply insightful.", author: "Sarah Jenkins, HR Director" },
    { text: "Finally, a healthcare platform that looks and feels like modern software. The automated enrollment via codes is a game-changer.", author: "Dr. Arun Kumar, Apollo Network" },
    { text: "We reduced our overall employee sick days by 14% simply by utilizing the predictive risk dashboards.", author: "Rajesh Patel, Enterprise Co." }
  ];

  return (
    <div style={{ padding: "80px 20px", background: "white" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: "#181c20", marginBottom: 40 }}>Trusted by Health Leaders</h2>

        <div ref={emblaRef} style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", cursor: "grab" }}>
            {items.map((item, i) => (
              <div key={i} style={{ flex: "0 0 100%", padding: "0 20px" }}>
                <div style={{
                  background: "#f7f9fe", padding: 40, borderRadius: 24,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
                }}>
                  <p style={{ fontSize: 20, fontStyle: "italic", color: "#374151", marginBottom: 24, lineHeight: 1.6 }}>
                    "{item.text}"
                  </p>
                  <p style={{ fontWeight: 700, color: "#005d90" }}>{item.author}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
