import React from 'react';

const Footer = () => {
    return (
        <div className="w-full text-center py-2 bg-white/80 backdrop-blur-sm border-t border-gray-100">
            <p className="text-xs text-gray-400">
                Powered by{' '}
                <a
                    href="https://www.botivate.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 font-medium hover:underline hover:text-blue-600 transition-colors"
                >
                    Botivate
                </a>
            </p>
        </div>
    );
};

export default Footer;
