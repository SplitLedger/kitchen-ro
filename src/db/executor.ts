export interface SqlExecutor {
  execute(sql: string, params?: readonly unknown[]): Promise<void>;
  select<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
}
