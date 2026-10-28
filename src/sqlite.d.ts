declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): { run(...params: any[]): { changes: number; lastInsertRowid: number }; get(...params: any[]): unknown; all(...params: any[]): any[] };
  }
}
