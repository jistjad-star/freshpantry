import { Leaf, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="fresh-card-static p-8 text-center">
          {/* Logo */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#4A7C59]/10 flex items-center justify-center">
            <Leaf className="w-10 h-10 text-[#4A7C59]" />
          </div>
          
          <h1 className="font-display text-3xl font-bold text-[#1A2E1A] mb-2">
            Fresh Pantry
          </h1>
          <p className="text-stone-500 mb-8">
            Sign in to save your recipes and pantry across devices
          </p>

          {/* Google Sign In Button */}
          <Button
            onClick={login}
            className="w-full btn-primary py-6 text-base"
            data-testid="google-login-btn"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="mt-8 pt-6 border-t border-stone-200">
            <p className="text-sm text-stone-500">
              <Sparkles className="w-4 h-4 inline mr-1 text-[#4A7C59]" />
              Your data syncs automatically across all your devices
            </p>
          </div>
        </div>

        {/* Continue without account */}
        <div className="mt-6 text-center">
          <a 
            href="/"
            className="text-sm text-stone-500 hover:text-[#4A7C59] transition-colors"
            data-testid="continue-without-account"
          >
            Continue without an account →
          </a>
        </div>
      </div>
    </div>
  );
}
