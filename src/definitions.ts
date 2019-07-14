export interface CasbinRule {
  pType: String;
  v0: String;
  v1: String;
  v2: String;
  v3: String;
  v4: String;
  v5: String;
}
export interface Adapter {
  host: String;
  port: Number;
  path: String;
  url: String;
  password: String;
  db: String;
  tls: Object;
}
