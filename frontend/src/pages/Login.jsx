import { useState, useEffect } from 'react';
import {
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import loginBg from '../assets/login-bg.jpg';
import rootfinLogoText from '../assets/rootfin-logo-text.png';
import rootfinLogoArrow from '../assets/rootfin-logo-arrow.png';
import baseUrl from '../api/api';

const Login = () => {
  const [isResetMode, setIsResetMode] = useState(false);

  // Login Form States
  const [email, setEmail] = useState('');
  const [EmpId, setEmpId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Reset Password Form States
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Common States
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load remembered email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('rootfin_saved_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setResetEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (e) {
      console.warn('Unable to access localStorage for saved email', e);
    }
  }, []);

  // Switch back to login mode
  const handleBackToLogin = () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsResetMode(false);
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedEmail = email.trim();
    const trimmedEmpId = EmpId.trim();

    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (!trimmedEmpId) {
      setErrorMessage('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(baseUrl.baseUrl + 'user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedEmpId,
          EmpId: trimmedEmpId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.user) {
        try {
          if (rememberMe) {
            localStorage.setItem('rootfin_saved_email', trimmedEmail);
          } else {
            localStorage.removeItem('rootfin_saved_email');
          }
        } catch (e) {
          // Ignore
        }

        let userObj = { ...data.user };

        localStorage.setItem("rootfinuser", JSON.stringify(userObj));
        if (data.closureAuthToken) localStorage.setItem("rootfin_auth_token", data.closureAuthToken);
        else localStorage.removeItem("rootfin_auth_token");
        setSuccessMessage('Login successful! Redirecting to workspace...');

        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } else {
        setErrorMessage(data.message || 'Invalid credentials. Please verify your details.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error during login:', error);
      setErrorMessage('Server connection error. Please try again.');
      setLoading(false);
    }
  };

  // Handle Password Reset Submit
  const handleResetSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedResetEmail = resetEmail.trim();

    if (!trimmedResetEmail) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (!newPassword) {
      setErrorMessage('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(baseUrl.baseUrl + 'user/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedResetEmail,
          newPassword: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message || 'Password updated successfully! You can now log in.');
        setEmail(trimmedResetEmail);
        setEmpId(newPassword);
        setLoading(false);

        setTimeout(() => {
          setIsResetMode(false);
        }, 1500);
      } else {
        setErrorMessage(data.message || 'Failed to reset password. Please check the email address.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Reset Password Error:', error);
      setErrorMessage('Unable to connect to server. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden bg-[#050308] bg-cover bg-center bg-no-repeat flex flex-col lg:flex-row"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      {/* Left Column: Logo (top-left) + Tagline (bottom-left) */}
      <div className="flex-1 flex flex-col justify-between p-8 sm:p-12 lg:p-16 relative z-10">
        {/* Top-left Animated RootFin Logo */}
        <div>
          <div className="relative inline-flex items-center select-none h-[26px]">
            <img
              src={rootfinLogoText}
              alt="ROOTFIN"
              className="h-[26px] w-auto object-contain block pointer-events-none"
              draggable={false}
            />
            <img
              src={rootfinLogoArrow}
              alt=""
              aria-hidden="true"
              className="rf-logo-arrow absolute inset-0 h-[26px] w-auto object-contain pointer-events-none"
              draggable={false}
            />
          </div>
        </div>

        {/* Bottom-left Display Headline */}
        <div className="mt-12 lg:mt-0 lg:mb-10">
          <h1 className="text-white font-light text-[34px] sm:text-[42px] lg:text-[48px] leading-[1.18] tracking-[-0.02em] max-w-[460px]">
            Manage your
            <br />
            finances with clarity
            <br />
            and confidence.
          </h1>
        </div>
      </div>

      {/* Right Column: Floating White Login Card */}
      <div className="flex items-center justify-center lg:justify-end p-6 sm:p-10 lg:pr-20 xl:pr-28 relative z-10 lg:w-[540px] xl:w-[580px] shrink-0">
        <div className="w-full max-w-[420px] bg-white rounded-[20px] px-8 sm:px-10 py-10 sm:py-12 shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
          {!isResetMode ? (
            <>
              <div className="mb-8">
                <h2 className="text-[24px] font-semibold text-[#1B1B1B] tracking-tight leading-snug">
                  Welcome Back!
                </h2>
                <p className="text-[13px] text-[#7A7A7A] mt-1">
                  Sign in to continue to your RootFin account.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-[12px] text-[#DC2626] flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-5 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-2.5 text-[12px] text-[#15803D] flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-[13px] font-medium text-[#212121] mb-2">
                    Email
                  </label>
                  <div className="flex items-center h-[46px] rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 focus-within:border-[#F2572B] focus-within:ring-2 focus-within:ring-[#F2572B]/15 transition-all">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      autoComplete="email"
                      className="flex-1 h-full text-[13px] text-[#212121] placeholder:text-[#A1A1AA] bg-transparent border-0 outline-none min-w-0"
                    />
                    <span className="h-5 w-[1px] bg-[#EBEBEB] mx-3 shrink-0" />
                    <Mail size={17} className="text-[#F2572B] shrink-0" />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[13px] font-medium text-[#212121] mb-2">
                    Password
                  </label>
                  <div className="flex items-center h-[46px] rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 focus-within:border-[#F2572B] focus-within:ring-2 focus-within:ring-[#F2572B]/15 transition-all">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={EmpId}
                      onChange={(e) => setEmpId(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="flex-1 h-full text-[13px] text-[#212121] placeholder:text-[#A1A1AA] bg-transparent border-0 outline-none min-w-0"
                    />
                    <span className="h-5 w-[1px] bg-[#EBEBEB] mx-3 shrink-0" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-[#F2572B] hover:text-[#D9431A] transition-colors cursor-pointer flex items-center justify-center shrink-0"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Login Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[46px] rounded-full bg-[#1B1B1B] hover:bg-[#2E2E2E] text-white text-[14px] font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Login</span>
                    )}
                  </button>
                </div>
              </form>

              <p className="text-center text-[12px] text-[#8A8A8A] mt-6">
                © 2026 RootFin. All rights reserved.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleBackToLogin}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#7A7A7A] hover:text-[#1B1B1B] mb-5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to Login</span>
              </button>

              <div className="mb-6">
                <h2 className="text-[22px] font-semibold text-[#1B1B1B] tracking-tight">
                  Reset Password
                </h2>
                <p className="text-[13px] text-[#7A7A7A] mt-1">
                  Enter your email and choose a new password.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-[12px] text-[#DC2626] flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="mb-4 rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-2.5 text-[12px] text-[#15803D] flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#212121] mb-1.5">
                    Email
                  </label>
                  <div className="flex items-center h-[44px] rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 focus-within:border-[#F2572B]">
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="flex-1 h-full text-[13px] text-[#212121] placeholder:text-[#A1A1AA] bg-transparent border-0 outline-none min-w-0"
                    />
                    <span className="h-5 w-[1px] bg-[#EBEBEB] mx-3 shrink-0" />
                    <Mail size={16} className="text-[#F2572B] shrink-0" />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#212121] mb-1.5">
                    New Password
                  </label>
                  <div className="flex items-center h-[44px] rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 focus-within:border-[#F2572B]">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="flex-1 h-full text-[13px] text-[#212121] placeholder:text-[#A1A1AA] bg-transparent border-0 outline-none min-w-0"
                    />
                    <span className="h-5 w-[1px] bg-[#EBEBEB] mx-3 shrink-0" />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="text-[#F2572B] cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#212121] mb-1.5">
                    Confirm Password
                  </label>
                  <div className="flex items-center h-[44px] rounded-[10px] border border-[#E5E5E5] bg-white px-3.5 focus-within:border-[#F2572B]">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="flex-1 h-full text-[13px] text-[#212121] placeholder:text-[#A1A1AA] bg-transparent border-0 outline-none min-w-0"
                    />
                    <span className="h-5 w-[1px] bg-[#EBEBEB] mx-3 shrink-0" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="text-[#F2572B] cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-[46px] rounded-full bg-[#1B1B1B] hover:bg-[#2E2E2E] text-white text-[14px] font-semibold transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
