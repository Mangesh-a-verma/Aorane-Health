import { Star } from "lucide-react";
import { motion } from "framer-motion";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Software Engineer",
    city: "Bengaluru",
    initials: "PS",
    color: "#0747A6",
    stars: 5,
    quote: "The AI food scanner is magical! I scanned my dal chawal and got exact macros in 2 seconds. Lost 6kg in 3 months without any diet plan. Aorane changed my life.",
  },
  {
    name: "Dr. Rajan Mehta",
    role: "Cardiologist",
    city: "Mumbai",
    initials: "RM",
    color: "#10B981",
    stars: 5,
    quote: "Finally an Indian app that takes medical data seriously. I recommend Aorane to all my patients for daily vitals tracking. The ECG monitoring alerts have been life-saving.",
  },
  {
    name: "Anita Krishnamurthy",
    role: "HR Director",
    city: "Hyderabad",
    initials: "AK",
    color: "#7C3AED",
    stars: 5,
    quote: "Our company's productivity improved 18% after deploying Aorane Business for 500 employees. The department health dashboards are incredible for planning wellness programs.",
  },
  {
    name: "Vikram Tiwari",
    role: "Fitness Coach",
    city: "Delhi",
    initials: "VT",
    color: "#F59E0B",
    stars: 5,
    quote: "MET-based calorie tracking is incredibly accurate. I recommend Aorane to all my clients. The exercise library with 300+ exercises covers everything from yoga to weightlifting.",
  },
  {
    name: "Sunita Patel",
    role: "Homemaker",
    city: "Ahmedabad",
    initials: "SP",
    color: "#EF4444",
    stars: 5,
    quote: "I track my whole family's health in one app. My elderly parents love the medicine reminders. The family health dashboard lets me monitor everyone from one screen.",
  },
  {
    name: "Rohit Bansal",
    role: "Startup Founder",
    city: "Pune",
    initials: "RB",
    color: "#059669",
    stars: 5,
    quote: "Aorane Business reduced our health insurance claims by 22% in the first year. The ROI is phenomenal. Every Indian company should have this for their workforce.",
  },
  {
    name: "Meera Iyer",
    role: "Nutritionist",
    city: "Chennai",
    initials: "MI",
    color: "#0747A6",
    stars: 5,
    quote: "As a nutritionist, I'm impressed by the accuracy of the food scanner for Indian dishes. It even recognized my client's traditional Onam sadya and got macros right!",
  },
  {
    name: "Arjun Nair",
    role: "Corporate Manager",
    city: "Kochi",
    initials: "AN",
    color: "#10B981",
    stars: 5,
    quote: "The AI-powered health insights are surprisingly accurate. It predicted my vitamin D deficiency two weeks before my blood test confirmed it. Truly next-gen health tech.",
  },
];

function TestimonialCard({ t }: { t: typeof testimonials[0] }) {
  return (
    <div className="flex-shrink-0 w-80 glass-panel-soft rounded-3xl p-6 mx-3 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
            style={{ background: t.color }}
          >
            {t.initials}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{t.name}</p>
            <p className="text-xs text-gray-500">{t.role} · {t.city}</p>
          </div>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: t.stars }).map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed italic flex-1">"{t.quote}"</p>
    </div>
  );
}

export default function TestimonialsSlider() {
  const doubled = [...testimonials, ...testimonials];

  return (
    <section className="py-20 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <span className="text-xs font-bold text-[#F59E0B] bg-[#F59E0B]/10 px-3 py-1 rounded-full uppercase tracking-widest">
            Testimonials
          </span>
          <h2 className="font-display mt-4 text-3xl sm:text-4xl font-medium text-gray-900">
            Loved by <span className="gradient-text-teal italic">2 lakh+ Indians</span>
          </h2>
          <p className="mt-3 text-gray-500 max-w-lg mx-auto">
            From fitness enthusiasts to doctors, families to Fortune 500 companies — Aorane works for everyone.
          </p>
        </motion.div>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        <div
          className="flex"
          style={{
            animation: "marquee 50s linear infinite",
          }}
        >
          {doubled.map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>

        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .flex:hover {
            animation-play-state: paused;
          }
        `}</style>
      </div>
    </section>
  );
}
