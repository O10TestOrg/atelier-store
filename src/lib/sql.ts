// Pure helpers for building queries.

// `term` as an ILIKE pattern that matches it anywhere, wildcards escaped.
export const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, "\\$&")}%`;
