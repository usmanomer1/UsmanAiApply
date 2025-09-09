import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getMaintenanceConfig, isAdminEmail } from '../lib/maintenance';
import toast from 'react-hot-toast';
import { identify, track, reset } from '../lib/analytics';

interface AuthContextType {
	user: User | null;
	loading: boolean;
	signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
	signUp: (email: string, password: string, fullName: string, captchaToken?: string) => Promise<void>;
	signOut: () => Promise<void>;
	resendEmailVerification: (email: string, captchaToken?: string) => Promise<void>;
	changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		const initializeAuth = async () => {
			try {
				if (!isSupabaseConfigured()) {
					if (mounted) {
						setLoading(false);
					}
					return;
				}

				// Get initial session
				const { data: { session }, error } = await supabase.auth.getSession();
				
				if (error) {
					console.error('Error getting session:', error);
					if (mounted) {
						setLoading(false);
					}
					return;
				}
				
				if (mounted) {
					setUser(session?.user ?? null);
					setLoading(false);
					if (session?.user) {
						const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || (session.user.email ? session.user.email.split('@')[0] : undefined);
						identify(session.user.id, { $email: session.user.email || undefined, $name: fullName });
					}
				}

				// Listen for auth changes
				const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
					if (mounted) {
						setUser(session?.user ?? null);
						setLoading(false);
					}
					if (session?.user) {
						const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || (session.user.email ? session.user.email.split('@')[0] : undefined);
						identify(session.user.id, { $email: session.user.email || undefined, $name: fullName });
						track('AUTH_SESSION_CHANGE', { event, authenticated: true });
					} else {
						track('AUTH_SESSION_CHANGE', { event, authenticated: false });
						reset();
					}
				});

				return () => {
					subscription.unsubscribe();
				};
			} catch (error) {
				console.error('Error initializing auth:', error);
				if (mounted) {
					setLoading(false);
				}
			}
		};

		// Add a timeout to ensure loading doesn't hang
		const timeout = setTimeout(() => {
			if (mounted) {
				setLoading(false);
			}
		}, 3000);

		initializeAuth();

		return () => {
			mounted = false;
			clearTimeout(timeout);
		};
	}, []);

	const signIn = async (email: string, password: string, captchaToken?: string) => {
		setLoading(true);
		try {
			if (!isSupabaseConfigured()) {
				toast.error('Authentication service not configured. Please check your environment variables.');
				throw new Error('Supabase not configured');
			}

			// Check maintenance mode
			const { isMaintenanceMode, maintenanceMessage } = getMaintenanceConfig();
			if (isMaintenanceMode && !isAdminEmail(email)) {
				toast.error(maintenanceMessage);
				throw new Error('Maintenance mode');
			}

			// Skip CAPTCHA in development mode
			const isCaptchaDisabled = import.meta.env.VITE_DISABLE_CAPTCHA === 'true';
			
			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
				options: (!isCaptchaDisabled && captchaToken) ? { captchaToken } : undefined,
			});

			if (error) {
				// Check if it's an email verification error
				if (error.message.includes('Email not confirmed') || error.message.includes('email address is not confirmed')) {
					const verificationError = new Error('email_not_verified');
					(verificationError as any).email = email;
					(verificationError as any).originalMessage = error.message;
					toast.error('Your email isn\'t verified. Please check your inbox or resend the verification email.');
					throw verificationError;
				}
				
				toast.error(error.message);
				throw error;
			}

			toast.success('Welcome back!');
			track('AUTH_SIGN_IN', { method: 'password' });
			
			// Get the current session to ensure user is set
			const { data: { session } } = await supabase.auth.getSession();
			if (session?.user) {
				setUser(session.user);
				const fullName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || (session.user.email ? session.user.email.split('@')[0] : undefined);
				identify(session.user.id, { $email: session.user.email || undefined, $name: fullName });
			}
		} catch (error) {
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const signUp = async (email: string, password: string, fullName: string, captchaToken?: string) => {
		setLoading(true);
		try {
			if (!isSupabaseConfigured()) {
				toast.error('Authentication service not configured. Please check your environment variables.');
				throw new Error('Supabase not configured');
			}

			// Check maintenance mode for new registrations
			const { isMaintenanceMode, maintenanceMessage } = getMaintenanceConfig();
			if (isMaintenanceMode) {
				toast.error(maintenanceMessage);
				throw new Error('Maintenance mode');
			}

			// Skip CAPTCHA in development mode
			const isCaptchaDisabled = import.meta.env.VITE_DISABLE_CAPTCHA === 'true';
			
			const { error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						name: fullName,
						full_name: fullName,
					},
					...(!isCaptchaDisabled && captchaToken ? { captchaToken } : {}),
				},
			});

			if (error) {
				toast.error(error.message);
				throw error;
			}

			toast.success('Account created successfully! Please check your email to verify your account.');
			track('AUTH_SIGN_UP', { method: 'password' });
		} catch (error) {
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const signOut = async () => {
		try {
			if (isSupabaseConfigured()) {
				const { error } = await supabase.auth.signOut();
				
				if (error) {
					// Check if it's just a session missing error (normal when session expired)
					if (error.message.includes('Auth session missing')) {
						// This is normal - session was already cleared/expired
						setUser(null);
						toast.success('Signed out successfully');
						return;
					}
					
					toast.error(error.message);
					throw error;
				}
			}

			setUser(null);
			toast.success('Signed out successfully');
			track('AUTH_SIGN_OUT');
			reset();
		} catch (error) {
			console.error('Error signing out:', error);
			// Force sign out even if there's an error
			setUser(null);
			toast.success('Signed out successfully');
		}
	};

	const resendEmailVerification = async (email: string, captchaToken?: string) => {
		try {
			if (!isSupabaseConfigured()) {
				toast.error('Authentication service not configured. Please check your environment variables.');
				throw new Error('Supabase not configured');
			}

			// Skip CAPTCHA in development mode
			const isCaptchaDisabled = import.meta.env.VITE_DISABLE_CAPTCHA === 'true';

			const { error } = await supabase.auth.resend({
				type: 'signup',
				email: email,
				options: (!isCaptchaDisabled && captchaToken) ? { captchaToken } : undefined,
			});

			if (error) {
				toast.error(error.message);
				throw error;
			}

			toast.success('Verification email sent! Please check your inbox.');
		} catch (error) {
			throw error;
		}
	};

	const changePassword = async (newPassword: string) => {
		try {
			if (!isSupabaseConfigured()) {
				toast.error('Authentication service not configured. Please check your environment variables.');
				throw new Error('Supabase not configured');
			}

			if (!user) {
				toast.error('You must be logged in to change your password.');
				throw new Error('User not authenticated');
			}

			const { error } = await supabase.auth.updateUser({
				password: newPassword
			});

			if (error) {
				toast.error(error.message);
				throw error;
			}

			toast.success('Password updated successfully!');
		} catch (error) {
			throw error;
		}
	};

	return (
		<AuthContext.Provider value={{
			user,
			loading,
			signIn,
			signUp,
			signOut,
			resendEmailVerification,
			changePassword,
		}}>
			{children}
		</AuthContext.Provider>
	);
};