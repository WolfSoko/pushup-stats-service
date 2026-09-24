import type { Firestore } from 'firebase-admin/firestore';

type Data = Record<string, unknown>;

/** A string field name, or `FieldPath.documentId()` for the doc id. */
interface Filter {
  field: unknown;
  op: '==' | 'array-contains' | '>=' | '<';
  value: unknown;
}

/**
 * In-memory stand-in for the slice of the Admin Firestore API the account
 * purge uses. Documents live in a flat `path → data` map, so nested
 * subcollections and "parent exists only as a path" behave like Firestore.
 */
export class FakeFirestore {
  readonly docs = new Map<string, Data>();

  seed(path: string, data: Data): this {
    this.docs.set(path, { ...data });
    return this;
  }

  paths(): string[] {
    return [...this.docs.keys()].sort();
  }

  asFirestore(): Firestore {
    return this as unknown as Firestore;
  }

  collection(path: string) {
    return new FakeQuery(this, path, [], Infinity, null);
  }

  batch() {
    const ops: Array<() => void> = [];
    return {
      delete: (ref: FakeDocRef) => ops.push(() => ref.deleteSync()),
      update: (ref: FakeDocRef, patch: Data) =>
        ops.push(() => ref.updateSync(patch)),
      commit: async () => ops.forEach((op) => op()),
    };
  }

  async recursiveDelete(ref: FakeDocRef): Promise<void> {
    for (const path of this.paths()) {
      if (path === ref.path || path.startsWith(`${ref.path}/`)) {
        this.docs.delete(path);
      }
    }
  }
}

export class FakeDocRef {
  constructor(
    private readonly db: FakeFirestore,
    readonly path: string
  ) {}

  get id(): string {
    return this.path.split('/').pop() ?? '';
  }

  async get() {
    const data = this.db.docs.get(this.path);
    return { id: this.id, exists: data !== undefined, data: () => data };
  }

  async set(data: Data): Promise<void> {
    this.db.docs.set(this.path, { ...data });
  }

  async update(patch: Data): Promise<void> {
    this.updateSync(patch);
  }

  async delete(): Promise<void> {
    this.deleteSync();
  }

  updateSync(patch: Data): void {
    const current = this.db.docs.get(this.path);
    if (!current) throw new Error(`NOT_FOUND: ${this.path}`);
    this.db.docs.set(this.path, { ...current, ...patch });
  }

  deleteSync(): void {
    this.db.docs.delete(this.path);
  }
}

class FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly path: string,
    private readonly filters: Filter[],
    private readonly max: number,
    private readonly afterId: string | null
  ) {}

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.db, `${this.path}/${id}`);
  }

  where(field: unknown, op: Filter['op'], value: unknown): FakeQuery {
    const filters = [...this.filters, { field, op, value }];
    return new FakeQuery(this.db, this.path, filters, this.max, this.afterId);
  }

  select(): FakeQuery {
    return this;
  }

  orderBy(): FakeQuery {
    return this;
  }

  limit(max: number): FakeQuery {
    return new FakeQuery(this.db, this.path, this.filters, max, this.afterId);
  }

  startAfter(snap: { id: string }): FakeQuery {
    return new FakeQuery(this.db, this.path, this.filters, this.max, snap.id);
  }

  async listDocuments(): Promise<FakeDocRef[]> {
    const ids = new Set<string>();
    for (const path of this.db.paths()) {
      if (!path.startsWith(`${this.path}/`)) continue;
      ids.add(path.slice(this.path.length + 1).split('/')[0]);
    }
    return [...ids].map((id) => this.doc(id));
  }

  async get() {
    const docs = this.db
      .paths()
      .filter((p) => p.startsWith(`${this.path}/`))
      .filter((p) => !p.slice(this.path.length + 1).includes('/'))
      .map((p) => ({
        ref: new FakeDocRef(this.db, p),
        data: this.db.docs.get(p) as Data,
      }))
      .filter(({ ref, data }) =>
        this.filters.every((f) => matches(ref.id, data, f))
      )
      .filter(({ ref }) => this.afterId === null || ref.id > this.afterId)
      .slice(0, this.max)
      .map(({ ref, data }) => ({
        id: ref.id,
        ref,
        data: () => data,
        get: (field: string) => data[field],
      }));
    return { empty: docs.length === 0, size: docs.length, docs };
  }
}

function matches(id: string, data: Data, filter: Filter): boolean {
  const value =
    typeof filter.field === 'string' ? data[filter.field] : (id as unknown);
  switch (filter.op) {
    case '==':
      return value === filter.value;
    case 'array-contains':
      return Array.isArray(value) && value.includes(filter.value);
    case '>=':
      return String(value) >= String(filter.value);
    case '<':
      return String(value) < String(filter.value);
  }
}
