import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const dummyCredentials = [
    { role: 'Admin', email: 'admin@rbrms.com', password: '100001', avatar: '👑' },
    { role: 'Moderator', email: 'moderator@rbrms.com', password: '200001', avatar: '🛡️' },
    { role: 'Routine Organizer', email: 'organizer@rbrms.com', password: '300001', avatar: '📋' },
    { role: 'Coordination Officer', email: 'co@rbrms.com', password: '400001', avatar: '🤝' },
    { role: 'Teacher', email: 'teacher@rbrms.com', password: '500001', avatar: '🧑‍🏫' },
    { role: 'User', email: 'user@rbrms.com', password: '600001', avatar: '👤' },
    { role: 'Student', email: 'student@rbrms.com', password: '700001', avatar: '🎓' },
];


const LoginScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('admin@rbrms.com');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('100001');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup } = useAuth();

  const handleModeSwitch = () => {
    setError(null);
    if (mode === 'login') {
      // Switching to signup mode, clear fields
      setName('');
      setEmail('');
      setEmployeeId('');
      setPassword('');
      setConfirmPassword('');
      setMode('signup');
    } else {
      // Switching to login mode, pre-fill admin credentials
      setName('');
      setEmail('admin@rbrms.com');
      setEmployeeId('');
      setPassword('100001');
      setConfirmPassword('');
      setMode('login');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (mode === 'signup') {
      if (!name.trim()) {
        setError("Name is required.");
        setIsLoading(false);
        return;
      }
      if (!employeeId.trim()) {
        setError("Employee ID is required.");
        setIsLoading(false);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        setError("Please enter a valid email address.");
        setIsLoading(false);
        return;
      }
      
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setIsLoading(false);
        return;
      }
      try {
        await signup({ name, email, password_plaintext: password, employeeId }, true);
        // On successful signup, App component will re-render due to user state change
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred during signup.');
      } finally {
        setIsLoading(false);
      }
    } else { // mode === 'login'
      try {
        await login(email, password);
        // On successful login, the App component will automatically re-render
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred during login.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const loginForm = (
    <>
      <div>
        <label htmlFor="email-address" className="sr-only">Email address</label>
        <input id="email-address" name="email" type="email" autoComplete="email" required
          className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
          placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password-field" className="sr-only">Password</label>
        <input id="password-field" name="password" type="password" autoComplete="current-password" required
          className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
          placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
    </>
  );

  const signupForm = (
    <>
      <div>
        <label htmlFor="name" className="sr-only">Full Name</label>
        <input id="name" name="name" type="text" autoComplete="name" required
          className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
          placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="email-address-signup" className="sr-only">Email address</label>
        <input id="email-address-signup" name="email" type="email" autoComplete="email" required
          className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
          placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
       <div>
        <label htmlFor="employee-id" className="sr-only">Employee ID</label>
        <input id="employee-id" name="employee-id" type="text" autoComplete="off" required
          className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
          placeholder="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password-signup" className="sr-only">Password</label>
        <input id="password-signup" name="password" type="password" autoComplete="new-password" required
          className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
          placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
        <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required
          className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-teal-500 focus:border-teal-500 focus:z-10 sm:text-sm"
          placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>
    </>
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 font-inter">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center">
            <div className="flex justify-center items-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-teal-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM6 7a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
            </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {mode === 'login' ? 'Welcome to RBRMS' : 'Create an Account'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {mode === 'login' ? 'Please sign in to continue' : 'Enter your details to register'}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          <div className="rounded-md shadow-sm -space-y-px">
            {mode === 'login' ? loginForm : signupForm}
          </div>

          {error && (
            <div className="p-2 text-sm text-red-700 bg-red-100 rounded-md" role="alert">
              {error}
            </div>
          )}
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400"
            >
              {isLoading && (
                  <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
              )}
              {isLoading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign in' : 'Create Account')}
            </button>
          </div>
        </form>

        <div className="text-center text-sm text-gray-600">
            {mode === 'login' ? (
                <>
                    Don't have an account?{' '}
                    <button onClick={handleModeSwitch} className="font-medium text-teal-600 hover:text-teal-500">
                        Sign up
                    </button>
                </>
            ) : (
                <>
                    Already have an account?{' '}
                    <button onClick={handleModeSwitch} className="font-medium text-teal-600 hover:text-teal-500">
                        Sign in
                    </button>
                </>
            )}
        </div>
         <div className="text-center text-xs text-gray-500 border-t pt-4">
            <p className="font-bold mb-2">Quick Logins for Testing:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {dummyCredentials.map(cred => (
                    <button 
                        key={cred.email} 
                        onClick={() => { setEmail(cred.email); setPassword(cred.password); }}
                        className="p-2 border border-gray-200 rounded-md hover:bg-teal-50 hover:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-150"
                    >
                        <p className="font-semibold text-sm text-gray-800 flex items-center gap-2">
                            <span className="text-lg">{cred.avatar}</span>
                            {cred.role}
                        </p>
                        <p className="text-[11px] text-gray-600 mt-1 truncate" title={cred.email}>
                            <span className="font-medium">Email:</span> {cred.email}
                        </p>
                        <p className="text-[11px] text-gray-600" title={cred.password}>
                             <span className="font-medium">Pass:</span> {cred.password}
                        </p>
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;