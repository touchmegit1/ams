import { useEffect, useRef } from 'react';

/**
 * Nút Google Sign-In sử dụng Google Identity Services (GIS).
 *
 * Cần config GOOGLE_CLIENT_ID ở backend + frontend.
 * Nếu chưa có client ID → hiện nút placeholder báo chưa config.
 */

// ⚠️ ĐỔI THÀNH CLIENT ID CỦA BẠN (lấy từ Google Cloud Console)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function GoogleLoginButton({ onSuccess }) {
  const buttonRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || initialized.current) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response.credential) {
            onSuccess(response.credential);
          }
        },
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: '100%',
        logo_alignment: 'center',
      });

      initialized.current = true;
    };

    // Nếu SDK đã load rồi
    if (window.google?.accounts?.id) {
      initGoogle();
    } else {
      // Load Google only where its button is used, never on recovery pages.
      let script = document.getElementById('ams-google-sdk');
      if (!script) {
        script = document.createElement('script');
        script.id = 'ams-google-sdk';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', initGoogle);
      return () => script.removeEventListener('load', initGoogle);
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
      style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}
    />
  );
}

export default GoogleLoginButton;
