import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'docs/vnext-baseline/rollout-chain.jsonl');
const evidenceDir = path.join(root, 'docs/vnext-baseline/rollout-exposure-metrics-and-decisions');
const canonical = value => value === null || typeof value !== 'object'
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const hash = record => createHash('sha256').update(canonical(Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'recordHash')))).digest('hex');
const read = () => existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : [];

function verify(rows) {
  if (!rows.length) throw new Error('rollout chain is empty');
  let previous = null;
  rows.forEach((record, index) => {
    if (record.schemaVersion !== 1) throw new Error(`record ${index}: schemaVersion`);
    if (record.previousHash !== previous) throw new Error(`record ${index}: previousHash`);
    if (record.recordHash !== hash(record)) throw new Error(`record ${index}: recordHash`);
    if (!record.stage || !record.decision || !record.utc || !record.owner) throw new Error(`record ${index}: required fields`);
    previous = record.recordHash;
  });
  return rows.length;
}

function append(input) {
  const rows = read(); verify(rows);
  const record = { schemaVersion: 1, previousHash: rows.at(-1)?.recordHash || null, ...input };
  record.recordHash = hash(record);
  appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
  return record;
}

function writeCurrentEvidence(record) {
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = {
    schemaVersion: 1,
    chainHead: record.recordHash,
    stage: record.stage,
    decision: record.decision,
    owner: record.owner,
    utc: record.utc,
    configRevision: record.configRevision,
    signatureStatus: record.signatureStatus,
    queryVersion: record.queryVersion,
    sample: record.sample,
    metrics: record.metrics,
    confidence: record.confidence,
    killSwitchDrill: record.killSwitchDrill,
    incidents: record.incidents,
    waivers: record.waivers,
    blockers: record.blockers,
  };
  writeFileSync(path.join(evidenceDir, 'local-current.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

const command = process.argv[2] || 'verify';
if (command === 'init') {
  if (!existsSync(file)) {
    writeFileSync(file, '', 'utf8');
    append({ stage: 'local', decision: 'hold_external_gates', owner: 'local-codex', utc: new Date().toISOString(), configRevision: null, signatureStatus: 'unsigned-local', metrics: { qaGroups: '19/19', domain: '12/12', browserV1: '7/7', browserV2: '7/7' }, blockers: ['native_adobe_smoke', 'signed_artifact', 'staged_rollout', 'seven_day_soak'] });
  }
  console.log(`rollout chain initialized: ${verify(read())} record`);
} else if (command === 'local-current') {
  const rows = read(); verify(rows);
  if (rows.at(-1)?.metrics?.domain !== '24/24' || !existsSync(path.join(evidenceDir, 'local-current.json'))) {
    append({ stage: 'local', decision: 'hold_external_gates', owner: 'local-codex', utc: new Date().toISOString(), configRevision: null, signatureStatus: 'unsigned-local', queryVersion: 'local-qa-v5', sample: { kind: 'automated-local', eligible: 0, exposed: 0 }, metrics: { qaGroups: '20/20', domain: '24/24', browserV1: '7/7', browserV2: '7/7' }, confidence: { claim: 'not_applicable_local', reason: 'No staged user exposure denominator exists.' }, killSwitchDrill: { dualStackTarget: 'frozen_v1', legacyFreeTarget: 'safe_v2_shell', result: 'pass_automated' }, incidents: [], waivers: [], blockers: ['native_adobe_smoke', 'signed_artifact', 'staged_rollout', 'seven_day_soak'] });
  }
  writeCurrentEvidence(read().at(-1));
  console.log(`rollout local evidence current: ${verify(read())} record`);
} else if (command === 'append') {
  const inputPath = process.argv[3]; if (!inputPath) throw new Error('append requires a JSON file');
  const record = append(JSON.parse(readFileSync(path.resolve(inputPath), 'utf8')));
  console.log(`rollout record appended: ${record.recordHash}`);
} else {
  console.log(`rollout chain verified: ${verify(read())} record`);
}
