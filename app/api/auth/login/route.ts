import { NextRequest, NextResponse } from 'next/server';

// Redirect to Google OAuth consent screen
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 500 }
    );
  }

  // Check if this is from Electron (will use custom protocol callback)
  const isElectron = request.nextUrl.searchParams.get('electron') === 'true';

  // Determine the base URL for callback
  const isDev = process.env.NODE_ENV === 'development';
  const baseUrl = isDev
    ? 'http://localhost:3000'
    : 'https://reader-g6kh.onrender.com';

  const redirectUri = `${baseUrl}/api/auth/callback`;

  // Build Google OAuth URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');

  // Pass along whether this is Electron so callback knows where to redirect
  googleAuthUrl.searchParams.set('state', isElectron ? 'electron' : 'web');

  return NextResponse.redirect(googleAuthUrl.toString());
}
