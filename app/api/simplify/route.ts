import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

type ContextScope = 'highlight' | 'chapter' | 'book';

export async function POST(request: NextRequest) {
  try {
    const { text, mode = 'explain', conversationHistory, originalText, scope, scopeContext, chapterTitle } = await request.json() as {
      text: string;
      mode?: 'explain' | 'eli5' | 'followup';
      conversationHistory?: ConversationMessage[];
      originalText?: string;
      scope?: ContextScope;
      scopeContext?: string;
      chapterTitle?: string;
    };

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
    const model = 'gemini-2.5-flash-lite'; // Using lightweight model for faster responses
    const apiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    // Different prompts based on mode
    const prompts = {
      explain: `You are an expert reading companion helping someone understand complex literature. The reader is intelligent but wants clarity on dense, archaic, or overly complex prose.

Text to simplify: "${text}"

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

Simplified explanation (do NOT repeat the original text):`,

      eli5: `You are explaining complex ideas to someone who wants a super simple, easy-to-understand explanation - like you're talking to a smart 5-year-old or complete beginner.

Text to explain: "${text}"

Provide an explanation that:
- Uses the simplest possible words and concepts
- Breaks down complex ideas into basic building blocks
- Uses everyday examples and analogies when helpful
- Avoids jargon completely or explains it in the simplest terms
- Is friendly and conversational
- Keep it brief (2-3 sentences max)

Example transformations:
"quantum entanglement" → "Imagine two magic coins that always land on the same side, even if they're far apart. When one shows heads, the other instantly shows heads too, no matter how far away it is."
"photosynthesis" → "Plants eat sunlight! They use sunshine, air, and water to make their own food and grow."
"perspicacious" → "Really good at noticing things and understanding what they mean."

Simple explanation (do NOT repeat the original text):`,

      followup: (() => {
        // Build context-aware prompt based on scope
        let contextSection = '';
        if (scope === 'chapter' && scopeContext) {
          contextSection = `
You have access to the full chapter${chapterTitle ? ` ("${chapterTitle}")` : ''} for context:

<chapter_context>
${scopeContext.slice(0, 15000)}
</chapter_context>

`;
        } else if (scope === 'book' && scopeContext) {
          contextSection = `
You have access to the book's content for context:

<book_context>
${scopeContext.slice(0, 30000)}
</book_context>

`;
        }

        return `You are a helpful reading companion continuing a conversation about a text passage. The reader previously asked about this text and now has a follow-up question.

Original text being discussed: "${originalText || text}"
${contextSection}
The reader's follow-up question: "${text}"

Provide a helpful response that:
- Directly addresses their question
- References the original text when relevant${scope !== 'highlight' ? '\n- Draw on the broader context when it helps answer the question' : ''}
- Keeps the explanation clear and concise
- Maintains a friendly, conversational tone
- Is brief (2-4 sentences max unless more detail is needed)

Response:`;
      })()
    };

    // Build the request body - handle conversation history for follow-ups
    let contents;

    if (mode === 'followup' && conversationHistory && conversationHistory.length > 0) {
      // Build context-aware system message based on scope
      let contextInfo = '';
      if (scope === 'chapter' && scopeContext) {
        contextInfo = `\n\nYou have access to the full chapter${chapterTitle ? ` ("${chapterTitle}")` : ''} for additional context:\n\n${scopeContext.slice(0, 15000)}`;
      } else if (scope === 'book' && scopeContext) {
        contextInfo = `\n\nYou have access to the book's content for additional context:\n\n${scopeContext.slice(0, 30000)}`;
      }

      const systemContext = `You are a helpful reading companion. The user is reading a book and previously selected this text: "${originalText}". Continue helping them understand it.${contextInfo}`;

      contents = [
        // System context as first user message
        {
          role: 'user',
          parts: [{ text: systemContext }]
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I\'ll help explain and discuss this text with you.' }]
        },
        // Add conversation history
        ...conversationHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
        // Add current question
        {
          role: 'user',
          parts: [{ text: text }]
        }
      ];
    } else {
      // Single-turn request (explain or eli5)
      contents = [{
        role: 'user',
        parts: [{
          text: prompts[mode as keyof typeof prompts] || prompts.explain
        }]
      }];
    }

    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
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