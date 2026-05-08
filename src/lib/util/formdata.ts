/**
 * Multipart form-data helper.
 *
 * The pre-built `FormData` type that ships with `@types/node` v20+ uses
 * a conditional `extends {}` pattern that drops the iterator/get methods
 * under Next.js' tsconfig (DOM + esnext). Casting through this typed
 * shape gets us a working `.get()` without leaking `any` into routes.
 */

type FormDataValue = string | File;

export interface FormDataLike {
  get(name: string): FormDataValue | null;
  getAll(name: string): FormDataValue[];
  has(name: string): boolean;
  entries(): IterableIterator<[string, FormDataValue]>;
}

export async function readForm(req: Request): Promise<FormDataLike> {
  return (await req.formData()) as unknown as FormDataLike;
}
