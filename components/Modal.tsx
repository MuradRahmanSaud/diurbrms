
import React, { useEffect, useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subTitle?: React.ReactNode;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
  footerContent?: React.ReactNode;
  zIndex?: number;
  maxWidthClass?: string;
  heightClass?: string;
  hideHeader?: boolean;
  bodyClassName?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subTitle, headerContent, children, footerContent, zIndex = 50, maxWidthClass = 'max-w-5xl', heightClass = 'min-h-[75vh] max-h-[90vh]', hideHeader = false, bodyClassName }) => {
  const [showModalContent, setShowModalContent] = useState(false);
  const [animateState, setAnimateState] = useState(false);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      setShowModalContent(true);
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscapeKey);
      
      const openTimer = setTimeout(() => {
        setAnimateState(true);
      }, 10);

      return () => {
        clearTimeout(openTimer);
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen && showModalContent) {
      setAnimateState(false);
      const closeTimer = setTimeout(() => {
        setShowModalContent(false);
      }, 300);

      return () => clearTimeout(closeTimer);
    }
  }, [isOpen, showModalContent]);

  if (!showModalContent) {
    return null;
  }
  
  const finalBodyClassName = bodyClassName ?? "p-3 sm:p-4 flex-grow overflow-y-auto custom-scrollbar";

  return (
    <div
      className={`
        fixed inset-0 flex items-center justify-center bg-black backdrop-blur-sm
        transition-opacity duration-300 ease-out
        ${animateState ? 'bg-opacity-60 opacity-100' : 'bg-opacity-0 opacity-0 pointer-events-none'}
      `}
      style={{ zIndex }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={!headerContent && title ? "modal-title" : undefined}
      aria-describedby={!headerContent && subTitle ? "modal-subtitle" : undefined}
    >
      <div
        className={`
          bg-white rounded-lg shadow-xl w-full ${maxWidthClass} ${heightClass} flex flex-col overflow-hidden
          transform transition-all duration-300 ease-out
          ${animateState ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-full'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        {!hideHeader && (
          <div className="flex items-start justify-between p-2 sm:p-3 border-b border-gray-200 flex-shrink-0">
            {headerContent ? (
                <div className="flex-grow min-w-0">{headerContent}</div>
            ) : (
              <div className="flex-grow min-w-0">
                <h3 id="modal-title" className="text-md sm:text-lg font-semibold text-teal-700 truncate" title={typeof title === 'string' ? title : undefined}>
                  {title}
                </h3>
                {subTitle && (
                  <p id="modal-subtitle" className="text-xs text-gray-500 mt-0.5 truncate" title={typeof subTitle === 'string' ? subTitle : undefined}>
                    {subTitle}
                  </p>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors ml-2 flex-shrink-0"
              aria-label="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}


        {/* Modal Body (Scrollable) */}
        <div className={finalBodyClassName}>
          {children}
        </div>

        {/* Modal Footer (Optional) */}
        {footerContent && (
          <div className="p-2 sm:p-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            {footerContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
