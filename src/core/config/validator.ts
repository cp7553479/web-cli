/**
 * Domain-supplied config validator. Core's loader hands the merged raw object
 * to `validate()` and expects either a typed `T` or a thrown error with a
 * concise, path-aware message. Core ships no schema knowledge and no schema
 * library — the domain owns both.
 */
export interface ConfigValidator<T> {
  validate(raw: unknown): T;
}
