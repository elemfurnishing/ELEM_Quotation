import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContainer = () => {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out animate-in slide-in-from-right-full
            ${toast.type === 'success' ? 'bg-white border-l-4 border-green-500' : ''}
            ${toast.type === 'error' ? 'bg-white border-l-4 border-red-500' : ''}
            ${toast.type === 'info' ? 'bg-white border-l-4 border-blue-500' : ''}
          `}
                    role="alert"
                >
                    {/* Icon */}
                    <div className="flex-shrink-0">
                        {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                    </div>

                    {/* Message */}
                    <div className="flex-1 mr-2">
                        <p className="text-sm font-medium text-gray-800">
                            {toast.message}
                        </p>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
