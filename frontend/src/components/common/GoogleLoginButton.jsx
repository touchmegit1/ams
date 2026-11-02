import { useEffect, useRef } from 'react';

/**
 * Nút Google Sign-In sử dụng Google Identity Services (GIS).
 *
 * Cần config GOOGLE_CLIENT_ID ở backend + frontend.
 * Nếu chưa có client ID → hiện nút placeholder báo chưa config.
 */

// ⚠️ ĐỔI THÀNH CLIENT ID CỦA BẠN (lấy từ Google Cloud Console)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
let initializedClientId = '';
let activeSuccessHandler = null;

function GoogleLoginButton({ onSuccess }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;
    activeSuccessHandler = onSuccess;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      if (initializedClientId !== GOOGLE_CLIENT_ID) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) activeSuccessHandler?.(response.credential);
          },
        });
        initializedClientId = GOOGLE_CLIENT_ID;
      }

      const width = Math.min(400, Math.max(120, Math.floor(buttonRef.current?.clientWidth || 320)));
      if (!buttonRef.current || buttonRef.current.dataset.renderedWidth === String(width)) return;
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'signin_with',
        width: String(width), logo_alignment: 'center',
      });
      buttonRef.current.dataset.renderedWidth = String(width);
    };

    let script;
    if (!window.google?.accounts?.id) {
      script = document.getElementById('ams-google-sdk');
      if (!script) {
        script = document.createElement('script');
        script.id = 'ams-google-sdk';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', initGoogle);
    }

    const resizeObserver = new ResizeObserver(initGoogle);
    if (buttonRef.current) resizeObserver.observe(buttonRef.current);
    initGoogle();

    return () => {
      script?.removeEventListener('load', initGoogle);
      resizeObserver.disconnect();
      if (activeSuccessHandler === onSuccess) activeSuccessHandler = null;
    }
  }, [onSuccess]);

  // Chưa config Google Client ID → hiện nút placeholder
  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        className="btn btn-google"
        onClick={() => alert('Chưa cấu hình Google Client ID.\n\nTạo file .env ở frontend với:\nVITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com\n\nLấy Client ID từ: https://console.cloud.google.com/apis/credentials')}
      >
        Đăng nhập bằng Google
      </button>
    );
  }

  return (
    <div
      ref={buttonRef}
      style={{ display: 'flex', justifyContent: 'center', marginTop: 12, width: '100%', maxWidth: 400, marginInline: 'auto' }}
    />
  );
}

export default GoogleLoginButton;
