import fs from 'fs/promises';
import path from 'path';

const STATE_DIR = path.resolve(process.cwd(), 'server/state');
const STATE_FILE = path.join(STATE_DIR, 'gmail-tokens.json');

const ensureStateFile = async () => {
  await fs.mkdir(STATE_DIR, { recursive: true });
  try {
    await fs.access(STATE_FILE);
  } catch {
    await fs.writeFile(STATE_FILE, JSON.stringify({ accounts: {} }, null, 2), 'utf8');
  }
};

const readState = async () => {
  await ensureStateFile();
  const raw = await fs.readFile(STATE_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return { accounts: {} };
  }
};

const writeState = async (state) => {
  await ensureStateFile();
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
};

export const getTokenSet = async (accountId) => {
  const state = await readState();
  return state.accounts?.[accountId] || null;
};

export const setTokenSet = async (accountId, tokenSet) => {
  const state = await readState();
  if (!state.accounts) state.accounts = {};

  state.accounts[accountId] = {
    ...tokenSet,
    updatedAt: new Date().toISOString(),
  };

  await writeState(state);
};

export const countLinkedAccounts = async () => {
  const state = await readState();
  return Object.keys(state.accounts || {}).length;
};

export const listLinkedAccountIds = async () => {
  const state = await readState();
  return Object.keys(state.accounts || {});
};
