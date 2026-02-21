# Firebase Deployment Guide

This guide describes deploying the frontend and minimal backend to Firebase hosting and Cloud Functions, aligned with the Firebase-first phase of the migration.

## Overview

- Frontend hosting on Firebase Hosting (or SSR via Cloud Functions if SSR is required)
- Authentication via Firebase Auth
- Data storage in Cloud Firestore
- Optional serverless API via Cloud Functions
- CI/CD via GitHub Actions to deploy Firebase hosting and functions

## Prerequisites

- A Firebase project (recommended: pushup-stats-firebase)
- Firebase CLI installed and authenticated
- Firebase Hosting configured for the project
- Optional: Cloud Firestore enabled
- Node.js >= 14 (or as required by Firebase tooling)

## Step-by-step Deployment

1. Initialize Firebase in the project

- Run: firebase login
- Run: firebase init
  - Choose Hosting: Configure and deploy Firebase Hosting
  - Choose Functions (optional): if you plan to host API with Cloud Functions
  - Associate with project: select pushup-stats-firebase
  - Set public directory: dist/web/browser (or as configured by your build output)
  - Configure as a single-page app: yes (redirect all urls to index.html)
  - Do not overwrite existing index.html if you have a framework build

2. Build your frontend

- Ensure your build outputs to the directory configured in Firebase.json
- Example: npx nx build web --configuration=production

3. Deploy

- Run: firebase deploy
- Verify hosting URL and, if using functions, API endpoints under /api/

4. CI/CD

- Create a GitHub Actions workflow to deploy on push to main:
  - Install Firebase tools
  - Build frontend with your Nx commands
  - Run firebase deploy --only hosting (and functions if used)

## Environment Configuration

- Firebase config (apiKey, authDomain, etc.) should be injected client-side in the app or via environment configs if you use hosting rewrites
- If you need server-side secrets, use Firebase Functions config and Firebase environment config

## Observability & Security

- Monitor Firebase Hosting and Functions logs in Firebase Console
- Use Firebase Security Rules for Firestore
- Consider enabling Analytics for frontend insights

## Rollback Strategy

- Use Git history and Firebase hosting versioning (deployments) to rollback to a previous release

## Conversion Notes

- This guide replaces the Vercel-specific setup for the frontend path. The API remains behind a private endpoint (e.g., Tail network) and can be accessed via configured rewrites or Cloud Run endpoints in future phases.

---

_Last updated: 2026-02-21_
