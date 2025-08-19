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

const InputField = ({ id, name, type, placeholder, value, onChange, icon, children }: { id: string, name: string, type: string, placeholder: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, icon: React.ReactNode, children?: React.ReactNode }) => (
    <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
        </div>
        <input
            id={id}
            name={name}
            type={type}
            required
            className="w-full pl-10 pr-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent sm:text-sm transition-shadow"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
        />
        {children}
    </div>
);

const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('admin@rbrms.com');
    const [password, setPassword] = useState('100001');
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred during login.');
        } finally {
            setIsLoading(false);
        }
    };

    const animationStyle = (delay: number) => ({
        animationDelay: `${delay}ms`,
        animationFillMode: 'forwards',
    } as React.CSSProperties);

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center font-inter p-4">
            <div className="w-full max-w-5xl flex rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up" style={animationStyle(0)}>
                {/* Left Panel */}
                <div className="hidden md:flex w-1/2 bg-gradient-to-br from-teal-600 to-teal-800 p-12 flex-col justify-between text-white relative overflow-hidden">
                    <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full"></div>
                    <div className="absolute -bottom-16 -right-10 w-40 h-40 bg-white/10 rounded-full"></div>
                    <div className="z-10">
                        <div className="flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM6 7a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            <span className="text-2xl font-bold">RBRMS</span>
                        </div>
                        <p className="mt-4 text-teal-200">Routine Based Room Management System</p>
                         <p className="mt-6 text-sm text-teal-100/90 border-l-2 border-teal-400 pl-4">
                            This system offers a comprehensive solution for managing academic schedules and room allocations. It simplifies the complex process of routine creation, ensuring optimal use of resources, minimizing conflicts, and providing a clear, accessible interface for administrators, faculty, and students.
                        </p>
                    </div>
                    <div className="z-10 text-xs text-teal-300">
                        &copy; {new Date().getFullYear()} Daffodil International University. All rights reserved.
                    </div>
                </div>

                {/* Right Panel (Form) */}
                <div className="w-full md:w-1/2 bg-white p-8 sm:p-12 space-y-6 flex flex-col justify-center">
                    <div className="text-center animate-fade-in-up" style={animationStyle(100)}>
                        <h1 className="text-3xl font-bold text-gray-900">Welcome Back!</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Sign in to access the dashboard.
                        </p>
                    </div>

                    <form className="space-y-4 animate-fade-in-up" style={animationStyle(200)} onSubmit={handleSubmit} noValidate>
                        <InputField id="email" name="email" type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>} />
                        <InputField id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>}>
                            <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                                {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781z" clipRule="evenodd" /><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A10.025 10.025 0 00.458 10c1.274 4.057 5.022 7 9.542 7 .847 0 1.669-.101 2.454-.293z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>}
                            </button>
                        </InputField>
                        {error && <div className="p-2 text-xs text-red-700 bg-red-100 rounded-md" role="alert">{error}</div>}
                        <div>
                            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400 transition-colors">
                                {isLoading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                {isLoading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </div>
                    </form>

                    <div className="text-center text-xs text-gray-500 border-t pt-4 animate-fade-in-up" style={animationStyle(400)}>
                        <p className="font-bold mb-2">Quick Logins for Testing:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {dummyCredentials.map(cred => (
                                <button key={cred.email} onClick={() => { setEmail(cred.email); setPassword(cred.password); }} className="p-2 border border-gray-200 rounded-md hover:bg-teal-50 hover:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all duration-150 text-left">
                                    <p className="font-semibold text-xs text-gray-800 flex items-center gap-1.5"><span className="text-base">{cred.avatar}</span> {cred.role}</p>
                                    <p className="text-[10px] text-gray-500 mt-1 truncate" title={`Email: ${cred.email}, Pass: ${cred.password}`}>Email & Pass Pre-fill</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
