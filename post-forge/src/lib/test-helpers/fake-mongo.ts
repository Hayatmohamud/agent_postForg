/**
 * A minimal in-memory stand-in for the subset of the MongoDB driver's
 * `Collection` API that `posts-repo.ts`/`settings-repo.ts` actually use
 * (`insertOne`, `findOne`, `find().sort().skip().limit().toArray()`,
 * `countDocuments`, `updateOne` with `$set`/`$push`/`$inc`/`$setOnInsert`
 * + `{upsert:true}`).
 *
 * Mongo test strategy (T18, see tasks/reports.jsonl): this environment's
 * `npm install` repeatedly hit filesystem-locking errors (ENOENT/ENOTEMPTY
 * mid-extraction, almost certainly OneDrive/AV contention on the synced
 * `Desktop` folder this worktree lives under -- see the report filed
 * alongside this file) even for packages already in package.json, several
 * retries deep. Layering `mongodb-memory-server`'s own binary download on
 * top of that instability (a much bigger, network-dependent artifact, in
 * the same fragile install path T01/T02 already hit for `inngest-cli`'s
 * postinstall -- R-0001) was judged impractical to depend on for a "must be
 * green" suite. This fake instead re-implements just enough real Mongo
 * *semantics* (dot-path `$set`, array `$push`, numeric `$inc`, `$gte`/`$lte`
 * range filters, `$text` as a simple substring match, upsert via
 * `$setOnInsert`) to exercise the repository's actual update-scoping logic
 * end-to-end, not just mock away its return values.
 */

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let node = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof node[key] !== "object" || node[key] === null) {
      node[key] = {};
    }
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function idsEqual(a: unknown, b: unknown): boolean {
  const as = a && typeof a === "object" && "toString" in a ? String(a) : String(a);
  const bs = b && typeof b === "object" && "toString" in b ? String(b) : String(b);
  return as === bs;
}

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  for (const [key, cond] of Object.entries(filter)) {
    if (key === "$text") {
      const search = String((cond as { $search: string }).$search ?? "").toLowerCase();
      const topic = String(doc.topic ?? "").toLowerCase();
      if (!topic.includes(search)) return false;
      continue;
    }
    if (key === "_id") {
      if (!idsEqual(doc._id, cond)) return false;
      continue;
    }
    if (key === "runId") {
      if (doc.runId !== cond) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      const range = cond as Record<string, unknown>;
      const actual = doc[key];
      if ("$gte" in range && !(actual instanceof Date && actual >= (range.$gte as Date))) {
        return false;
      }
      if ("$lte" in range && !(actual instanceof Date && actual <= (range.$lte as Date))) {
        return false;
      }
      continue;
    }
    if (doc[key] !== cond) return false;
  }
  return true;
}

export class FakeCollection<T extends { _id: unknown }> {
  docs: Record<string, unknown>[] = [];

  async insertOne(doc: T): Promise<{ insertedId: unknown }> {
    this.docs.push(deepClone(doc as unknown as Record<string, unknown>));
    return { insertedId: (doc as unknown as { _id: unknown })._id };
  }

  async findOne(filter: Record<string, unknown>): Promise<T | null> {
    const found = this.docs.find((d) => matchesFilter(d, filter));
    return found ? (deepClone(found) as unknown as T) : null;
  }

  find(filter: Record<string, unknown> = {}) {
    let results = this.docs.filter((d) => matchesFilter(d, filter));
    let sortSpec: Record<string, 1 | -1> | undefined;
    let skipN = 0;
    let limitN: number | undefined;
    const cursor = {
      sort: (spec: Record<string, 1 | -1>) => {
        sortSpec = spec;
        return cursor;
      },
      skip: (n: number) => {
        skipN = n;
        return cursor;
      },
      limit: (n: number) => {
        limitN = n;
        return cursor;
      },
      toArray: async () => {
        let out = [...results];
        if (sortSpec) {
          const [[field, dir]] = Object.entries(sortSpec);
          out.sort((a, b) => {
            const av = a[field] as string | number | Date;
            const bv = b[field] as string | number | Date;
            if (av < bv) return dir === 1 ? -1 : 1;
            if (av > bv) return dir === 1 ? 1 : -1;
            return 0;
          });
        }
        out = out.slice(skipN, limitN !== undefined ? skipN + limitN : undefined);
        return out.map((d) => deepClone(d)) as unknown as T[];
      },
    };
    void results;
    return cursor;
  }

  async countDocuments(filter: Record<string, unknown> = {}): Promise<number> {
    return this.docs.filter((d) => matchesFilter(d, filter)).length;
  }

  async updateOne(
    filter: Record<string, unknown>,
    update: {
      $set?: Record<string, unknown>;
      $push?: Record<string, unknown>;
      $inc?: Record<string, number>;
      $setOnInsert?: Record<string, unknown>;
    },
    options?: { upsert?: boolean }
  ): Promise<{ matchedCount: number; upsertedId: unknown | null }> {
    let doc = this.docs.find((d) => matchesFilter(d, filter));
    let upsertedId: unknown = null;

    if (!doc) {
      if (!options?.upsert) {
        return { matchedCount: 0, upsertedId: null };
      }
      doc = {};
      if (update.$setOnInsert) {
        for (const [k, v] of Object.entries(update.$setOnInsert)) setPath(doc, k, v);
      }
      this.docs.push(doc);
      upsertedId = doc._id;
    }

    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) setPath(doc, k, v);
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        const arr = (getPath(doc, k) as unknown[]) ?? [];
        arr.push(v);
        setPath(doc, k, arr);
      }
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        const current = (getPath(doc, k) as number) ?? 0;
        setPath(doc, k, current + v);
      }
    }

    return { matchedCount: 1, upsertedId };
  }
}

export class FakeDb {
  private collections = new Map<string, FakeCollection<never>>();

  collection<T extends { _id: unknown }>(name: string): FakeCollection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new FakeCollection());
    }
    return this.collections.get(name) as unknown as FakeCollection<T>;
  }
}
