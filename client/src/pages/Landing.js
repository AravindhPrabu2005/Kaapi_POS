import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingCart, UtensilsCrossed, QrCode, CreditCard,
  BarChart3, Users, ArrowRight, CheckCircle, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const features = [
  { icon: ShoppingCart, title: 'Order Management', desc: 'Create, modify, and track orders in real-time with an intuitive interface designed for fast-paced cafés.' },
  { icon: UtensilsCrossed, title: 'Kitchen Display System', desc: 'Send orders directly to the kitchen with stage-based ticket management for seamless workflow.' },
  { icon: QrCode, title: 'Self-Ordering Portal', desc: 'Let customers browse menus and place orders from their phones via QR codes at each table.' },
  { icon: CreditCard, title: 'Payments & Billing', desc: 'Accept multiple payment methods, split bills, and generate digital receipts effortlessly.' },
  { icon: BarChart3, title: 'Reports & Analytics', desc: 'Get insights into sales, popular items, employee performance, and peak hours.' },
  { icon: Users, title: 'Customer Management', desc: 'Build customer profiles, track order history, and run targeted promotions to boost loyalty.' },
];

const stats = [
  { label: 'Orders Processed', value: '10,000+' },
  { label: 'Active Cafés', value: '50+' },
  { label: 'Uptime', value: '99.9%' },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-bg-cream font-sans text-text-primary">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-bg-app/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2">
            <img src="/odoo_cafe_logo.png" alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-h2 text-text-primary">Kaapi POS</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-body text-text-secondary hover:text-text-primary transition-colors">Features</a>
            <Link to="/login" className="text-body text-text-secondary hover:text-text-primary transition-colors">Log in</Link>
            <Link
              to="/signup"
              className="bg-accent text-accent-on rounded-md px-4 py-2 text-body-strong hover:bg-accent-hover transition-colors"
            >
              Get Started
            </Link>
          </div>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-text-primary">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-bg-app border-t border-border px-4 pb-4 flex flex-col gap-3 pt-3">
            <a href="#features" onClick={() => setMobileOpen(false)} className="text-body text-text-secondary">Features</a>
            <Link to="/login" onClick={() => setMobileOpen(false)} className="text-body text-text-secondary">Log in</Link>
            <Link
              to="/signup"
              onClick={() => setMobileOpen(false)}
              className="bg-accent text-accent-on rounded-md px-4 py-2 text-body-strong text-center hover:bg-accent-hover transition-colors"
            >
              Get Started
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 md:pt-28 md:pb-20 text-center">
        <h1 className="text-display md:text-[40px] md:leading-[48px] text-text-primary max-w-3xl mx-auto">
          The All-in-One POS System for Modern Cafés
        </h1>
        <p className="text-body text-text-secondary mt-4 max-w-xl mx-auto">
          Streamline orders, manage your kitchen, and delight customers — all from one
          powerful platform built for the unique needs of cafés and restaurants.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link
            to="/signup"
            className="bg-accent text-accent-on rounded-md px-6 py-3 text-body-strong hover:bg-accent-hover transition-colors inline-flex items-center gap-2"
          >
            Get Started Free <ArrowRight size={18} />
          </Link>
          <Link
            to="/login"
            className="border border-border text-text-primary rounded-md px-6 py-3 text-body-strong hover:bg-bg-subtle transition-colors"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-bg-app py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-h1 text-center text-text-primary">Everything You Need to Run Your Café</h2>
          <p className="text-body text-text-secondary text-center mt-2 max-w-lg mx-auto">
            From the front counter to the kitchen and beyond.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            {features.map((f) => (
              <div key={f.title} className="border border-border rounded-lg p-5 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center mb-3">
                  <f.icon size={20} className="text-accent" />
                </div>
                <h3 className="text-h2 text-text-primary">{f.title}</h3>
                <p className="text-body text-text-secondary mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 md:py-18">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-4 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-display text-accent">{s.value}</p>
              <p className="text-caption text-text-secondary mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-bg-app py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-h1 text-text-primary">Ready to Streamline Your Café?</h2>
          <p className="text-body text-text-secondary mt-2 max-w-md mx-auto">
            Join cafés that trust Kaapi POS to manage operations seamlessly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link
              to="/signup"
              className="bg-accent text-accent-on rounded-md px-6 py-3 text-body-strong hover:bg-accent-hover transition-colors inline-flex items-center gap-2"
            >
              Get Started Free <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="border border-border text-text-primary rounded-md px-6 py-3 text-body-strong hover:bg-bg-subtle transition-colors"
            >
              Sign In
            </Link>
          </div>
          <div className="flex items-center justify-center gap-6 mt-6 text-caption text-text-secondary">
            <span className="flex items-center gap-1"><CheckCircle size={14} /> No credit card</span>
            <span className="flex items-center gap-1"><CheckCircle size={14} /> Free trial</span>
            <span className="flex items-center gap-1"><CheckCircle size={14} /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/odoo_cafe_logo.png" alt="" className="h-6 w-6 rounded-full object-cover" />
            <span className="text-body-strong text-text-primary">Kaapi POS</span>
          </div>
          <p className="text-caption text-text-secondary">&copy; {new Date().getFullYear()} Kaapi POS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
