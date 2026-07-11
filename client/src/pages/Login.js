import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await login(form);
      toast.success('Logged in');
      navigate(res.data.role === 'cashier' ? '/pos' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-cream px-4">
      <div className="bg-bg-app rounded-lg shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/odoo_cafe_logo.png" alt="Kaapi Cafe" className="h-16 w-16 mx-auto rounded-full object-cover mb-3" />
          <h1 className="text-h1 text-text-primary">Kaapi POS</h1>
          <p className="text-caption text-text-secondary mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-body-strong text-text-primary block mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-border rounded-sm px-3 py-2.5 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="text-body-strong text-text-primary block mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-border rounded-sm px-3 py-2.5 pr-10 text-body bg-bg-app focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent text-accent-on rounded-md py-2.5 text-body-strong hover:bg-accent-hover disabled:bg-accent-soft disabled:text-text-disabled transition-colors"
          >
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
        <p className="text-center text-caption text-text-secondary mt-4">
          Don't have an account? <Link to="/signup" className="text-accent hover:text-accent-hover">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
