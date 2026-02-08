import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleCallback } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      // Extract session_id from URL fragment
      const hash = location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const sessionId = params.get('session_id');

      if (sessionId) {
        const success = await handleCallback(sessionId);
        if (success) {
          navigate('/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      } else {
        navigate('/login', { replace: true });
      }
    };

    processAuth();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[#39ff14]/10 flex items-center justify-center animate-pulse">
          <Sparkles className="w-8 h-8 text-[#39ff14]" />
        </div>
        <Loader2 className="w-8 h-8 text-[#39ff14] animate-spin mx-auto mb-4" />
        <p className="text-zinc-400">Casting authentication spell...</p>
      </div>
    </div>
  );
}
