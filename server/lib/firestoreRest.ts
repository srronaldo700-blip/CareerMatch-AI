import firebaseConfig from '../../firebase-applet-config.json';

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => toFirestoreValue(item)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(val: FirestoreValue | undefined): unknown {
  if (!val) return undefined;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return val.stringValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map((v) => fromFirestoreValue(v));
  }
  if ('mapValue' in val) {
    const obj: Record<string, unknown> = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return undefined;
}

function toFirestoreFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

function fromFirestoreDoc<T = Record<string, unknown>>(doc: {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}): { id: string; data: T } {
  const name = doc.name || '';
  const id = name.split('/').pop() || '';
  const data: Record<string, unknown> = {};
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      data[k] = fromFirestoreValue(v);
    }
  }
  return { id, data: data as T };
}

async function fsFetch(url: string, idToken: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return res;
}

export const firestoreRest = {
  async getDoc<T = Record<string, unknown>>(
    collection: string,
    docId: string,
    idToken: string
  ): Promise<T | null> {
    const res = await fsFetch(
      `${BASE_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`,
      idToken
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Firestore GET ${collection}/${docId} failed (${res.status}): ${errBody}`);
    }
    const json = (await res.json()) as { name?: string; fields?: Record<string, FirestoreValue> };
    return fromFirestoreDoc<T>(json).data;
  },

  async setDoc(
    collection: string,
    docId: string,
    data: Record<string, unknown>,
    idToken: string
  ): Promise<void> {
    const res = await fsFetch(
      `${BASE_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`,
      idToken,
      {
        method: 'PATCH',
        body: JSON.stringify({ fields: toFirestoreFields(data) }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Firestore SET ${collection}/${docId} failed (${res.status}): ${errBody}`);
    }
  },

  async addDoc(
    collection: string,
    data: Record<string, unknown>,
    idToken: string
  ): Promise<string> {
    const res = await fsFetch(`${BASE_URL}/${encodeURIComponent(collection)}`, idToken, {
      method: 'POST',
      body: JSON.stringify({ fields: toFirestoreFields(data) }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Firestore ADD ${collection} failed (${res.status}): ${errBody}`);
    }
    const json = (await res.json()) as { name?: string };
    return (json.name || '').split('/').pop() || '';
  },

  async deleteDoc(collection: string, docId: string, idToken: string): Promise<void> {
    const res = await fsFetch(
      `${BASE_URL}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`,
      idToken,
      { method: 'DELETE' }
    );
    if (res.status === 404) return;
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Firestore DELETE ${collection}/${docId} failed (${res.status}): ${errBody}`);
    }
  },

  async listCollection<T = Record<string, unknown>>(
    collection: string,
    idToken: string,
    pageSize = 100
  ): Promise<Array<{ id: string; data: T }>> {
    const res = await fsFetch(`${BASE_URL}:runQuery`, idToken, {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          limit: pageSize,
        },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Firestore LIST ${collection} failed (${res.status}): ${errBody}`);
    }
    const rows = (await res.json()) as Array<{
      document?: { name?: string; fields?: Record<string, FirestoreValue> };
    }>;
    return rows
      .filter((r) => Boolean(r.document))
      .map((r) => fromFirestoreDoc<T>(r.document!));
  },

  async queryByUserId<T = Record<string, unknown>>(
    collection: string,
    userId: string,
    idToken: string
  ): Promise<Array<{ id: string; data: T }>> {
    const res = await fsFetch(`${BASE_URL}:runQuery`, idToken, {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'userId' },
              op: 'EQUAL',
              value: { stringValue: userId },
            },
          },
        },
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Firestore QUERY ${collection} failed (${res.status}): ${errBody}`);
    }
    const rows = (await res.json()) as Array<{
      document?: { name?: string; fields?: Record<string, FirestoreValue> };
    }>;
    return rows
      .filter((r) => Boolean(r.document))
      .map((r) => fromFirestoreDoc<T>(r.document!));
  },
};
