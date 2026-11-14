(function (global) {
  'use strict';

  function createAccountAuth({ supabaseUrl, supabaseKey, getSession, saveSession }) {
    if (!supabaseUrl || !supabaseKey) throw new Error('Account authentication configuration is incomplete.');

    function authHeaders() {
      const session = getSession();
      return {
        apikey: supabaseKey,
        Authorization: `Bearer ${session?.access_token || supabaseKey}`,
        'Content-Type': 'application/json'
      };
    }

    async function authRequest(path, body) {
      const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
        method: 'POST',
        headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.msg || data?.message || data?.error_description || 'Authentication failed.');
      }
      return data;
    }

    function appRedirectUrl() {
      return `${window.location.origin}${window.location.pathname}${window.location.search}`;
    }

    function clearAuthRedirectArtifacts() {
      const url = new URL(window.location.href);
      for (const key of ['error', 'error_code', 'error_description', 'code', 'type']) {
        url.searchParams.delete(key);
      }
      url.hash = '';
      history.replaceState(history.state, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ''));
    }

    function importAuthRedirectSession() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, '').trim());
      const query = new URLSearchParams(window.location.search);
      const errorDescription = hash.get('error_description') || query.get('error_description');
      if (errorDescription) {
        sessionStorage.setItem('abilityChessAuthMessage', decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
        clearAuthRedirectArtifacts();
        return false;
      }

      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      if (!accessToken) return false;

      const expiresIn = Number(hash.get('expires_in') || 3600);
      saveSession({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: hash.get('token_type') || 'bearer',
        expires_in: expiresIn,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn
      });

      const authType = hash.get('type') || query.get('type');
      if (authType === 'recovery') {
        sessionStorage.setItem('abilityChessRecoveryMode', '1');
        sessionStorage.setItem('abilityChessAuthMessage', 'Password-reset link accepted. Choose a new password below.');
      } else {
        sessionStorage.setItem('abilityChessAuthMessage', 'Email confirmed. You are now signed in.');
      }
      clearAuthRedirectArtifacts();
      return true;
    }

    return { authHeaders, authRequest, appRedirectUrl, clearAuthRedirectArtifacts, importAuthRedirectSession };
  }

  global.AbilityChessAccountAuth = Object.freeze({ createAccountAuth });
})(window);

