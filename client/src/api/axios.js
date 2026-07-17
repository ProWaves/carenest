// ==========================================================================
// axios.js — Pre-configured Axios Client
// ==========================================================================
// Sets baseURL based on environment (production or development).
// Request interceptor: attaches JWT from localStorage to every request.
// Response interceptor: on 401, clears stored session and redirects to /login.
// ==========================================================================

import axios from 'axios';

// ============================================
// BASE URL CONFIGURATION
// ============================================
// In development: uses Vite proxy (/api)
// In production: uses the full backend URL from environment variables
// ============================================
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance with default config
const API = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies/sessions in production
});

// ============================================
// REQUEST INTERCEPTOR
// ============================================
// Attaches JWT token to every outgoing request.
// Also logs requests in development mode.
// ============================================
API.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add it to headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`🚀 [API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        params: config.params,
        headers: config.headers,
      });
    }

    return config;
  },
  (error) => {
    console.error('❌ [API Request Error]', error);
    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE INTERCEPTOR
// ============================================
// Handles responses and errors globally.
// On 401: clears session and redirects to login.
// On 500: logs error and shows user-friendly message.
// ============================================
API.interceptors.response.use(
  (response) => {
    // Log successful response in development
    if (import.meta.env.DEV) {
      console.log(`✅ [API Response] ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }
    return response;
  },
  (error) => {
    // Handle network errors (no response from server)
    if (!error.response) {
      console.error('🌐 [Network Error]', error.message);
      return Promise.reject({
        ...error,
        userMessage: 'Network error. Please check your connection and try again.',
      });
    }

    // Log error details
    console.error(`❌ [API Error] ${error.config?.url}`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    // ============================================
    // HANDLE 401 UNAUTHORIZED
    // ============================================
    if (error.response?.status === 401) {
      // Clear session
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Don't redirect for health checks or public endpoints
      const isPublicEndpoint = error.config?.url?.includes('/health') || 
                               error.config?.url?.includes('/cities') ||
                               error.config?.url?.includes('/skills');
      
      // Redirect to login if not already there and not a public endpoint
      if (!isPublicEndpoint && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      
      return Promise.reject({
        ...error,
        userMessage: 'Your session has expired. Please log in again.',
      });
    }

    // ============================================
    // HANDLE 403 FORBIDDEN
    // ============================================
    if (error.response?.status === 403) {
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          'You do not have permission to perform this action.';
      
      // Check if account is deactivated or suspended
      if (error.response?.data?.error === 'account_deactivated') {
        return Promise.reject({
          ...error,
          userMessage: 'Your account has been deactivated. Please contact support.',
          accountStatus: 'deactivated',
        });
      }
      
      if (error.response?.data?.error === 'account_suspended') {
        return Promise.reject({
          ...error,
          userMessage: error.response?.data?.message || 'Your account has been suspended.',
          accountStatus: 'suspended',
          suspensionReason: error.response?.data?.suspensionReason,
          suspensionEndDate: error.response?.data?.suspensionEndDate,
        });
      }
      
      if (error.response?.data?.admin_disabled) {
        return Promise.reject({
          ...error,
          userMessage: 'Location sharing has been disabled by an administrator.',
          admin_disabled: true,
        });
      }
      
      return Promise.reject({
        ...error,
        userMessage: errorMessage,
      });
    }

    // ============================================
    // HANDLE 404 NOT FOUND
    // ============================================
    if (error.response?.status === 404) {
      // Don't show error for profile not found - let it render gracefully
      if (error.config?.url?.includes('/babysitters/')) {
        return Promise.reject({
          ...error,
          userMessage: 'Babysitter not found.',
          notFound: true,
        });
      }
      
      return Promise.reject({
        ...error,
        userMessage: error.response?.data?.message || 'The requested resource was not found.',
      });
    }

    // ============================================
    // HANDLE 500 INTERNAL SERVER ERROR
    // ============================================
    if (error.response?.status === 500) {
      console.error('🔥 [Server Error]', error.response?.data);
      return Promise.reject({
        ...error,
        userMessage: 'Server error. Please try again later or contact support.',
        serverMessage: error.response?.data?.message || error.response?.data?.error,
      });
    }

    // ============================================
    // HANDLE 429 TOO MANY REQUESTS
    // ============================================
    if (error.response?.status === 429) {
      return Promise.reject({
        ...error,
        userMessage: 'Too many requests. Please wait a moment and try again.',
      });
    }

    // ============================================
    // HANDLE VALIDATION ERRORS (422)
    // ============================================
    if (error.response?.status === 422) {
      const errors = error.response?.data?.errors || {};
      const errorMessages = Object.values(errors).flat().join(', ');
      return Promise.reject({
        ...error,
        userMessage: errorMessages || 'Validation error. Please check your input.',
        validationErrors: errors,
      });
    }

    // ============================================
    // DEFAULT ERROR HANDLER
    // ============================================
    const defaultMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          'An unexpected error occurred. Please try again.';
    
    return Promise.reject({
      ...error,
      userMessage: defaultMessage,
    });
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

// For file uploads (multipart/form-data)
export const uploadFile = (url, file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  return API.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });
};

// For image uploads with preview
export const uploadImage = (url, file, onProgress) => {
  const formData = new FormData();
  formData.append('image', file);

  return API.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });
};

// For document uploads
export const uploadDocument = (url, file, documentType, onProgress) => {
  const formData = new FormData();
  formData.append('document', file);
  if (documentType) {
    formData.append('document_type', documentType);
  }

  return API.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  return !!token;
};

// Get current user from localStorage
export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

// Clear session
export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// ============================================
// EXPORT
// ============================================
export default API;