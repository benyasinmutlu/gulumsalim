import type { Redis } from "ioredis";
import type { Session } from "fastify";

type Callback = (err?: Error | null) => void;
type CallbackSession = (err: Error | null, result?: Session | null) => void;

// @fastify/session'ın beklediği düz callback arayüzü (get/set/destroy,
// her biri callback'i TAM OLARAK BİR KEZ çağırmalı). connect-redis
// kullanmıyoruz çünkü o paket express-session için yazılmış
// (RedisStore, express-session'ın EventEmitter tabanlı Store sınıfını
// miras alıyor) - bu, @fastify/session ile uyumsuz.
// .then(fn).catch(fn) ZİNCİRLEMİYORUZ: fn içinde (callback çağrısının
// tetiklediği senkron Fastify iç işleyişinde) bir hata fırlarsa, .catch
// bunu yakalayıp callback'i İKİNCİ KEZ çağırırdı - iki argümanlı .then
// bunu önlüyor, sadece gerçek Redis hatalarını .catch'e yönlendiriyor.
export class RedisSessionStore {
  constructor(
    private client: Redis,
    private prefix: string,
    private ttlSeconds: number,
  ) {}

  set(sessionId: string, session: Session, callback: Callback): void {
    const key = this.prefix + sessionId;
    this.client.set(key, JSON.stringify(session), "EX", this.ttlSeconds).then(
      () => callback(),
      (err: Error) => callback(err),
    );
  }

  get(sessionId: string, callback: CallbackSession): void {
    const key = this.prefix + sessionId;
    this.client.get(key).then(
      (data) => callback(null, data ? (JSON.parse(data) as Session) : null),
      (err: Error) => callback(err),
    );
  }

  destroy(sessionId: string, callback: Callback): void {
    const key = this.prefix + sessionId;
    this.client.del(key).then(
      () => callback(),
      (err: Error) => callback(err),
    );
  }
}
