declare module "sql.js" {
  export type SqlJsValue = string | number | Uint8Array | null;

  export interface SqlJsStatement {
    bind(values?: SqlJsValue[]): boolean;
    step(): boolean;
    get(): SqlJsValue[];
    getColumnNames(): string[];
    free(): boolean;
  }

  export interface SqlJsDatabase {
    run(sql: string, params?: SqlJsValue[]): SqlJsDatabase;
    prepare(sql: string): SqlJsStatement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | null) => SqlJsDatabase;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
    wasmBinary?: ArrayBuffer | Uint8Array;
  }): Promise<SqlJsStatic>;
}
