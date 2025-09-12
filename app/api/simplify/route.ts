import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Get configuration from environment variables
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION || 'us-central1';
    const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GCP_PRIVATE_KEY;
    const privateKeyId = process.env.GCP_PRIVATE_KEY_ID;

    if (!projectId || !serviceAccountEmail || !privateKey) {
      return NextResponse.json(
        { error: 'Google Cloud configuration missing. Please set GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_EMAIL, and GCP_PRIVATE_KEY in .env.local' },
        { status: 500 }
      );
    }

    // Construct the service account credentials object
    const credentials = {
      type: 'service_account',
      project_id: projectId,
      private_key_id: privateKeyId,
      private_key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
      client_email: serviceAccountEmail,
      client_id: '', // Not required for auth
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(serviceAccountEmail)}`
    };

    // Initialize auth client with the credentials
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    // Get access token
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    if (!accessToken || !accessToken.token) {
      return NextResponse.json(
        { error: 'Failed to authenticate with Google Cloud' },
        { status: 500 }
      );
    }

    // Call Vertex AI API directly
    const model = 'gemini-1.5-flash'; // Using stable model name
    const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{
          text: `You are a helpful reading assistant. Your job is to simplify complex or confusing text into plain, easy-to-understand English.

Text to simplify: "${text}"

Instructions:
- If it's a single word, provide a simple definition
- If it's a phrase or sentence, rewrite it in simpler terms
- Keep the meaning intact but make it accessible to a general reader
- Be concise - aim for clarity, not length
- Don't add extra commentary, just provide the simplified version

Simplified version:`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vertex AI API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to call Vertex AI', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract the text from the Vertex AI response
    const simplified = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to simplify text';

    return NextResponse.json({ simplified });
  } catch (error) {
    console.error('Error simplifying text:', error);
    return NextResponse.json(
      { error: 'Failed to simplify text', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}