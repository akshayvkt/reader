import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(new URL('/auth-error?error=' + error, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth-error?error=no_code', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing Google OAuth credentials');
    return NextResponse.redirect(new URL('/auth-error?error=config', request.url));
  }

  // Determine redirect URI (must match what was used in login)
  const isDev = process.env.NODE_ENV === 'development';
  const baseUrl = isDev
    ? 'http://localhost:3000'
    : 'https://reader-g6kh.onrender.com';
  const redirectUri = `${baseUrl}/api/auth/callback`;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(new URL('/auth-error?error=token_exchange', request.url));
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info');
      return NextResponse.redirect(new URL('/auth-error?error=user_info', request.url));
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();

    // Create our JWT token
    const jwt = await signToken({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    });

    // Check if this is from Electron (custom protocol) or web
    const isElectron = state === 'electron';

    if (isElectron) {
      // Redirect to custom protocol for Electron to catch
      return NextResponse.redirect(`simplereader://auth?token=${jwt}`);
    } else {
      // For web: redirect to a page that stores the token and redirects to app
      // We use a simple HTML page that stores in localStorage then redirects
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Signing in...</title>
            <style>
              body {
                font-family: system-ui, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #FAF7F2;
                color: #2D2A26;
              }
              .container {
                text-align: center;
              }
              .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #E8E2D9;
                border-top-color: #C4785C;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 16px;
              }
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="spinner"></div>
              <p>Signing you in...</p>
            </div>
            <script>
              localStorage.setItem('auth_token', '${jwt}');
              window.location.href = '/';
            </script>
          </body>
        </html>
      `;

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/auth-error?error=unknown', request.url));
  }
}
