/**
 * The shape of a dbt `run_results.json`, as it actually arrives.
 *
 * Every field here is optional on purpose. This file is written by whatever dbt
 * version the person ran, from 1.5 through 1.10, on any adapter, and a parser
 * that assumes a key exists is a parser that throws on someone else's run. The
 * types describe what dbt may write; `parse.ts` decides what to trust.
 *
 * Reference: the artifact is versioned by `metadata.dbt_schema_version`, which
 * ends in `run-results/v4`, `v5` or `v6` depending on the release.
 */

export type RawTiming = {
  /** "compile" or "execute". Order in the array is not guaranteed. */
  name?: string;
  started_at?: string | null;
  completed_at?: string | null;
};

/**
 * Adapter-specific. BigQuery reports bytes, Snowflake a query id, Postgres a
 * status string. Some adapters write a bare string instead of an object.
 */
export type RawAdapterResponse =
  | string
  | null
  | {
      _message?: string;
      code?: string;
      rows_affected?: number | null;
      bytes_processed?: number | null;
      bytes_billed?: number | null;
      query_id?: string | null;
      slot_ms?: number | null;
    };

export type RawResult = {
  unique_id?: string;
  status?: string;
  message?: string | null;
  failures?: number | null;
  thread_id?: string;
  execution_time?: number;
  timing?: RawTiming[];
  adapter_response?: RawAdapterResponse;
  /** dbt 1.8+ writes this on tests that were compiled but not run. */
  compiled?: boolean;
};

export type RawMetadata = {
  dbt_schema_version?: string;
  dbt_version?: string;
  generated_at?: string;
  invocation_id?: string;
  env?: Record<string, string>;
};

export type RawRunResults = {
  metadata?: RawMetadata;
  results?: RawResult[];
  elapsed_time?: number;
  /** Present from dbt 1.5. `threads` and `target` are the useful members. */
  args?: {
    threads?: number;
    target?: string;
    which?: string;
    select?: string[];
    exclude?: string[];
    full_refresh?: boolean;
    [key: string]: unknown;
  };
};
