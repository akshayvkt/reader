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
    const model = 'gemini-2.5-flash'; // Using latest model
    const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{
          text: `You are an expert reading companion helping someone understand complex literature. The reader is intelligent but wants clarity on dense, archaic, or overly complex prose.

Selected text: "${text}"

Provide a clear, modern English explanation that:
- Preserves the original meaning and nuance
- Uses everyday language a smart reader would understand  
- For single words: Give a concise definition in context
- For phrases/sentences: Rewrite in plain, contemporary English
- For technical/specialized terms: Explain what it means in this context
- Keep explanations brief but complete (1-2 sentences max)
- Match the tone - if it's dramatic prose, keep some drama; if technical, stay precise

Example transformations:
"a nanophone was hidden somewhere in the lace collar of her pinafore" → "She had a tiny communication device hidden in the lace collar of her dress"
"perspicacious" → "having keen insight or good judgment"
"The edifice stood athwart the thoroughfare" → "The building stood across/blocking the street"

Your explanation:`
        }]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 300,
        topP: 0.95,
        topK: 40,
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