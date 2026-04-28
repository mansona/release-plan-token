import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';

import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),
);

const appOctokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.APP_ID,
    privateKey: process.env.PRIVATE_KEY,
  },
  baseUrl: 'https://api.github.com',
});

export default async function getToken(request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'https://token.actions.githubusercontent.com',
    audience: 'release-plan-token',
  });

  const [owner, repo] = payload.repository.split('/');

  const apps = await appOctokit.apps.getRepoInstallation({
    owner,
    repo,
  });

  const appInstallationId = apps.data.id;

  console.log({ appInstallationId });

  const {
    data: { token: applicationToken },
  } = await appOctokit.rest.apps.createInstallationAccessToken({
    installation_id: appInstallationId,
    permissions: {
      pull_requests: 'write',
      contents: 'write',
    },
  });

  return new Response(applicationToken);
}

export const config = { path: '/token' };
