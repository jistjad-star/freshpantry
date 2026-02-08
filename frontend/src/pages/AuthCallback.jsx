import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Leaf } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { handleCallback } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
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
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[#4A7C59]/10 flex items-center justify-center animate-pulse">
          <Leaf className="w-8 h-8 text-[#4A7C59]" />
        </div>
        <Loader2 className="w-8 h-8 text-[#4A7C59] animate-spin mx-auto mb-4" />
        <p className="text-stone-500">Signing you in...</p>
      </div>
    </div>
  );
}
