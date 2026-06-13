import {
  decryptField,
  encryptField,
  hashLookup,
  isEncrypted,
} from "@zindagi/shared/crypto/field-encryption";
import type { Schema } from "mongoose";

export type EncryptedFieldKind =
  | "string"
  | "strings"
  | "date"
  | "object"
  | "nestedArray";

export type EncryptedFieldConfig = {
  path: string;
  kind: EncryptedFieldKind;
  /** For nestedArray — only encrypt these sub-fields (default: all strings). */
  subFields?: string[];
};

export type LookupFieldConfig = {
  field: string;
  lookupField: string;
  normalize: (value: string) => string;
};

type PlainObject = Record<string, unknown>;

function getAt(obj: PlainObject, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as PlainObject)[part];
  }
  return current;
}

function setAt(obj: PlainObject, path: string, value: unknown) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] == null || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as PlainObject;
  }
  current[parts[parts.length - 1]] = value;
}

function encryptNestedArray(
  value: unknown,
  subFields?: string[],
): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (!item || typeof item !== "object") return item;
    const row: PlainObject = { ...(item as PlainObject) };
    for (const [key, nested] of Object.entries(row)) {
      if (typeof nested !== "string") continue;
      if (subFields && !subFields.includes(key)) continue;
      row[key] = encryptField(nested);
    }
    return row;
  });
}

function decryptNestedArray(
  value: unknown,
  subFields?: string[],
): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (!item || typeof item !== "object") return item;
    const row: PlainObject = { ...(item as PlainObject) };
    for (const [key, nested] of Object.entries(row)) {
      if (typeof nested !== "string") continue;
      if (subFields && !subFields.includes(key)) continue;
      row[key] = decryptField(nested);
    }
    return row;
  });
}

function encryptValue(
  value: unknown,
  kind: EncryptedFieldKind,
  subFields?: string[],
): unknown {
  if (value == null) return value;

  switch (kind) {
    case "string":
      return typeof value === "string" ? encryptField(value) : value;
    case "strings":
      if (!Array.isArray(value)) return value;
      return value.map((item) =>
        typeof item === "string" ? encryptField(item) : item,
      );
    case "date":
      const iso =
        value instanceof Date
          ? value.toISOString()
          : typeof value === "string"
            ? value
            : String(value);
      return encryptField(iso);
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) return value;
      const out: PlainObject = {};
      for (const [key, nested] of Object.entries(value as PlainObject)) {
        out[key] =
          typeof nested === "string" ? encryptField(nested) : nested;
      }
      return out;
    case "nestedArray":
      return encryptNestedArray(value, subFields);
    default:
      return value;
  }
}

function decryptValue(
  value: unknown,
  kind: EncryptedFieldKind,
  subFields?: string[],
): unknown {
  if (value == null) return value;

  switch (kind) {
    case "string":
      return typeof value === "string" ? decryptField(value) : value;
    case "strings":
      if (!Array.isArray(value)) return value;
      return value.map((item) =>
        typeof item === "string" ? decryptField(item) : item,
      );
    case "date":
      if (typeof value !== "string") return value;
      const decrypted = decryptField(value);
      const parsed = new Date(decrypted);
      return Number.isNaN(parsed.getTime()) ? decrypted : parsed;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) return value;
      const out: PlainObject = {};
      for (const [key, nested] of Object.entries(value as PlainObject)) {
        out[key] =
          typeof nested === "string" ? decryptField(nested) : nested;
      }
      return out;
    case "nestedArray":
      return decryptNestedArray(value, subFields);
    default:
      return value;
  }
}

function encryptPlainObject(
  obj: PlainObject,
  fields: EncryptedFieldConfig[],
  lookups: LookupFieldConfig[],
) {
  for (const lookup of lookups) {
    const raw = getAt(obj, lookup.field);
    if (typeof raw !== "string" || !raw) continue;
    if (isEncrypted(raw)) continue;

    const normalized = lookup.normalize(raw);
    setAt(obj, lookup.lookupField, hashLookup(normalized));
    setAt(obj, lookup.field, encryptField(raw));
  }

  for (const field of fields) {
    const current = getAt(obj, field.path);
    if (current == null) continue;
    setAt(obj, field.path, encryptValue(current, field.kind, field.subFields));
  }
}

function decryptPlainObject(obj: PlainObject, fields: EncryptedFieldConfig[]) {
  for (const field of fields) {
    const current = getAt(obj, field.path);
    if (current == null) continue;
    setAt(obj, field.path, decryptValue(current, field.kind, field.subFields));
  }
}

function encryptUpdatePayload(
  update: PlainObject,
  fields: EncryptedFieldConfig[],
  lookups: LookupFieldConfig[],
) {
  const $set = (update.$set as PlainObject | undefined) ?? update;

  for (const lookup of lookups) {
    const raw = $set[lookup.field];
    if (typeof raw !== "string" || !raw || isEncrypted(raw)) continue;
    $set[lookup.lookupField] = hashLookup(lookup.normalize(raw));
    $set[lookup.field] = encryptField(raw);
  }

  for (const field of fields) {
    const path = field.path;
    if (path.includes(".")) {
      const current = getAt($set, path);
      if (current != null) {
        setAt($set, path, encryptValue(current, field.kind, field.subFields));
      }
      continue;
    }

    const current = $set[path];
    if (current != null) {
      $set[path] = encryptValue(current, field.kind, field.subFields);
    }
  }

  if (update.$set) {
    update.$set = $set;
  }
}

function applyToDocument(
  doc: PlainObject & { set?: (path: string, value: unknown) => void },
  fields: EncryptedFieldConfig[],
  lookups: LookupFieldConfig[],
  mode: "encrypt" | "decrypt",
) {
  const plain: PlainObject = doc.set ? doc : { ...doc };

  if (mode === "encrypt") {
    encryptPlainObject(plain, fields, lookups);
  } else {
    decryptPlainObject(plain, fields);
  }

  if (doc.set) {
    for (const field of fields) {
      const value = getAt(plain, field.path);
      if (value !== undefined) {
        doc.set(field.path, value);
      }
    }
    for (const lookup of lookups) {
      const lookupValue = getAt(plain, lookup.lookupField);
      if (lookupValue !== undefined) {
        doc.set(lookup.lookupField, lookupValue);
      }
      const fieldValue = getAt(plain, lookup.field);
      if (fieldValue !== undefined) {
        doc.set(lookup.field, fieldValue);
      }
    }
  } else {
    for (const field of fields) {
      const value = getAt(plain, field.path);
      if (value !== undefined) {
        setAt(doc, field.path, value);
      }
    }
    for (const lookup of lookups) {
      const lookupValue = getAt(plain, lookup.lookupField);
      if (lookupValue !== undefined) {
        setAt(doc, lookup.lookupField, lookupValue);
      }
      const fieldValue = getAt(plain, lookup.field);
      if (fieldValue !== undefined) {
        setAt(doc, lookup.field, fieldValue);
      }
    }
  }
}

function decryptResult(
  result: unknown,
  fields: EncryptedFieldConfig[],
) {
  if (!result) return;
  if (Array.isArray(result)) {
    for (const item of result) {
      applyToDocument(item as PlainObject, fields, [], "decrypt");
    }
    return;
  }
  applyToDocument(result as PlainObject, fields, [], "decrypt");
}

/**
 * Mongoose plugin — AES-256-GCM field encryption for PII at rest.
 * Encrypts on save / update; decrypts on read (including lean queries).
 */
export function applyFieldEncryption(
  schema: Schema,
  options: {
    fields: EncryptedFieldConfig[];
    lookups?: LookupFieldConfig[];
  },
) {
  const fields = options.fields;
  const lookups = options.lookups ?? [];

  schema.pre("save", function () {
    applyToDocument(
      this as PlainObject & { set: (p: string, v: unknown) => void },
      fields,
      lookups,
      "encrypt",
    );
  });

  schema.post("validate", function () {
    applyToDocument(
      this as PlainObject & { set: (p: string, v: unknown) => void },
      fields,
      lookups,
      "encrypt",
    );
  });

  schema.pre("insertMany", function (next, docs) {
    for (const doc of docs as PlainObject[]) {
      encryptPlainObject(doc, fields, lookups);
    }
    next();
  });

  const updateHooks = ["updateOne", "updateMany", "findOneAndUpdate"] as const;
  for (const hook of updateHooks) {
    schema.pre(hook, function () {
      const update = this.getUpdate() as PlainObject | null;
      if (!update) return;
      encryptUpdatePayload(update, fields, lookups);
    });
  }

  const readHooks = ["find", "findOne", "findOneAndUpdate"] as const;
  for (const hook of readHooks) {
    schema.post(hook, function (result) {
      decryptResult(result, fields);
    });
  }

  schema.post("init", function () {
    applyToDocument(
      this as PlainObject & { set: (p: string, v: unknown) => void },
      fields,
      [],
      "decrypt",
    );
  });
}
