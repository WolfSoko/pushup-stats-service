import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  buildGithubIssueBody,
  validateFeedbackId,
  validateMarkFeedbackReadPayload,
} from './admin';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';

const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN');
const GITHUB_REPO_OWNER = 'wolfsoko';
const GITHUB_REPO_NAME = 'pushup-stats-service';

export const adminListFeedback = onCall(
  { region: 'europe-west3', timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request);

    const snap = await db
      .collection('feedback')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name ?? null,
        email: d.email ?? null,
        message: d.message ?? '',
        userId: d.userId ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? null,
        userAgent: d.userAgent ?? null,
        read: d.read === true,
        githubIssueUrl: d.githubIssueUrl ?? null,
      };
    });
  }
);

export const adminMarkFeedbackRead = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);

    const validation = validateMarkFeedbackReadPayload(request.data);
    if (!validation.valid) {
      throw new HttpsError('invalid-argument', validation.error);
    }

    const feedbackRef = db.collection('feedback').doc(validation.feedbackId);
    const feedbackSnap = await feedbackRef.get();
    if (!feedbackSnap.exists) {
      throw new HttpsError('not-found', 'Feedback nicht gefunden.');
    }

    await feedbackRef.update({ read: validation.read });

    return { ok: true };
  }
);

export const adminDeleteFeedback = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);

    const validation = validateFeedbackId(request.data);
    if (!validation.valid) {
      throw new HttpsError('invalid-argument', validation.error);
    }

    await db.collection('feedback').doc(validation.feedbackId).delete();

    return { ok: true };
  }
);

export const adminCreateGithubIssue = onCall(
  { region: 'europe-west3', secrets: [GITHUB_TOKEN] },
  async (request) => {
    assertAdmin(request);

    const validation = validateFeedbackId(request.data);
    if (!validation.valid) {
      throw new HttpsError('invalid-argument', validation.error);
    }

    const token = GITHUB_TOKEN.value();
    if (!token || token.startsWith('placeholder')) {
      throw new HttpsError(
        'failed-precondition',
        'GITHUB_TOKEN secret ist nicht konfiguriert.'
      );
    }

    const docRef = db.collection('feedback').doc(validation.feedbackId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new HttpsError('not-found', 'Feedback nicht gefunden.');
    }

    const d = doc.data() ?? {};

    // Idempotency: return existing issue URL without creating a duplicate
    if (d.githubIssueUrl) {
      return { ok: true, issueUrl: d.githubIssueUrl as string };
    }

    const createdAt = d.createdAt?.toDate?.()?.toISOString?.() ?? null;
    const { title, body } = buildGithubIssueBody({
      name: (d.name as string) ?? null,
      message: (d.message as string) ?? '',
      createdAt,
      userId: (d.userId as string) ?? null,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ title, body, labels: ['feedback'] }),
          signal: controller.signal,
        }
      );
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new HttpsError('deadline-exceeded', 'GitHub API Timeout.');
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      logger.error('GitHub issue creation failed', {
        status: response.status,
        body: text,
      });
      throw new HttpsError(
        'internal',
        'GitHub-Issue konnte nicht erstellt werden.'
      );
    }

    const issueData = (await response.json()) as { html_url: string };
    const issueUrl = issueData.html_url;

    await docRef.update({ githubIssueUrl: issueUrl });

    return { ok: true, issueUrl };
  }
);
