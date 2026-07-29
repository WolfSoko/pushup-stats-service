import {
  type Content,
  GoogleGenerativeAI,
  type Tool,
} from '@google/generative-ai';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';

// Imported for its init side effects (Sentry + admin.initializeApp).
import './firebase-app';
import { AI_AGENT_MODEL, AI_AGENT_SYSTEM_PROMPT } from './ai/agent-prompt';
import { AgUiRunEmitter } from './ai/ag-ui-events';
import {
  type AgUiContextItem,
  type AgUiMessage,
  type AgUiTool,
  limitTranscript,
} from './ai/ag-ui-messages';
import { toGeminiContents, toSystemInstruction } from './ai/gemini-mapping';
import { toGeminiFunctionDeclarations } from './ai/gemini-schema';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

interface RunAgentInput {
  threadId?: string;
  runId?: string;
  messages?: AgUiMessage[];
  tools?: AgUiTool[];
  context?: AgUiContextItem[];
}

async function resolveUid(authorization: string | undefined): Promise<string> {
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (!token) throw new Error('missing-token');
  // `checkRevoked` because the app ships `revokeAllSessions` — without it a
  // "signed out everywhere" user keeps streaming until the token expires.
  const decoded = await admin.auth().verifyIdToken(token, true);
  return decoded.uid;
}

/**
 * AG-UI agent endpoint backing the in-app assistant.
 *
 * Speaks the AG-UI wire protocol directly — `POST` a `RunAgentInput`, receive
 * the run as an SSE event stream — which is all `@ag-ui/client`'s `HttpAgent`
 * needs. That keeps `@copilotkit/runtime` (graphql, type-graphql, langgraph and
 * ~40 more packages) out of the functions bundle.
 *
 * Tool calls are answered, not executed: the browser owns the tool handlers, so
 * a call ends the run and the client starts the next one with the result
 * appended to the transcript.
 */
export const agUiAgent = onRequest(
  {
    region: 'europe-west3',
    invoker: 'public',
    cors: true,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 120,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    let uid: string;
    try {
      uid = await resolveUid(req.headers.authorization);
    } catch {
      // Answered before the stream opens so the client surfaces a real status
      // instead of an empty run.
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }

    const input = (req.body ?? {}) as RunAgentInput;
    const threadId = String(input.threadId ?? '');
    const runId = String(input.runId ?? '');
    if (!threadId || !runId) {
      res.status(400).json({ error: 'threadId and runId are required' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Writing to a hung-up socket throws, and that throw inside the error path
    // would escape the handler. Track the close and let the run wind down.
    let clientGone = false;
    req.on('close', () => {
      clientGone = true;
    });

    const emitter = new AgUiRunEmitter(
      (frame) => {
        if (!clientGone && !res.writableEnded) res.write(frame);
      },
      threadId,
      runId
    );
    emitter.runStarted();

    try {
      const messages = limitTranscript(input.messages ?? []);
      const tools = toGeminiFunctionDeclarations(input.tools ?? []);
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: AI_AGENT_MODEL,
        systemInstruction: toSystemInstruction(
          AI_AGENT_SYSTEM_PROMPT,
          messages,
          input.context ?? []
        ),
        // The mapping modules stay free of SDK types so they can be unit-tested
        // on plain objects; the structural cast is confined to these two
        // hand-offs. `parameters` is a JSON Schema either way — the SDK just
        // types it with its own `SchemaType` enum.
        ...(tools.length > 0
          ? { tools: [{ functionDeclarations: tools }] as unknown as Tool[] }
          : {}),
      });

      const result = await model.generateContentStream({
        contents: toGeminiContents(messages) as unknown as Content[],
      });

      const messageId = `msg_${runId}`;
      let toolCallIndex = 0;
      for await (const chunk of result.stream) {
        if (clientGone) break;
        for (const candidate of chunk.candidates ?? []) {
          for (const part of candidate.content?.parts ?? []) {
            if (part.functionCall) {
              emitter.toolCall(
                `call_${runId}_${toolCallIndex++}`,
                part.functionCall.name,
                part.functionCall.args,
                messageId
              );
            } else if (part.text) {
              emitter.textDelta(messageId, part.text);
            }
          }
        }
      }

      emitter.runFinished();
    } catch (err) {
      logger.error('agUiAgent: run failed', { uid, threadId, runId, err });
      emitter.runError(
        'Der KI-Coach ist gerade nicht erreichbar. Bitte später erneut versuchen.',
        'agent-error'
      );
    } finally {
      if (!res.writableEnded) res.end();
    }
  }
);
