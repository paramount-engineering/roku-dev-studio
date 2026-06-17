import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as forge from 'node-forge';

export type CaMaterial = {
  certPem: string;
  keyPem: string;
  certDer: Buffer;
  fingerprintSha256: string;
  createdAt: string;
  commonName: string;
};

const CA_CN = 'Roku Dev Studio Network Inspector';
const CA_ORG = 'Paramount Streaming';
const CA_VALID_YEARS = 10;
const CA_FILE_CERT = 'rds-network-inspector-ca.cert.pem';
const CA_FILE_KEY = 'rds-network-inspector-ca.key.pem';
const CA_FILE_PEM = 'rds-network-inspector-ca.pem';
const CA_FILE_CRT = 'rds-network-inspector-ca.crt';

let caDir: string | null = null;
let cached: CaMaterial | null = null;

export function initCaStore(userDataPath: string): void {
  caDir = path.join(userDataPath, 'network-inspector', 'ca');
  cached = null;
}

function ensureCaDir(): string {
  if (!caDir) {
    throw new Error('CA store not initialized — call initCaStore(userDataPath) first.');
  }
  if (!fs.existsSync(caDir)) {
    fs.mkdirSync(caDir, { recursive: true });
  }
  return caDir;
}

function fingerprintSha256(certPem: string): string {
  const der = forge.pem.decode(certPem)[0]?.body;
  if (!der) return '';
  const hash = crypto.createHash('sha256').update(Buffer.from(der, 'binary')).digest('hex');
  return hash.match(/.{2}/g)?.join(':').toUpperCase() ?? hash;
}

function generateCa(): CaMaterial {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = crypto.randomBytes(8).toString('hex');
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notBefore.getFullYear() + CA_VALID_YEARS);
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;
  const attrs = [
    { name: 'commonName', value: CA_CN },
    { name: 'organizationName', value: CA_ORG },
    { shortName: 'OU', value: 'Roku Dev Studio' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    {
      name: 'subjectKeyIdentifier',
      subjectKeyIdentifier: true
    }
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const certDer = Buffer.from(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(), 'binary');

  return {
    certPem,
    keyPem,
    certDer,
    fingerprintSha256: fingerprintSha256(certPem),
    createdAt: notBefore.toISOString(),
    commonName: CA_CN
  };
}

function persistCa(material: CaMaterial): void {
  const dir = ensureCaDir();
  fs.writeFileSync(path.join(dir, CA_FILE_CERT), material.certPem, 'utf8');
  fs.writeFileSync(path.join(dir, CA_FILE_KEY), material.keyPem, 'utf8');
  fs.writeFileSync(path.join(dir, CA_FILE_PEM), material.certPem, 'utf8');
  fs.writeFileSync(path.join(dir, CA_FILE_CRT), material.certPem, 'utf8');
  const meta = {
    commonName: material.commonName,
    fingerprintSha256: material.fingerprintSha256,
    createdAt: material.createdAt
  };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
}

function loadCaFromDisk(): CaMaterial | null {
  const dir = ensureCaDir();
  const certPath = path.join(dir, CA_FILE_CERT);
  const keyPath = path.join(dir, CA_FILE_KEY);
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) return null;
  const certPem = fs.readFileSync(certPath, 'utf8');
  const keyPem = fs.readFileSync(keyPath, 'utf8');
  const certDer = Buffer.from(forge.pem.decode(certPem)[0]?.body ?? '', 'binary');
  let createdAt = new Date().toISOString();
  const metaPath = path.join(dir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { createdAt?: string };
      if (typeof meta.createdAt === 'string') createdAt = meta.createdAt;
    } catch {
      /* ignore */
    }
  }
  return {
    certPem,
    keyPem,
    certDer,
    fingerprintSha256: fingerprintSha256(certPem),
    createdAt,
    commonName: CA_CN
  };
}

export function getOrCreateCa(): CaMaterial {
  if (cached) return cached;
  const existing = loadCaFromDisk();
  if (existing) {
    cached = existing;
    return existing;
  }
  const created = generateCa();
  persistCa(created);
  cached = created;
  return created;
}

export function getCaDir(): string {
  return ensureCaDir();
}

export function getCaPemPath(): string {
  return path.join(ensureCaDir(), CA_FILE_PEM);
}

export function getCaInfo(): {
  commonName: string;
  fingerprintSha256: string;
  createdAt: string;
  pemPath: string;
} {
  const ca = getOrCreateCa();
  return {
    commonName: ca.commonName,
    fingerprintSha256: ca.fingerprintSha256,
    createdAt: ca.createdAt,
    pemPath: getCaPemPath()
  };
}

export function createLeafCert(hostname: string, ca: CaMaterial): { certPem: string; keyPem: string } {
  const caCert = forge.pki.certificateFromPem(ca.certPem);
  const caKey = forge.pki.privateKeyFromPem(ca.keyPem);
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = crypto.randomBytes(8).toString('hex');
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setFullYear(notBefore.getFullYear() + 1);
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;
  cert.setSubject([{ name: 'commonName', value: hostname }]);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: hostname }] }
  ]);
  cert.sign(caKey, forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey)
  };
}
